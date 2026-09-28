import hashlib
import logging

from app.core.clients import genai_client
from app.core.cache import cache_get, cache_set
from app.core.config import CHAT_MODEL

logger = logging.getLogger(__name__)

RECENT_WINDOW = 6            # itne latest messages prompt mein as-is jaate hain
SUMMARY_TTL = 60 * 60 * 24   # 24 hours
MAX_MSG_CHARS = 500          # summarizer ko har message ke itne chars hi do
MAX_SUMMARY_CHARS = 1200


def _key(messages: list[dict]) -> str:
    raw = "|".join(f"{m.get('role', '')}:{m.get('text', '')}" for m in messages)
    return f"chat_summary:{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:32]}"


def _format(messages: list[dict]) -> str:
    lines = []
    for m in messages:
        who = "User" if m.get("role") == "user" else "Assistant"
        lines.append(f"{who}: {(m.get('text') or '')[:MAX_MSG_CHARS]}")
    return "\n".join(lines)


def _summarize(previous_summary: str, new_messages: list[dict]) -> str:
    prompt = f"""You maintain a running summary of a conversation between a user and an AI assistant that answers questions about uploaded PDF documents.

Update the summary so it also covers the new messages. Keep it under 150 words. Focus on: what the user has asked about, the key topics/entities discussed, and any preferences the user expressed about how they want answers. Do NOT add any fact that is not present in the conversation.

Existing summary:
{previous_summary or "(none yet)"}

New messages:
{_format(new_messages)}

Return only the updated summary text."""

    response = genai_client.models.generate_content(model=CHAT_MODEL, contents=prompt)
    return (response.text or "").strip()[:MAX_SUMMARY_CHARS]


def build_history_context(history: list[dict]) -> tuple[list[dict], str]:
    """Returns (recent_messages, summary_of_older_messages)."""
    if len(history) <= RECENT_WINDOW:
        return history, ""

    recent = history[-RECENT_WINDOW:]
    older = history[:-RECENT_WINDOW]

    cached = cache_get(_key(older))
    if cached and cached.get("summary"):
        return recent, cached["summary"]

    try:
        # Incremental: pichle turn ka "older" = abhi ke older ke last 2 messages
        # hata ke. Uska summary mil jaaye to sirf naye 2 messages jodo.
        prev_older = older[:-2]
        prev = cache_get(_key(prev_older)) if prev_older else None

        if prev and prev.get("summary"):
            summary = _summarize(prev["summary"], older[-2:])
        else:
            # Pehli baar (ya cache expire): last 30 older messages summarize karo
            summary = _summarize("", older[-30:])

        if summary:
            cache_set(_key(older), {"summary": summary}, SUMMARY_TTL)
            logger.info(f"Chat summary updated ({len(older)} older messages)")
        return recent, summary
    except Exception:
        logger.exception("Chat summarization failed, continuing without summary")
        return recent, ""