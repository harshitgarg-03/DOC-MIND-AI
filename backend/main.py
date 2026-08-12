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

def chunk_text(text: string, chunk_size: int = 1000, overlap: int = 150):
    chunks = []
    start = 0;

    while(start < len(text)):
        end = start + chunk_size;
        chunk = text[start: end]
        chunks.append(chunk)
        start += end-overlap;

    return chunks;


pdf_text_store=""

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global pdf_text_store

    # print("uplaod file is ::: ", file, file.filename)
    reader = PdfReader(file.file)
    text=""
    for page in reader.pages:
        text += page.extract_text() or ""

    pdf_text_store = text

    return {"status": "success", "characters_extracted": len(text)}  

@app.post("/ask")
async def ask_questions(question: str = Form(...)):
    if not pdf_text_store:
        return {"error": "Pehle PDF upload karo"}

    prompt= f"""give the answer or query resolves on the basis of below documents .

    Document: {pdf_text_store[:60]} 

    question : {question}
     
       """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return {"answer": response.text}



