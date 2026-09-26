import redis
import json
import hashlib
import logging
from app.core.config import REDIS_URL

logger = logging.getLogger(__name__)

redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _hash_key(*parts: str) -> str:
    """Kisi bhi text-combination ka ek fixed-length, safe cache-key banata hai."""
    raw = "::".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def cache_get(key: str):
    """Redis se value nikalta hai — agar Redis hi down ho, poora app crash na ho,
    isliye try/except lagाya hai (cache best-effort hai, critical-path nahi)."""
    try:
        value = redis_client.get(key)
        return json.loads(value) if value else None
    except Exception:
        logger.warning("Redis GET failed — proceeding without cache", exc_info=True)
        return None

def cache_set(key: str, value, ttl_seconds: int):
    try:
        redis_client.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        logger.warning("Redis SET failed — continuing without caching", exc_info=True)

def cache_delete_pattern(pattern: str):
    """Ek pattern (jaise 'docs:user123:*') se match hone wali saari keys hataता hai."""
    try:
        for key in redis_client.scan_iter(match=pattern):
            redis_client.delete(key)
    except Exception:
        logger.warning("Redis pattern-delete failed", exc_info=True)


# SPECIFIC CACHE KEY BUILDERS 

def embedding_cache_key(text: str) -> str:
    return f"emb:{_hash_key(text)}"

def answer_cache_key(document_ids: list[str], question: str, mode: str = "single") -> str:
    """
    Cache key = mode + sorted(document_ids) + normalized question.

    Sorted isliye taaki [docA, docB] aur [docB, docA] same cache-key den
    (order matter nahi karna chahiye compare-mode mein).
    `mode` isliye key mein hai taaki agar kal same document_id single-mode
    aur compare-mode dono mein use ho, unke answers alag cache slots mein
    rahein (strict vs non-strict prompt se answer text alag hota hai).
    """
    normalized_question = question.strip().lower()
    doc_key = ",".join(sorted(document_ids))
    return f"qa:{mode}:{_hash_key(doc_key)}:{_hash_key(normalized_question)}"
def documents_list_cache_key(user_id: str) -> str:
    return f"docs:{user_id}"