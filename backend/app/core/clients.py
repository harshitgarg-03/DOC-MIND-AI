from google import genai
import chromadb
from chromadb.utils import embedding_functions

from app.core.config import GEMINI_API_KEY, CHROMA_PATH, EMBEDDING_MODEL

genai_client = genai.Client(api_key=GEMINI_API_KEY)

embedder = embedding_functions.GoogleGeminiEmbeddingFunction(
    model_name=EMBEDDING_MODEL,
    task_type="RETRIEVAL_DOCUMENT",
)

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = chroma_client.get_or_create_collection(
    name="pdf_chunks",
    embedding_function=embedder,
)