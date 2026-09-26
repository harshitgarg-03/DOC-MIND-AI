import json
import logging
import asyncio

from app.core.clients import genai_client
from app.core.cache import cache_get, cache_set, answer_cache_key
from app.core.config import CHAT_MODEL, MAX_CONTEXT_CHUNKS, ANSWER_CACHE_TTL
from app.core.registry import save_message
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def generate_follow_up_questions(question: str, answer: str, relevant_chunks: list[str]) -> list[str]:
    """Answer ke baad 3 chhote follow-up questions generate karta hai."""
    context = "\n---\n".join(relevant_chunks)[:3000]

    prompt = f"""Based on the document context, the user's question, and the answer given, suggest exactly 3 short, natural follow-up questions the user might ask next. Questions should be specific to the document content, not generic.

Context:
{context}

Question: {question}
Answer: {answer[:800]}

Respond ONLY with a JSON array of 3 strings, nothing else. Example:
["question 1", "question 2", "question 3"]"""

    try:
        response = genai_client.models.generate_content(model=CHAT_MODEL, contents=prompt)
        text = (response.text or "").strip()
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        suggestions = json.loads(text)
        if isinstance(suggestions, list):
            return [str(s) for s in suggestions[:3]]
    except Exception:
        logger.exception("Follow-up question generation failed — skipping suggestions")

    return []


def build_prompt(
    question: str,
    relevant_chunks: list[str],
    relevant_metadata: list[dict],
    history: list[dict],
    strict: bool = False,
    doc_labels: dict[str, str] | None = None,
) -> str:
    """
    strict=False (single-document mode):
      PDF-content ko priority do, lekin agar PDF mein cheez nahi hai to
      clearly-labeled general knowledge bhi de sakte ho.

    strict=True (comparison mode — 2+ documents):
      Koi outside/general knowledge allowed NAHI. Sirf jo documents mein
      likha hai wahi bolna hai — comparison mein hallucination sabse
      risky hota hai isliye yahan zero-tolerance rakha hai.
    """
    doc_labels = doc_labels or {}

    # Compare-mode mein har chunk ke sath [Document Name — Page X] tag lagao,
    # taaki LLM attribute kar sake ki kaunsi baat kis document se aayi.
    if strict and relevant_metadata:
        context_blocks = []
        for text, meta in zip(relevant_chunks, relevant_metadata):
            doc_id = meta.get("document_id", "")
            label = doc_labels.get(doc_id, doc_id or "Document")
            page = meta.get("page", "?")
            context_blocks.append(f"[{label} — Page {page}]\n{text}")
        context = "\n\n---\n\n".join(context_blocks)
    else:
        context = "\n\n---\n\n".join(relevant_chunks)

    history_text = ""
    if history:
        turns = []
        for msg in history[-6:]:
            speaker = "User" if msg.get("role") == "user" else "Assistant"
            turns.append(f"{speaker}: {msg.get('text', '')}")
        history_text = "\n".join(turns)

    if strict:
        instructions = """Answer strictly and only using the context provided below, which contains excerpts from MULTIPLE documents being compared.

            CRITICAL RULE: Do NOT introduce any fact, name, number, or claim that is not explicitly present in the context below — even if you are confident it's correct from your own general knowledge. If a document's context doesn't mention something, explicitly say that document does not cover it.

            REASONING IS ALLOWED: You MAY analyze, weigh, and compare the facts that ARE present in the context to form a judgment or recommendation (e.g. "which one is better for X", "what's the key difference"). This is not outside knowledge — it's reasoning over the given facts, and you should do it confidently when the context supports a conclusion. Only avoid concluding when the context genuinely lacks enough facts to support any judgment either way — in that case, say so explicitly instead of guessing.

            When comparing, clearly attribute which point came from which document (the context blocks are tagged with [Document Name — Page X])."""
    else:
        instructions = """Answer the question about this document.

            STEP 1 — Check the context below. If it contains the answer (fully or partially), answer using ONLY that context. Treat it as ground truth.

            STEP 2 — If the context does NOT contain the answer, you may add general knowledge on the topic — but clearly label it so it's never confused with the document's content. Use exactly this structure when this happens:

            📄 **From the document:** <relevant info, or "The document does not cover this.">

            💡 **Additional context (general knowledge, not from this document):** <your own knowledge>

            Never blend the two together unlabeled."""

    prompt = f"""{instructions}

            Formatting rules:
            - Wrap key words/phrases/numbers/names in **double asterisks**.
            - Don't bold entire sentences.

            Context:
            {context}
            """

    if history_text:
        prompt += f"""
            Previous conversation:
            {history_text}
            """

    prompt += f"""
            Question:
            {question}
            """
    return prompt


