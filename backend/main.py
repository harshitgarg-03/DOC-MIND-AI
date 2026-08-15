import os
from fastapi import FastAPI, File, UploadFile, Form
from dotenv import load_dotenv
from pypdf import PdfReader
from google import genai
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import chromadb
from chromadb.utils import embedding_functions
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sse_starlette.sse import EventSourceResponse
import json

# from chromadb.utils.embedding_functions import GoogleGenerativeAiEmbeddingFunction
load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins="*", allow_headers="*", allow_methods="*")

embedder = embedding_functions.GoogleGeminiEmbeddingFunction(
    model_name="gemini-embedding-001",
    task_type="RETRIEVAL_DOCUMENT"
)

chroma_client = chromadb.PersistentClient(path="./chroma_db") # ye local disk p save krega 

collection = chroma_client.get_or_create_collection(name="pdf_chunks", embedding_function=embedder)

def chunk_text(text: str): # chunk func
    # chunks = []
    # start = 0;

    splitter = RecursiveCharacterTextSplitter(
        chunk_size = 1000,
        chunk_overlap = 150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    # while(start < len(text)):
    #     end = start + chunk_size;
    #     chunk = text[start: end]
    #     chunks.append(chunk)
    #     start = end-overlap;

    return splitter.split_text(text)
    # return chunks

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

    # print(f"pdf chunks are {pdf_chunks}")

    existing = collection.get() # newly fresh
    if(existing["ids"]):
        collection.delete(ids = existing["ids"])

    collection.add(
        documents=pdf_chunks,
        ids=[f"chunk_{i}" for i in range(len(pdf_chunks))]
    )

    # for each chunk,  embedding occurs 
    # for c in pdf_chunks: # this part should be optimize each chunk hits api again and again 
    #     emb = get_embeedings(c);
    #     chunk_embedding.append(emb);
    

    return {"status": "success", "characters_extracted": len(text), "total pdf_chunks": len(pdf_chunks)}  

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
    total_chunks = collection.count()
    if(total_chunks == 0):
        async def error_gen():
            yield {"data": json.dumps({"error": "phle pdf upload kro .!"})} 
        return EventSourceResponse(error_gen())

    Max_chunks = 7

    n = min(total_chunks, Max_chunks)
    results = collection.query(
        query_texts=[question],
        n_results=n,
    )
# mujhe yahan threshold lgana h distance k base pr 
    relevant_chunks = results["documents"][0]
    context = "\n\n---\n\n".join(relevant_chunks)

    prompt = f"""Answer the question based on the context provided below. If the answer is not available in the context, say "This information was not found in the document."

Context:
{context}

Question:
{question}
"""

    async def event_generator():

        response = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=prompt
            )

        # print("response is :: ", response)
        for chunk in response:
            if chunk.text:
                yield {
                    "data": json.dumps({"token": chunk.text})
                }

        yield {
            "data": json.dumps({
                "done": True,
                "distance values ": results["distances"][0],
                "chunk used ": len(relevant_chunks)
            })
        } 
    return EventSourceResponse(event_generator())


# @app.post("/ask") here manula embedding 
# async def ask_question(question: str = Form(...)):
#     if not chunk_embedding:
#         return {"error": "phle pdf upload kro.!"}

#     question_embedding = get_embeedings(question)

#     scores = []

#     for i, emb in enumerate(chunk_embedding):
#         score = cosine_similarity(question_embedding, emb)
#         scores.append((score, i))

#     scores.sort(reverse=True)

#     top_chunk_idx = [i for _, i in scores[:3]] # here top 3 chunks idx 
#     context = "\n\n---\n\n".join(pdf_chunks[i] for i in top_chunk_idx)

#     prompt = f"""given the below context, just responding to user question or queery on the basis of document , if you not able to find any question then repond to user like this information not found on this document .Context: {context}  question: {question}"""

#     response = client.models.generate_content(
#         model="gemini-2.5-flash",
#         contents=prompt
#     )

#     return{
#         "ai answer": response.text
#     }

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



