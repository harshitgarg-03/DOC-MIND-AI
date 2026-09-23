import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY missing in environment — check your .env file")

CHROMA_PATH = "./chroma_db"
EMBEDDING_MODEL = "gemini-embedding-2"
# CHAT_MODEL = "gemini-3.1-flash-lite"  # verify actual model name against Gemini docs
CHAT_MODEL = "gemini-2.5-flash"
MAX_CONTEXT_CHUNKS = 7
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

DISTANCE_THRESHOLD = 1.15

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
EMBEDDING_CACHE_TTL = 60 * 60 * 24 * 30 # again pdf upload k liye 30 days
ANSWER_CACHE_TTL = 60 * 60 * 6 # 6 hours answer k 
DOCUMENTS_LIST_CACHE_TTL = 60 * 2  # 2 mins k liye 
