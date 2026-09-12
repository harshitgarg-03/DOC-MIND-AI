import json
from app.core.clients import genai_client
from app.core.config import CHAT_MODEL, MAX_CONTEXT_CHUNKS
from app.core.registry import save_message
from sqlalchemy.orm import Session

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

      prompt = graph_state["prompt"]
      relevant_chunks = graph_state["chunks"]
      relevant_metadata = graph_state["metadata"]
      full_answer = ""

      response = genai_client.models.generate_content_stream(model=CHAT_MODEL, contents=prompt)  

      for chunk in response:
            if chunk.text:
                  full_answer += chunk.text
                  yield {"data": json.dumps({"token": chunk.text})}

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

      save_message(db, document_id, role="user", text=question)
      save_message(db, document_id, role="assistant", text=full_answer, citations=citations)           
    