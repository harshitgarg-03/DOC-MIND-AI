import json
from fastapi import APIRouter, Form, Depends
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from app.core.database import get_db

from app.core.clients import collection
from app.services.qa_service import stream_answer
from app.services.rag_graph import rag_graph

router = APIRouter()


@router.post("/ask")
def ask_question(question: str = Form(...), document_id: str = Form(...), history: str = Form("[]"), db: Session = Depends(get_db)):
    try:
        parsed_history = json.loads(history)
    except (json.JSONDecodeError, TypeError):
        parsed_history = []


    result = collection.get(where={"document_id": document_id}, include=[])

    total_chunks = len(result["ids"])
    if total_chunks == 0:
        async def error_gen():
            yield {"data": json.dumps({"error": "Document not found or has no chunks."})}
        return EventSourceResponse(error_gen())


    graph_state = rag_graph.invoke({
        "question": question,
        "document_id": document_id,
        "history": parsed_history,
    })

    return EventSourceResponse(stream_answer(question, document_id, graph_state, db))