import os
from fastapi import FastAPI, File, UploadFile, Form
from dotenv import load_dotenv
from pypdf import PdfReader
from google import genai
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins="*", allow_headers="*", allow_methods="*")

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150): # chunk func
    chunks = []
    start = 0;

    while(start < len(text)):
        end = start + chunk_size;
        chunk = text[start: end]
        chunks.append(chunk)
        start = end-overlap;

    return chunks;


pdf_text_store=""
pdf_chunks = []

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global pdf_text_store, pdf_chunks

    # print("uplaod file is ::: ", file, file.filename)
    reader = PdfReader(file.file)
    text=""
    for page in reader.pages:
        text += page.extract_text() or ""

    pdf_text_store = text
    pdf_chunks = chunk_text(text) # chunking occurs 

    return {"status": "success", "characters_extracted": len(text), "total pdf_chunks": len(pdf_chunks)}  


@app.get("/chunks")
async def get_chunks():
    return {
        "total chunks are :: " : len(pdf_chunks),
        "preview :: ":[c[:100] for c in pdf_chunks[:5]]
    }

@app.post("/ask")
async def ask_questions(question: str = Form(...)):
    if not pdf_text_store:
        return {"error": "Pehle PDF upload karo"}

    prompt= f"""give the answer or query resolves on the basis of below documents .

    Document: {pdf_text_store[:6000]} 

    question : {question}
     
       """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return {"answer": response.text}



