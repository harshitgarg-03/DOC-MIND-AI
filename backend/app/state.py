# NOTE: process-wide global state — only supports a single active PDF/user.
# Replace with session-scoped or DB-backed storage before multi-user use.

# pdf_text_store: str = ""
# pdf_chunks: list[str] = []

# new cersion for multi pdf support ...

from datetime import datetime

# document_id -> metadata (filename, page count, upload time)
documents_registry: dict[str, dict] = {}