import os
from fastapi import FastAPI, File, UploadFile, Form
from dotenv import load_dotenv
from pypdf import PdfReader
from google import genai
from fastapi.middleware.cors import CORSMiddleware
import numpy as np

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


def get_embeedings(text: str):
    response = client.models.embed_content(model="gemini-embedding-001",
        contents=text)
    return response.embeddings[0].values


def cosine_similarity(a, b):
    a = np.array(a)
    b = np.array(b)

    return np.dot(a, b)/(np.linalg.norm(a)*np.linalg.norm(b))


pdf_text_store=""
pdf_chunks = []
chunk_embedding = []

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global pdf_text_store, pdf_chunks, chunk_embedding

    # print("uplaod file is ::: ", file, file.filename)
    reader = PdfReader(file.file)
    text=""
    for page in reader.pages:
        text += page.extract_text() or ""

    pdf_text_store = text
    pdf_chunks = chunk_text(text) # chunking occurs 

    # for each chunk,  embedding occurs 
    for c in pdf_chunks: # this part should be optimize each chunk hits api again and again 
        emb = get_embeedings(c);
        chunk_embedding.append(emb);
        

    return {"status": "success", "characters_extracted": len(text), "total pdf_chunks": len(pdf_chunks), "embedding created ": len(chunk_embedding)}  

@app.get("/test-embedding")
async def test_embeddind():
    if(not pdf_chunks):
        return{
            "error": "phle pdf upload kro .!"
        }

    sample_chunk = pdf_chunks[0]
    embedding = get_embeedings(sample_chunk)

    return {
        "chunk_preview": sample_chunk[:100],
        "embedding length": len(embedding),
        "embedding preview": embedding[:5]
    }

# @app.post("/find-similar")
# async def find_similar(question:str = Form(...)):
#     if not chunk_embedding:
#         return {
#             "error ": "phle pdf uplaod kro and then embedding func occurs "
#         }

#     question_embedding = get_embeedings(question)

#     scores = []

#     for i, emb, in enumerate(chunk_embedding):
#         score = cosine_similarity(question_embedding, emb);
#         scores.append((score, i));
# # /home/harshit-garg/Downloads/Harshit.pdf
# # curl -F "file=@/home/harshit-garg/Downloads/Harshit.pdf" http://localhost:8000/upload
#     scores.sort(reverse=True);
#     top_3 = scores[:3]

#     return {
#         "question": question,
#         "top matches ": [
#             {"score": float(s), "chunk preview": pdf_chunks[i][:150]}
#             for s, i in top_3
#         ]
#     }

@app.get("/chunks")
async def get_chunks():
    return {
        "total chunks are :: " : len(pdf_chunks),
        "preview :: ":[c[:100] for c in pdf_chunks[:5]]
    }

@app.post("/ask")
async def ask_question(question: str = Form(...)):
    if not chunk_embedding:
        return {"error": "phle pdf upload kro.!"}

    question_embedding = get_embeedings(question)

    scores = []

    for i, emb in enumerate(chunk_embedding):
        score = cosine_similarity(question_embedding, emb)
        scores.append((score, i))

    scores.sort(reverse=True)

    top_chunk_idx = [i for _, i in scores[:3]] # here top 3 chunks idx 
    context = "\n\n---\n\n".join(pdf_chunks[i] for i in top_chunk_idx)

    prompt = f"""given the below context, just responding to user question or queery on the basis of document , if you not able to find any question then repond to user like this information not found on this document .Context: {context}  question: {question}"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return{
        "ai answer": response.text
    }

    






# @app.post("/ask")  text se kaise dekhte h ya query krte h 
# async def ask_questions(question: str = Form(...)):
#     if not pdf_text_store:
#         return {"error": "Pehle PDF upload karo"}

#     prompt= f"""give the answer or query resolves on the basis of below documents .

#     Document: {pdf_text_store[:6000]} 

#     question : {question}
     
#        """

#     response = client.models.generate_content(
#         model="gemini-2.5-flash",
#         contents=prompt
#     )

#     return {"answer": response.text}



