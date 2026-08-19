from fastapi import APIRouter, File, UploadFile
from pypdf import PdfReader

from app.core.clients import collection
from app.services.pdf_extractor import extract_pages
from app.services.chunker import chunk_with_metadata
from app.models.schemas import UploadResponse
from app import state

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
def upload_pdf(file: UploadFile = File(...)):
    reader = PdfReader(file.file)

    pages = extract_pages(reader)
    state.pdf_text_store = "".join(text for _, text in pages)

    chunk_data = chunk_with_metadata(pages)
    state.pdf_chunks = [c["text"] for c in chunk_data]

    existing = collection.get(include=[])
    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    collection.add(
        documents=[c["text"] for c in chunk_data],
        metadatas=[{"page": c["page"], "section": c["section"]} for c in chunk_data],
        ids=[f"chunk_{i}" for i in range(len(chunk_data))],
    )

    return {
        "status": "success",
        "characters_extracted": len(state.pdf_text_store),
        "total_pdf_chunks": len(state.pdf_chunks),
        "total_pages": len(pages),
    }