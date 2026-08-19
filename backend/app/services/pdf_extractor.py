from pypdf import PdfReader


def extract_pages(reader: PdfReader) -> list[tuple[int, str]]:
    """Har page ka text alag-alag rakhta hai, taaki page number track ho sake."""
    pages = []
    for i, page in enumerate(reader.pages):
        page_text = page.extract_text() or ""
        pages.append((i + 1, page_text))  # page numbers 1-indexed
    return pages