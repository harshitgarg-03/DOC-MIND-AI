from pydantic import BaseModel


class UploadResponse(BaseModel):
    status: str
    characters_extracted: int
    total_pdf_chunks: int
    total_pages: int


class DebugChunk(BaseModel):
    id: str
    page: int
    section: str
    preview: str


class DebugMetadataResponse(BaseModel):
    total_chunks: int
    chunks: list[DebugChunk]