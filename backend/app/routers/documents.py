from fastapi import APIRouter, HTTPException, Depends
from app.core.clients import collection
from app.core.auth import get_current_user

import os
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.registry import get_document, get_allDocs, delete_document, get_message 

from app.core.cache import cache_get, cache_set, cache_delete_pattern, documents_list_cache_key 
from app.core.config import DOCUMENTS_LIST_CACHE_TTL

router = APIRouter()
UPLOAD_DIR = "uploaded_files"

@router.get("/documents")
def listDocuments(db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    cache_key = documents_list_cache_key(user_id)

    cached = cache_get(cache_key)
    if cached is not None:
        print(f"🟢 DOCUMENTS CACHE HIT | user={user_id}")
        return {"documents": cached}

    print(f"🔴 DOCUMENTS CACHE MISS | user={user_id}")

    docs = get_allDocs(db, user_id)
    result = [d.to_dict() for d in docs]

    cache_set(cache_key, result, DOCUMENTS_LIST_CACHE_TTL)
    print(f"💾 DOCUMENTS SAVED TO CACHE | user={user_id}")
    return {"documents": result}


@router.delete("/documents/{document_id}")
def DeleteDocuments(document_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    doc = get_document(db, document_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    existing = collection.get(where={"document_id": document_id}, include=[])
    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    delete_document(db, document_id, user_id)

    delete_document(db, document_id, user_id)
    cache_delete_pattern(documents_list_cache_key(user_id))   # NAYA — cache turant invalidate
    print(
        f"🗑️ DOCUMENTS CACHE INVALIDATED | "
        f"user={user_id} | document={document_id}"
    )

    return {"status": "deleted", "document_id": document_id}


@router.get("/documents/{document_id}/messages")
def get_doc_msg(document_id: str, db: Session = Depends(get_db), user_id: str = Depends(get_current_user)):
    doc = get_document(db, document_id, user_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    messages = get_message(db, document_id)
    return {"messages": [m.to_dict() for m in messages]}
