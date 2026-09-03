import uuid

from fastapi import APIRouter, File, UploadFile, Depends
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.registry import add_document
from app.core.clients import collection, embed_texts_individually
from app.services.pdf_extractor import extract_pages
from app.services.chunker import chunk_with_metadata
from app.models.schemas import UploadResponse



router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
def upload_pdf(file: UploadFile = File(...), db:Session = Depends(get_db)):
    document_id = str(uuid.uuid4())
    reader = PdfReader(file.file)

    pages = extract_pages(reader)
    full_text = "".join(text for _, text in pages)

    chunk_data = chunk_with_metadata(pages)
    documents = [c["text"] for c in chunk_data]

    embeddings = embed_texts_individually(documents)
    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=[
            {
                "page": c["page"],
                "section": c["section"],
                "document_id": document_id,
            }
            for c in chunk_data
        ],
        ids=[f"{document_id}_chunk_{i}" for i in range(len(chunk_data))],
    )

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