import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY missing in environment — check your .env file")

CHROMA_PATH = "./chroma_db"
EMBEDDING_MODEL = "gemini-embedding-2"
CHAT_MODEL = "gemini-3.1-flash-lite"  # verify actual model name against Gemini docs

MAX_CONTEXT_CHUNKS = 7
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100