# import os
# import re
# from fastapi import FastAPI, File, UploadFile, Form
# from dotenv import load_dotenv
# from pypdf import PdfReader
# from google import genai
# from fastapi.middleware.cors import CORSMiddleware
# import numpy as np
# import chromadb
# from chromadb.utils import embedding_functions
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from sse_starlette.sse import EventSourceResponse
# import json

# load_dotenv()

# client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# app = FastAPI()

# app.add_middleware(CORSMiddleware, allow_origins="*", allow_headers="*", allow_methods="*")

# embedder = embedding_functions.GoogleGeminiEmbeddingFunction(
#     model_name="gemini-embedding-001",
#     task_type="RETRIEVAL_DOCUMENT"
# )

# chroma_client = chromadb.PersistentClient(path="./chroma_db") # ye local disk p save krega 

# collection = chroma_client.get_or_create_collection(name="pdf_chunks", embedding_function=embedder)

# def chunk_text(text: str): # chunk func

#     splitter = RecursiveCharacterTextSplitter(
#         chunk_size = 1000,
#         chunk_overlap = 150,
#         separators=["\n\n", "\n", ". ", " ", ""],
#     )
#     return splitter.split_text(text)


# def extract_pages(reader: PdfReader):
#     """Har page ka text alag-alag rakhta hai, taaki page number track ho sake."""
#     pages = []
#     for i, page in enumerate(reader.pages):
#         page_text = page.extract_text() or ""
#         pages.append((i + 1, page_text))  # page numbers 1-indexed
#     return pages

# HEADING_PATTERN = re.compile(
#     r"^[A-Z][A-Za-z\s&/\-]{2,40}$"
# )

# def split_into_sections(page_text: str, current_title: str = "General"):
#     """Ek page ke text ko (section_title, section_text) pairs mein todta hai."""
#     lines = page_text.split("\n")
#     sections = []
#     current_lines = []

#     for line in lines:
#         stripped = line.strip()
#         is_heading = (
#             stripped
#             and HEADING_PATTERN.match(stripped)
#             and len(stripped.split()) <= 6
#         )
#         if is_heading:
#             if current_lines:
#                 sections.append((current_title, "\n".join(current_lines)))
#             current_title = stripped.title()
#             current_lines = []
#         else:
#             current_lines.append(line)

#     if current_lines:
#         sections.append((current_title, "\n".join(current_lines)))

#     return sections, current_title


# def chunk_with_metadata(pages: list[tuple[int, str]]):
#     """
#     pages: [(page_number, page_text), ...]
#     Returns: [{"text":..., "page":..., "section":...}, ...]

#     Chunk boundaries page ke andar hi rehte hain (koi chunk do pages ko span
#     nahi karta) — isse page number attribution hamesha sahi rehta hai.
#     """
#     splitter = RecursiveCharacterTextSplitter(
#         chunk_size=800,
#         chunk_overlap=100,
#         separators=["\n\n", "\n", ". ", " ", ""],
#     )

#     chunks = []
#     current_title = "General"
#     for page_num, page_text in pages:
#         if not page_text.strip():
#             continue

#         sections, current_title = split_into_sections(
#             page_text,
#             current_title
#         )

#         for section_title, section_text in sections:
#             if not section_text.strip():
#                 continue

#             for piece in splitter.split_text(section_text):
#                 if piece.strip():
#                     chunks.append({
#                         "text": piece,
#                         "page": page_num,
#                         "section": section_title,
#                     })

#     return chunks

# pdf_text_store=""
# pdf_chunks = []
# chunk_embedding = []

# @app.post("/upload")
# def upload_pdf(file: UploadFile = File(...)):
#     global pdf_text_store, pdf_chunks, chunk_embedding

#     # print("uplaod file is ::: ", file, file.filename)
#     reader = PdfReader(file.file)

#     # Page-wise extraction — taaki har chunk ka page number pata rahe
#     pages = extract_pages(reader)
#     pdf_text_store = "".join(text for _, text in pages)

#     # Metadata-aware chunking — har chunk ke saath page + section milta hai
#     chunk_data = chunk_with_metadata(pages)
#     pdf_chunks = [c["text"] for c in chunk_data]  # backward compat (/chunks endpoint)

#     # print(f"pdf chunks are {pdf_chunks}")

#     existing = collection.get(include=[]) # newly fresh
#     if(existing["ids"]): 
#         collection.delete(ids = existing["ids"])

#     collection.add(
#         documents=[c["text"] for c in chunk_data],
#         metadatas=[{"page": c["page"], "section": c["section"]} for c in chunk_data],
#         ids=[f"chunk_{i}" for i in range(len(chunk_data))]
#     )
#     return {"status": "success", "characters_extracted": len(pdf_text_store), "total pdf_chunks": len(pdf_chunks), "total_pages": len(pages)}  

# @app.get("/debug-metadata")
# async def debug_metadata():
#     """Chroma mein saved har chunk ka page + section metadata dikhata hai —
#     sirf verification ke liye, production mein iski zaroorat nahi."""
#     total = collection.count()
#     if total == 0:
#         return {"error": "phle pdf upload kro .!"}

#     data = collection.get(include=["documents", "metadatas"])

#     chunks = []
#     for id_, doc, meta in zip(data["ids"], data["documents"], data["metadatas"]):
#         chunks.append({
#             "id": id_,
#             "page": meta.get("page"),
#             "section": meta.get("section"),
#             "preview": doc[:100],
#         })

#     # Page number ke hisaab se sort taaki dekhna aasan ho
#     chunks.sort(key=lambda c: c["page"])

#     return {"total_chunks": total, "chunks": chunks}

# @app.post("/ask")
# def ask_question(question: str = Form(...)):
#     total_chunks = collection.count()
#     if(total_chunks == 0):
#         async def error_gen():
#             yield {"data": json.dumps({"error": "phle pdf upload kro .!"})} 
#         return EventSourceResponse(error_gen())

#     Max_chunks = 7

#     n = min(total_chunks, Max_chunks)
#     results = collection.query(
#         query_texts=[question],
#         n_results=n,
#     )
# # mujhe yahan threshold lgana h distance k base pr 
#     relevant_chunks = results["documents"][0]
#     relevant_metadata = results["metadatas"][0]
#     context = "\n\n---\n\n".join(relevant_chunks)
#     prompt = f"""Answer the question based on the context provided below. If the answer is not available in the context, say "This information was not found in the document."

# Context:
# {context}

# Question:
# {question}
# """

#     async def event_generator():

#         response = client.models.generate_content_stream(
#                 model="gemini-3.1-flash-lite",
#                 contents=prompt
#             )

#         # print("response is :: ", response)
#         for chunk in response:
#             if chunk.text:
#                 yield {
#                     "data": json.dumps({"token": chunk.text})
#                 }

#         citations = [
#             {
#                 "chunk_index": i,
#                 "page": meta.get("page"),
#                 "section": meta.get("section"),
#                 "preview": (
#                     doc[:180].strip() + "..."
#                     if len(doc) > 180
#                     else doc.strip()
#                 ),
#             }
#             for i, (doc, meta) in enumerate(zip(relevant_chunks, relevant_metadata))
#         ]

#         yield {
#             "data": json.dumps({"citations": citations})
#         }

#         yield {
#             "data": json.dumps({
#                 "done": True,
#                 "chunk used ": len(relevant_chunks)
#             })
#         } 
#     return EventSourceResponse(event_generator())






from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, ask, documents

app = FastAPI(title="PDF Analyzer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)

app.include_router(upload.router)
app.include_router(ask.router)
app.include_router(documents.router)