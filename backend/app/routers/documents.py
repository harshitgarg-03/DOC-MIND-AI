from fastapi import APIRouter, HTTPException
from app.core.clients import collection

from app import state

router = APIRouter()


@router.get("/documents")
def listDocuments():
    return {"documents": (list(state.documents_registry.values()))}


@router.delete("/documents/{document_id}")
def DeleteDocuments(document_id: str):
    if document_id not in state.documents_registry:
        raise HTTPException(status_code=404, detail="Document not found")

    existing = collection.get(where={"document_id": document_id}, include=[])

    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    del state.documents_registry[document_id]
    return {"status": "deleted", "document_id": document_id}
