import logging

import os
import io
import hashlib

from app.core.cache import cache_delete_pattern, documents_list_cache_key

from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, Request
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.registry import add_document, get_document
from app.core.clients import collection, embed_texts_individually
from app.services.pdf_extractor import extract_pages
from app.services.chunker import chunk_with_metadata
from app.models.schemas import UploadResponse

from app.core.rate_limiter import limiter
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload", response_model=UploadResponse)
@limiter.limit("5/minute")   
def upload_pdf(request: Request, file: UploadFile = File(...), db:Session = Depends(get_db), user_id: str = Depends(get_current_user),):

    # File type check
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")


    file_bytes = file.file.read()

    # Deterministic document_id = hash(user_id + file content).
    # Same user re-uploading the exact same PDF bytes always gets the SAME
    # document_id -> we can skip re-embedding/re-storing entirely, and the
    # QA answer-cache (keyed on document_id) will actually HIT on repeat
    # questions instead of always missing because of a fresh random uuid.
    file_hash = hashlib.sha256(file_bytes).hexdigest()
    document_id = hashlib.sha256(f"{user_id}:{file_hash}".encode("utf-8")).hexdigest()[:32]

    existing_doc = get_document(db, document_id, user_id)
    if existing_doc:
        logger.info(f"Duplicate upload detected for user {user_id} — reusing document_id={document_id}")
        return {
            "status": "success",
            "document_id": existing_doc.document_id,
            "filename": existing_doc.filename,
            "characters_extracted": 0,  # not re-extracted; cached document reused
            "total_pdf_chunks": existing_doc.total_chunks,
            "total_pages": existing_doc.total_pages,
        }

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except PdfReadError:
        raise HTTPException(status_code=400, detail="This pdf is corrupted or not a valid pdf ")
    except Exception:
        logger.exception("Unexpected error while reading pdf")
        raise HTTPException(status_code=400, detail="Could not read the uploaded pdf")


    if reader.is_encrypted:
        raise HTTPException(status_code=400, detail="This pdf is password protected not supported yet!")

    try:
        pages = extract_pages(reader)
    except Exception:
        logger.exception("Text extraction failed")
        raise HTTPException(status_code=500, detail="Failed to extract text from PDF.")

    full_text = "".join(text for _, text in pages)

    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No extractable text found — this PDF might be scanned/image-based.")

    chunk_data = chunk_with_metadata(pages)

    if not chunk_data:
        raise HTTPException(status_code=400, detail="Could not generate any chunks from this document.")

    documents = [c["text"] for c in chunk_data]

    metadatas = [
        {"page": c["page"], "section": c["section"], "document_id": document_id,  "user_id": user_id}
        for c in chunk_data
    ]
    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunk_data))]

    try:
        embeddings = embed_texts_individually(documents)
    except Exception:
        logger.exception("Embedding generation failed")
        raise HTTPException(
            status_code=503,
            detail="Embedding service is currently unavailable. Please try again shortly.",
        )

    try:
        collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)
    except Exception:
        logger.exception("Chroma insert failed")
        raise HTTPException(status_code=500, detail="Failed to store document chunks.")

    # print("PRINT ARE ++++++ IN UPLOAD ", document_id, file.filename, len(chunk_data), len(pages))

    file_path = os.path.join(UPLOAD_DIR, f"{document_id}.pdf")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    
    add_document(
        db,
        document_id=document_id,
        filename=file.filename,
        total_pages=len(pages),
        total_chunks=len(chunk_data),
        user_id=user_id,
    )

    cache_delete_pattern(documents_list_cache_key(user_id))  
    return {
        "status": "success",
        "document_id": document_id,
        "filename": file.filename,
        "characters_extracted": len(full_text),
        "total_pdf_chunks": len(chunk_data),
        "total_pages": len(pages),
    }