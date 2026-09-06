import json
from fastapi import APIRouter, Form, Depends
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from app.core.database import get_db

from app.services.qa_service import retrieve_relevant_chunks, stream_answer

router = APIRouter()


@router.post("/ask")
def ask_question(question: str = Form(...), document_id: str = Form(...), history: str = Form("[]"), db: Session = Depends(get_db)):
    try:
        parsed_history = json.loads(history)
    except (json.JSONDecodeError, TypeError):
        parsed_history = []

    result = retrieve_relevant_chunks(question, document_id, parsed_history)

    if result is None:
        async def error_gen():
            yield {"data": json.dumps({"error": "phle pdf upload kro .!"})}
        return EventSourceResponse(error_gen())

    relevant_chunks, relevant_metadata = result
    return EventSourceResponse(stream_answer(question, relevant_chunks, relevant_metadata, parsed_history, document_id, db))