async def stream_answer(
    question: str,
    document_ids: list[str],
    graph_state: dict,
    db: Session,
    doc_labels: dict[str, str] | None = None,
):
    mode = graph_state.get("mode", "single")
    # ChatMessage schema per-document hai — compare-mode mein history
    # pehle document ke thread mein anchor kar dete hain (simplification).
    anchor_document_id = document_ids[0]

    if not graph_state.get("is_relevant"):
        message = "This information was not found in the document(s)."
        yield {"data": json.dumps({"token": message})}
        yield {"data": json.dumps({"citations": []})}
        yield {"data": json.dumps({"done": True, "chunk_used": 0})}

        save_message(db, anchor_document_id, role="user", text=question)
        save_message(db, anchor_document_id, role="assistant", text=message, citations=[])
        return

    history = graph_state.get("history", [])
    cache_key = answer_cache_key(document_ids, question, mode)

    cached = cache_get(cache_key)
    if cached:
        logger.info(f"QA CACHE HIT | mode={mode} | docs={document_ids}")

        cached_answer = cached["answer"]
        chunk_size = 8
        for i in range(0, len(cached_answer), chunk_size):
            yield {"data": json.dumps({"token": cached_answer[i:i + chunk_size]})}
            await asyncio.sleep(0.01)

        yield {"data": json.dumps({"citations": cached["citations"]})}
        yield {"data": json.dumps({"suggestions": cached.get("suggestions", [])})}
        yield {"data": json.dumps({"done": True, "chunk_used": len(cached["citations"]), "cached": True})}

        save_message(db, anchor_document_id, role="user", text=question)
        save_message(db, anchor_document_id, role="assistant", text=cached_answer, citations=cached["citations"])
        return

    logger.info(f"QA CACHE MISS | mode={mode} | docs={document_ids}")
    prompt = graph_state["prompt"]
    relevant_chunks = graph_state["chunks"]
    relevant_metadata = graph_state["metadata"]
    full_answer = ""

    try:
        response = genai_client.models.generate_content_stream(model=CHAT_MODEL, contents=prompt)
        for chunk in response:
            if chunk.text:
                full_answer += chunk.text
                yield {"data": json.dumps({"token": chunk.text})}
    except Exception:
        logger.exception("LLM streaming failed!")
        error_message = "Sorry, something went wrong while generating the answer. Please try again!"
        yield {"data": json.dumps({"error": error_message})}

        save_message(db, anchor_document_id, role="user", text=question)
        save_message(db, anchor_document_id, role="assistant", text=full_answer if full_answer else error_message, citations=[])
        return

    citations = [
        {
            "chunk_index": i,
            "page": meta.get("page"),
            "section": meta.get("section"),
            "document_id": meta.get("document_id"),
            "document_label": (doc_labels or {}).get(meta.get("document_id"), meta.get("document_id")),
            "preview": (doc[:180].strip() + "..." if len(doc) > 180 else doc.strip()),
            "text": doc.strip(),
        }
        for i, (doc, meta) in enumerate(zip(relevant_chunks, relevant_metadata))
    ]

    yield {"data": json.dumps({"citations": citations})}

    suggestions = generate_follow_up_questions(question, full_answer, relevant_chunks)
    yield {"data": json.dumps({"suggestions": suggestions})}

    yield {"data": json.dumps({"done": True, "chunk_used": len(relevant_chunks)})}

    cache_set(cache_key, {"answer": full_answer, "citations": citations, "suggestions": suggestions}, ANSWER_CACHE_TTL)
    save_message(db, anchor_document_id, role="user", text=question)
    save_message(db, anchor_document_id, role="assistant", text=full_answer, citations=citations)