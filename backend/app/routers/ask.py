import json
from fastapi import APIRouter, Form, Depends, Request, HTTPException
from app.core.rate_limiter import limiter
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse
from app.core.database import get_db
from app.core.auth import get_current_user

from app.core.clients import collection
from app.services.qa_service import stream_answer
from app.services.rag_graph import rag_graph
from app.core.registry import get_document

router = APIRouter()


@router.post("/ask")
@limiter.limit("15/minute")
def ask_question(
    request: Request,
    question: str = Form(...),
    document_id: str = Form(None),          # single-doc mode (backward-compatible)
    document_ids: str = Form(None),         # compare-mode: JSON array string, e.g. '["a","b"]'
    history: str = Form("[]"),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    # document_ids (multi) ko priority do, warna document_id (single) fallback
    if document_ids:
        try:
            ids = json.loads(document_ids)
            if not isinstance(ids, list) or not ids:
                raise ValueError
        except (json.JSONDecodeError, ValueError):
            async def error_gen():
                yield {"data": json.dumps({"error": "Invalid document_ids format."})}
            return EventSourceResponse(error_gen())
    elif document_id:
        ids = [document_id]
    else:
        async def error_gen():
            yield {"data": json.dumps({"error": "document_id or document_ids required."})}
        return EventSourceResponse(error_gen())

    # Ownership verify — HAR document is user ka hona chahiye
    doc_labels = {}
    for doc_id in ids:
        doc = get_document(db, doc_id, user_id)
        if not doc:
            async def error_gen():
                yield {"data": json.dumps({"error": f"Document not found: {doc_id}"})}
            return EventSourceResponse(error_gen())
        doc_labels[doc_id] = doc.filename

    try:
        parsed_history = json.loads(history)
    except (json.JSONDecodeError, TypeError):
        parsed_history = []

    # Kam se kam ek document mein chunks hone chahiye
    any_chunks = False
    for doc_id in ids:
        result = collection.get(where={"document_id": doc_id}, include=[])
        if len(result["ids"]) > 0:
            any_chunks = True
            break

    if not any_chunks:
        async def error_gen():
            yield {"data": json.dumps({"error": "Document(s) not found or have no chunks."})}
        return EventSourceResponse(error_gen())

    graph_state = rag_graph.invoke({
        "question": question,
        "document_ids": ids,
        "history": parsed_history,
        "doc_labels": doc_labels,
    })

    return EventSourceResponse(stream_answer(question, ids, graph_state, db, doc_labels))