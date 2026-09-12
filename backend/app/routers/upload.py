import uuid
import logging

from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.registry import add_document
from app.core.clients import collection, embed_texts_individually
from app.services.pdf_extractor import extract_pages
from app.services.chunker import chunk_with_metadata
from app.models.schemas import UploadResponse


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
def upload_pdf(file: UploadFile = File(...), db:Session = Depends(get_db)):

    # File type check
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")


    document_id = str(uuid.uuid4())
    try:
        reader = PdfReader(file.file)
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

    chunk_data = chunk_with_metadata(pages)

    if not chunk_data:
        raise HTTPException(status_code=400, detail="Could not generate any chunks from this document.")

    documents = [c["text"] for c in chunk_data]

    metadatas = [
        {"page": c["page"], "section": c["section"], "document_id": document_id}
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

    add_document(
        db,
        document_id=document_id,
        filename=file.filename,
        total_pages=len(pages),
        total_chunks=len(chunk_data),
    )

    return {
        "status": "success",
        "document_id": document_id,
        "filename": file.filename,
        "characters_extracted": len(full_text),
        "total_pdf_chunks": len(chunk_data),
        "total_pages": len(pages),
    }