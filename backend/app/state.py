# NOTE: process-wide global state — only supports a single active PDF/user.
# Replace with session-scoped or DB-backed storage before multi-user use.

pdf_text_store: str = ""
pdf_chunks: list[str] = []