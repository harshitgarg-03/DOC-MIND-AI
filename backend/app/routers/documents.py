from fastapi import APIRouter, HTTPException, Depends
from app.core.clients import collection

from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.registry import get_document, get_allDocs, delete_document 


router = APIRouter()


@router.get("/documents")
def listDocuments(db: Session = Depends(get_db)):
    docs = get_allDocs(db)
    return {"documents": [d.to_dict() for d in docs]}


@router.delete("/documents/{document_id}")
def DeleteDocuments(document_id: str, db: Session = Depends(get_db)):

    doc = get_document(db, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    existing = collection.get(where={"document_id": document_id}, include=[])

    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    delete_document(db, document_id)
    return {"status": "deleted", "document_id": document_id}
