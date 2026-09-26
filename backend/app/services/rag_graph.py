import re
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END

from app.core.clients import collection
from app.core.config import DISTANCE_THRESHOLD, MAX_CONTEXT_CHUNKS

from app.services.qa_service import build_prompt

QUESTION_PATTERN = re.compile(r"(?:question|q)\.?\s*#?\s*(\d+)", re.IGNORECASE)


class RAGState(TypedDict, total=False):
    question: str
    document_ids: list[str]
    history: list[dict]
    doc_labels: dict[str, str]
    search_query: str
    chunks: list[str]
    metadata: list[dict]
    distances: list[float]
    is_relevant: bool
    mode: str          # "single" ya "compare"
    prompt: str


def retrieve_node(state: RAGState) -> RAGState:
    """Vector search karta hai. Single-doc mein normal top-k. Compare-mode
    mein har document se poora quota nikaal ke, sabko distance ke hisaab
    se merge-rerank karta hai — taaki koi ek document dominate na kare,
    lekin fir bhi genuinely best-matching chunks hi context mein jaayein."""

    question = state["question"]
    document_ids = state["document_ids"]
    history = state.get("history", [])
    mode = "compare" if len(document_ids) > 1 else "single"

    search_query = question
    if history:
        last_turns = history[-4:]
        context_snippet = " ".join(m.get("text", "") for m in last_turns if m.get("text"))
        search_query = f"{context_snippet} {question}".strip()

    all_chunks, all_metadata, all_distances = [], [], []

    if mode == "compare":
        for doc_id in document_ids:
            result = collection.get(where={"document_id": doc_id}, include=[])
            n = min(len(result["ids"]), MAX_CONTEXT_CHUNKS)
            if n == 0:
                continue

            results = collection.query(
                query_texts=[search_query],
                n_results=n,
                where={"document_id": doc_id},
            )
            if results["documents"] and results["documents"][0]:
                all_chunks.extend(results["documents"][0])
                all_metadata.extend(results["metadatas"][0])
                all_distances.extend(results["distances"][0])

        # Merge-rerank: sabko best-distance-first sort karo, phir top-N lo.
        # Compare-mode mein normal se zyada context chahiye hota hai (do
        # documents ka info ek saath dekhna hai), isliye 2x quota rakha hai.
        if all_chunks:
            ranked = sorted(
                zip(all_chunks, all_metadata, all_distances), key=lambda x: x[2]
            )
            top_k = ranked[: MAX_CONTEXT_CHUNKS * 2]
            all_chunks, all_metadata, all_distances = map(list, zip(*top_k))

    else:
        doc_id = document_ids[0]
        result = collection.get(where={"document_id": doc_id}, include=[])
        n = min(len(result["ids"]), MAX_CONTEXT_CHUNKS) if result["ids"] else 0

        if n > 0:
            # Referential queries jaise "solve question 2" ke liye direct
            # metadata-match try karo (agar chunker ne question_number
            # store kiya hai), warna normal semantic search.
            match = QUESTION_PATTERN.search(question)
            if match:
                q_num = int(match.group(1))
                direct = collection.get(
                    where={"$and": [{"document_id": doc_id}, {"question_number": q_num}]},
                )
                if direct["ids"]:
                    all_chunks = direct["documents"]
                    all_metadata = direct["metadatas"]
                    all_distances = [0.0] * len(direct["documents"])

            if not all_chunks:
                results = collection.query(
                    query_texts=[search_query],
                    n_results=n,
                    where={"document_id": doc_id},
                )
                all_chunks = results["documents"][0]
                all_metadata = results["metadatas"][0]
                all_distances = results["distances"][0]

    return {
        **state,
        "search_query": search_query,
        "chunks": all_chunks,
        "metadata": all_metadata,
        "distances": all_distances,
        "mode": mode,
    }


def relevance_check_node(state: RAGState) -> RAGState:
    distances = state.get("distances", [])
    if not distances or min(distances) > DISTANCE_THRESHOLD:
        return {**state, "is_relevant": False}
    return {**state, "is_relevant": True}


def prepare_prompt_node(state: RAGState) -> RAGState:
    strict = state.get("mode") == "compare"
    prompt = build_prompt(
        state["question"],
        state["chunks"],
        state.get("metadata", []),
        state.get("history", []),
        strict=strict,
        doc_labels=state.get("doc_labels", {}),
    )
    return {**state, "prompt": prompt}


def route_after_relevance(state: RAGState) -> str:
    return "prepare_prompt" if state.get("is_relevant") else END


graph_builder = StateGraph(RAGState)

graph_builder.add_node("retrieve", retrieve_node)
graph_builder.add_node("relevance_check", relevance_check_node)
graph_builder.add_node("prepare_prompt", prepare_prompt_node)

graph_builder.set_entry_point("retrieve")
graph_builder.add_edge("retrieve", "relevance_check")
graph_builder.add_conditional_edges(
    "relevance_check",
    route_after_relevance,
    {"prepare_prompt": "prepare_prompt", END: END},
)
graph_builder.add_edge("prepare_prompt", END)

rag_graph = graph_builder.compile()