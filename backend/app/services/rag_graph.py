from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END

from app.core.clients import collection
from app.core.config import DISTANCE_THRESHOLD, MAX_CONTEXT_CHUNKS

from app.services.qa_service import build_prompt

class RAGState (TypedDict, total = False):
    question: str
    document_id: str
    history: list[dict]
    search_query: str
    chunks: list[str]
    metadata: list[dict]
    distances: list[float]
    is_relevant: bool
    prompt: str

def retrieve_node(state: RAGState) -> RAGState:
    """Vector search karta hai — follow-up questions ke liye history bhi
    query mein jodta hai (weak standalone questions jaise "aur batao" ka
    retrieval sahi karne ke liye)."""

    question = state["question"]
    document_id = state["document_id"]
    history = state["history"]

    search_query = question

    if history:
        last_turns = history[-4:]
        context_snippet = " ".join(m.get("text", "") for m in last_turns if m.get("text"))
        search_query = f"{context_snippet} {question}".strip()

    result = collection.get(where={"document_id": document_id}, include=[])
    
    total_chunks = len(result["ids"])
    n = min(total_chunks, MAX_CONTEXT_CHUNKS) if total_chunks else 0

    if n == 0:
        return {**state, "chunks": [], "metadata": [], "distances": []}


    results = collection.query(
        query_texts=[search_query],
        n_results=n,
        where={"document_id": document_id},
    )

    return {
        **state,
        "search_query": search_query,
        "chunks": results["documents"][0],
        "metadata": results["metadatas"][0],
        "distances": results["distances"][0],
    }

def relevance_check_node(state: RAGState) -> RAGState:
    """Agar sabse acha (sabse kam) distance bhi threshold se zyada hai,
    matlab koi chunk genuinely relevant nahi mila — LLM ko call hi mat karo."""

    distances = state.get("distances", [])
    if not distances or min(distances) > DISTANCE_THRESHOLD:
        return {**state, "is_relevant": False}


    return {**state, "is_relevant": True}


def prepare_prompt_node(state: RAGState) -> RAGState:
    prompt = build_prompt(state["question"], state["chunks"], state.get("history", []))
    return {**state, "prompt": prompt}


def route_after_relevance(state: RAGState) -> str:
    return "prepare_prompt" if state.get("is_relevant") else END



#  ---------------------- GRAPH ASSEMBLY -------------------------------

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