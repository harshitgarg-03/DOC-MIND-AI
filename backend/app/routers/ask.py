import json
from fastapi import APIRouter, Form
from sse_starlette.sse import EventSourceResponse

from app.services.qa_service import retrieve_relevant_chunks, stream_answer

router = APIRouter()


@router.post("/ask")
def ask_question(question: str = Form(...), document_id: str = Form(...)):
    result = retrieve_relevant_chunks(question, document_id)

    if result is None:
        async def error_gen():
            yield {"data": json.dumps({"error": "phle pdf upload kro .!"})}
        return EventSourceResponse(error_gen())

    relevant_chunks, relevant_metadata = result
    return EventSourceResponse(stream_answer(question, relevant_chunks, relevant_metadata))