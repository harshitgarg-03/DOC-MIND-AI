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

def generate_follow_up_questions(question: str, answer: str, relevant_chunks: list[str]) -> list[str] :
     """Answer ke baad 3 chhote follow-up questions generate karta hai
    (ChatGPT/Claude jaisa 'suggested next questions'). Fast rakhne ke
    liye non-streaming call, context truncate karke."""

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
        logger.info(f"QA CACHE HIT for document {document_id}")

        cached_answer = cached["answer"]
        chunk_size = 8
        for i in range(0, len(cached_answer), chunk_size):
            yield {"data": json.dumps({"token": cached_answer[i:i + chunk_size]})}
            await asyncio.sleep(0.01)

        yield {"data": json.dumps({"citations": cached["citations"]})}
        yield {"data": json.dumps({"suggestions": cached.get("suggestions", [])})}
        yield {"data": json.dumps({"done": True, "chunk_used": len(cached["citations"]), "cached": True})}

        save_message(db, document_id, role="user", text=question)
        save_message(db, document_id, role="assistant", text=cached_answer, citations=cached["citations"])
        return

    logger.info(f"QA CACHE MISS for document {document_id}")
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

    suggestions = generate_follow_up_questions(question, full_answer, relevant_chunks) 
    yield {"data": json.dumps({"suggestions": suggestions})}

    yield {"data": json.dumps({"done": True, "chunk_used": len(relevant_chunks)})}

    cache_set(cache_key, {"answer": full_answer, "citations": citations, "suggestions": suggestions}, ANSWER_CACHE_TTL)
    save_message(db, document_id, role="user", text=question)
    save_message(db, document_id, role="assistant", text=full_answer, citations=citations)