import math
import random
import threading
import time
from collections import deque

from google import genai
from google.genai import types
import chromadb
from chromadb.utils import embedding_functions

from app.core.config import (
    GEMINI_API_KEY,
    CHROMA_PATH,
    EMBEDDING_MODEL,
    EMBEDDING_CACHE_TTL,
)
from app.core.cache import cache_get, cache_set, embedding_cache_key

genai_client = genai.Client(api_key=GEMINI_API_KEY)

# Chroma still uses this for query-time embeddings (one string -> one vector).
embedder = embedding_functions.GoogleGeminiEmbeddingFunction(
    model_name=EMBEDDING_MODEL,
    task_type="RETRIEVAL_DOCUMENT",
)

EMBED_BATCH_SIZE = 30              # texts per Gemini request
EMBED_TEXTS_PER_MINUTE = 90        # stay under the ~100 texts/min free-tier limit
                                   # (raise this a lot if you enable billing)
QUOTA_WAIT_SECONDS = 65            # fallback wait if a 429 still happens
MAX_QUOTA_RETRIES = 3
MAX_TRANSIENT_RETRIES = 4

_sent: deque = deque()             # (timestamp, n_texts) sent in the last 60s
_lock = threading.Lock()


class EmbeddingShapeError(Exception):
    """Gemini returned a different number of vectors than texts sent.
    Deterministic, so it is never retried."""


def _throttle(n_texts: int) -> None:
    """Block until sending n_texts keeps us under EMBED_TEXTS_PER_MINUTE."""
    while True:
        with _lock:
            now = time.time()
            while _sent and now - _sent[0][0] >= 60:
                _sent.popleft()

            used = sum(count for _, count in _sent)

            if used + n_texts <= EMBED_TEXTS_PER_MINUTE or not _sent:
                _sent.append((now, n_texts))
                return

            wait = 60 - (now - _sent[0][0]) + 0.5

        print(f"🚦 THROTTLE: {used}/{EMBED_TEXTS_PER_MINUTE} texts used this minute, waiting {wait:.0f}s")
        time.sleep(max(wait, 0.5))


def _embed_batch(texts: list[str]) -> list[list[float]]:
    # One Content per text so gemini-embedding-2 returns one vector per text.
    contents = [types.Content(parts=[types.Part(text=t)]) for t in texts]

    response = genai_client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=contents,
        config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
    )

    vectors = [[float(x) for x in e.values] for e in response.embeddings]

    if len(vectors) != len(texts):
        raise EmbeddingShapeError(
            f"Gemini returned {len(vectors)} vectors for {len(texts)} texts "
            f"(model={EMBEDDING_MODEL})."
        )
    return vectors


def _is_quota_error(e: Exception) -> bool:
    msg = str(e)
    return "429" in msg or "RESOURCE_EXHAUSTED" in msg


def _embed_with_retry(texts: list[str]) -> list[list[float]]:
    quota_retries = 0
    transient_retries = 0

    while True:
        _throttle(len(texts))
        try:
            return _embed_batch(texts)

        except EmbeddingShapeError:
            raise

        except Exception as e:
            if _is_quota_error(e):
                quota_retries += 1
                if quota_retries > MAX_QUOTA_RETRIES:
                    raise RuntimeError(
                        "Gemini embedding quota exhausted. If this persists "
                        "it is likely a daily limit: check "
                        "https://ai.dev/rate-limit or enable billing. Already "
                        "embedded chunks are cached, so re-uploading resumes."
                    ) from e
                print(f"⏳ QUOTA HIT (429) — waiting {QUOTA_WAIT_SECONDS}s "
                      f"({quota_retries}/{MAX_QUOTA_RETRIES})")
                time.sleep(QUOTA_WAIT_SECONDS)

            else:
                transient_retries += 1
                if transient_retries > MAX_TRANSIENT_RETRIES:
                    print(f"❌ EMBEDDING FAILED: {e}")
                    raise
                wait = (2 ** transient_retries) + random.uniform(0, 1)
                print(f"⚠️ EMBEDDING RETRY {transient_retries}/"
                      f"{MAX_TRANSIENT_RETRIES} in {wait:.1f}s → {e}")
                time.sleep(wait)


def embed_texts_individually(texts: list[str]) -> list[list[float]]:
    """Cache lookup -> de-duplicate -> throttled batches -> cache each batch."""
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
    api_calls = math.ceil(len(pending_keys) / EMBED_BATCH_SIZE)
    est_minutes = len(pending_keys) / EMBED_TEXTS_PER_MINUTE

    print(
        f"🟢 CACHE HIT: {cache_hits}/{total} | "
        f"🔴 CACHE MISS: {total - cache_hits} ({len(pending_keys)} unique) | "
        f"📡 Gemini calls: {api_calls} | ⏱️ est. {est_minutes:.1f} min"
    )

    new_embeddings: dict[str, list[float]] = {}

    for call_no, start in enumerate(range(0, len(pending_keys), EMBED_BATCH_SIZE), 1):
        batch_keys = pending_keys[start:start + EMBED_BATCH_SIZE]
        batch_texts = [pending[k] for k in batch_keys]

        print(f"🔄 EMBEDDING CALL {call_no}/{api_calls} ({len(batch_texts)} texts)")

        vectors = _embed_with_retry(batch_texts)

        for key, vector in zip(batch_keys, vectors):
            new_embeddings[key] = vector
            cache_set(key, vector, EMBEDDING_CACHE_TTL)

    for i, key in enumerate(keys):
        if results[i] is None:
            results[i] = new_embeddings[key]

    print(f"🎉 EMBEDDING COMPLETE: {len(results)}/{total}")
    return results


chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

collection = chroma_client.get_or_create_collection(
    name="pdf_chunks",
    embedding_function=embedder,
)