from google import genai
import chromadb
from chromadb.utils import embedding_functions

from app.core.config import GEMINI_API_KEY, CHROMA_PATH, EMBEDDING_MODEL

genai_client = genai.Client(api_key=GEMINI_API_KEY)

embedder = embedding_functions.GoogleGeminiEmbeddingFunction(
    model_name=EMBEDDING_MODEL,
    task_type="RETRIEVAL_DOCUMENT",
)

def embed_texts_individually(texts: list[str]) -> list[list[float]]:
    """Chroma ke embedding_function ka multi-text batching buggy hai —
    ek call mein 3+ texts dene par kam embeddings wapas aate hain.
    Isliye har text ka embedding alag call mein banate hain."""
    embeddings = []
    for text in texts:
        result = embedder([text])   # ek baar mein sirf 1 text
        embeddings.append(result[0])
    return embeddings

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = chroma_client.get_or_create_collection(
    name="pdf_chunks",
    embedding_function=embedder,
)