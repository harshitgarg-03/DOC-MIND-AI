import math
import os
import time

from google import genai
import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from fastembed import TextEmbedding

from app.core.config import (
    GEMINI_API_KEY,
    CHROMA_PATH,
    COLLECTION_NAME,
    LOCAL_EMBEDDING_MODEL,
    EMBEDDING_CACHE_TTL,
)
from app.core.cache import cache_get, cache_set, embedding_cache_key

# Gemini is still used for chat / answer generation only.
genai_client = genai.Client(api_key=GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# Local embeddings (fastembed / ONNX) — no API calls, no rate limit.
# Model is downloaded once on first run and cached on disk.
# ---------------------------------------------------------------------------
print(f"🧠 Loading local embedding model: {LOCAL_EMBEDDING_MODEL}")
# Ryzen 5 7520U = 4 physical cores / 8 threads. ONNX runs best with physical cores.
EMBED_THREADS = int(os.getenv("EMBED_THREADS", "4"))
_local_model = TextEmbedding(model_name=LOCAL_EMBEDDING_MODEL, threads=EMBED_THREADS)
print(f"🧵 fastembed threads: {EMBED_THREADS}")

LOCAL_BATCH_SIZE = 32


def _embed_documents(texts: list[str]) -> list[list[float]]:
    """passage_embed adds the right document prefix for models that need it."""
    return [v.tolist() for v in _local_model.passage_embed(texts, batch_size=LOCAL_BATCH_SIZE)]


def _embed_queries(texts: list[str]) -> list[list[float]]:
    """query_embed adds the right query prefix for models that need it."""
    return [v.tolist() for v in _local_model.query_embed(texts)]


class LocalEmbedder(EmbeddingFunction):
    """Chroma calls this at QUERY time (collection.query(query_texts=[...]))."""

    def __init__(self):
        pass

    def __call__(self, input: Documents) -> Embeddings:
        return _embed_queries(list(input))

    @staticmethod
    def name() -> str:
        return "local_fastembed"

    def get_config(self) -> dict:
        return {"model": LOCAL_EMBEDDING_MODEL}

    @staticmethod
    def build_from_config(config: dict) -> "LocalEmbedder":
        return LocalEmbedder()

    def default_space(self):
        return "cosine"

    def supported_spaces(self):
        return ["cosine", "l2", "ip"]


embedder = LocalEmbedder()


def embed_texts_individually(texts: list[str]) -> list[list[float]]:
    """Same signature as before so upload.py needs no change.
    Redis cache lookup -> de-duplicate -> local embed -> cache."""
    total = len(texts)
    print(f"📄 Total chunks: {total}")

    keys = [embedding_cache_key(t) for t in texts]
    results: list = [None] * total

    cache_hits = 0
    for i, key in enumerate(keys):
        cached = cache_get(key)
        if cached is not None:
            results[i] = cached
            cache_hits += 1

    pending: dict[str, str] = {}
    for i, key in enumerate(keys):
        if results[i] is None and key not in pending:
            pending[key] = texts[i]

    pending_keys = list(pending.keys())
    print(
        f"🟢 CACHE HIT: {cache_hits}/{total} | "
        f"🔴 CACHE MISS: {total - cache_hits} ({len(pending_keys)} unique) | "
        f"💻 local model: {LOCAL_EMBEDDING_MODEL}"
    )

    new_embeddings: dict[str, list[float]] = {}
    t_start = time.time()

    # Embed in slices so we can print progress on big PDFs.
    SLICE = 256
    n_slices = math.ceil(len(pending_keys) / SLICE) if pending_keys else 0
    for s_no, start in enumerate(range(0, len(pending_keys), SLICE), 1):
        slice_keys = pending_keys[start:start + SLICE]
        slice_texts = [pending[k] for k in slice_keys]
        print(f"🔄 EMBEDDING {s_no}/{n_slices} ({len(slice_texts)} texts)")

        vectors = _embed_documents(slice_texts)
        if len(vectors) != len(slice_texts):
            raise RuntimeError(
                f"Embedder returned {len(vectors)} vectors for {len(slice_texts)} texts"
            )

        for key, vector in zip(slice_keys, vectors):
            new_embeddings[key] = vector
            cache_set(key, vector, EMBEDDING_CACHE_TTL)

    for i, key in enumerate(keys):
        if results[i] is None:
            results[i] = new_embeddings[key]

    elapsed = time.time() - t_start
    rate = len(pending_keys) / elapsed if elapsed > 0 else 0
    print(f"🎉 EMBEDDING COMPLETE: {len(results)}/{total} | ⏱️ {elapsed:.1f}s ({rate:.0f} chunks/sec)")
    return results


chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

# New collection name on purpose: old Gemini vectors (different dimension)
# live in "pdf_chunks" and cannot be mixed with the local model's vectors.
collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=embedder,
    configuration={"hnsw": {"space": "cosine"}},
)
