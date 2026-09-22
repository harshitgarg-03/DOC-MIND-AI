import json
import logging

import asyncio
from app.core.clients import genai_client
from app.core.cache import cache_get, cache_set, answer_cache_key
from app.core.config import CHAT_MODEL, MAX_CONTEXT_CHUNKS, ANSWER_CACHE_TTL
from app.core.registry import save_message
from sqlalchemy.orm import Session


logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """Answer the question based on the context provided below. If the answer is not available in the context, say "This information was not found in the document."

Context:
{context}

Question:
{question}
"""

def build_prompt(question: str, relevant_chunks: list[str], history: list[dict]) -> str:
    context = "\n\n---\n\n".join(relevant_chunks)


    history_text = ""
    if history:
        turns = []
        for msg in history[-6:]:
            speaker = "User" if msg.get("role") == "user" else "Assistant"
            turns.append(f"{speaker}: {msg.get('text', '')}")
        history_text = "\n".join(turns)

    prompt = f"""Answer the question based on the context provided below. If the answer is not available in the context, say "This information was not found in the document."

            Context:
            {context}
            """

    if history_text:
                prompt += f"""
            Previous conversation (for reference, to understand follow-up questions):
            {history_text}
            """

    prompt += f"""
            Question:
            {question}
            """
    return prompt
    
async def stream_answer(question: str, document_id: str, graph_state: dict, db: Session):

    if not graph_state.get("is_relevant"):
        message = "This Information was not found in this document"
        yield {"data": json.dumps({"token": message})}
        yield {"data": json.dumps({"citations": []})}
        yield {"data": json.dumps({"done": True, "chunk_used": 0})}

        save_message(db, document_id, role="user", text=question)
        save_message(db, document_id, role="assistant", text=message, citations=[])
        return

    # BADLA — history ho ya na ho, dono cases mein cache-key ab context-aware hai
    history = graph_state.get("history", [])
    cache_key = answer_cache_key(document_id, question, history)   # history param naya

    cached = cache_get(cache_key)
    if cached:
        logger.info(f"Cache HIT for document {document_id} (history_len={len(history)})")

        cached_answer = cached["answer"]
        chunk_size = 8
        for i in range(0, len(cached_answer), chunk_size):
            yield {"data": json.dumps({"token": cached_answer[i:i + chunk_size]})}
            await asyncio.sleep(0.01)

        yield {"data": json.dumps({"citations": cached["citations"]})}
        yield {"data": json.dumps({"done": True, "chunk_used": len(cached["citations"]), "cached": True})}

        save_message(db, document_id, role="user", text=question)
        save_message(db, document_id, role="assistant", text=cached_answer, citations=cached["citations"])
        return

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

        save_message(db, document_id, role="user", text=question)
        save_message(db, document_id, role="assistant", text=full_answer if full_answer else error_message, citations=[])
        return

    citations = [
        {
            "chunk_index": i,
            "page": meta.get("page"),
            "section": meta.get("section"),
            "preview": (doc[:180].strip() + "..." if len(doc) > 180 else doc.strip()),
        }
        for i, (doc, meta) in enumerate(zip(relevant_chunks, relevant_metadata))
    ]

    yield {"data": json.dumps({"citations": citations})}
    yield {"data": json.dumps({"done": True, "chunk_used": len(relevant_chunks)})}

    # BADLA — ab hamesha cache set hoga (guard hataya), key khud context-differentiate kar देगi
    cache_set(cache_key, {"answer": full_answer, "citations": citations}, ANSWER_CACHE_TTL)

    save_message(db, document_id, role="user", text=question)
    save_message(db, document_id, role="assistant", text=full_answer, citations=citations)