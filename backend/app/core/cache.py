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

def answer_cache_key(document_id: str, question: str, history: list[dict] | None = None) -> str:
    """
    Har unique (document + question + conversation-context) combination ke
    liye alag cache-key. History badalte hi (naya follow-up-chain), naya
    key banता hai — isliye stale/wrong-context wala cached-answer kabhi
    galti se reuse nahi hoga.
    """
    normalized_question = question.strip().lower()

    if history:
        history_repr = "|".join(
            f"{m.get('role', '')}:{m.get('text', '').strip().lower()}"
            for m in history
        )
        history_hash = _hash_key(history_repr)
    else:
        history_hash = "no-history"   # fixed constant — pehla-question hamesha isी bucket mein

    return f"qa:{document_id}:{history_hash}:{_hash_key(normalized_question)}"

def documents_list_cache_key(user_id: str) -> str:
    return f"docs:{user_id}"