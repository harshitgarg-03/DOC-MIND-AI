import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY missing in environment — check your .env file")

CHROMA_PATH = "./chroma_db"
EMBEDDING_MODEL = "gemini-embedding-2"  # no longer used for embeddings (kept for reference)

# Local embeddings (fastembed, ONNX, no API / no rate limit).
# English PDFs : "BAAI/bge-small-en-v1.5"  (384-dim, 512 tokens, fast)
# Hindi/mixed  : "intfloat/multilingual-e5-large" (1024-dim, 512 tokens, slower, 2.2GB)
# NOTE: changing the model changes vector size -> also change COLLECTION_NAME.
LOCAL_EMBEDDING_MODEL = os.getenv("LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "pdf_chunks_local_bge_small")
# CHAT_MODEL = "gemini-3.1-flash-lite"  # verify actual model name against Gemini docs
CHAT_MODEL = "gemini-3.5-flash-lite"
MAX_CONTEXT_CHUNKS = 7
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 150

# Cosine distance (0 = identical, 2 = opposite) with the local model.
# Starting value; tune after testing (lower = stricter).
DISTANCE_THRESHOLD = 0.70

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
EMBEDDING_CACHE_TTL = 60 * 60 * 24 * 30 # again pdf upload k liye 30 days
ANSWER_CACHE_TTL = 60 * 60 * 6 # 6 hours answer k 
DOCUMENTS_LIST_CACHE_TTL = 60 * 2  # 2 mins k liye 
