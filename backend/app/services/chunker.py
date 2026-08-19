import re
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import CHUNK_SIZE, CHUNK_OVERLAP

HEADING_PATTERN = re.compile(
    r"^[A-Z][A-Za-z\s&/\-]{2,40}$"
)


def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


def split_into_sections(page_text: str, current_title: str = "General"):
    """Ek page ke text ko (section_title, section_text) pairs mein todta hai."""
    lines = page_text.split("\n")
    sections = []
    current_lines = []

    for line in lines:
        stripped = line.strip()
        is_heading = (
            stripped
            and HEADING_PATTERN.match(stripped)
            and len(stripped.split()) <= 6
        )
        if is_heading:
            if current_lines:
                sections.append((current_title, "\n".join(current_lines)))
            current_title = stripped.title()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections.append((current_title, "\n".join(current_lines)))

    return sections, current_title


def chunk_with_metadata(pages: list[tuple[int, str]]) -> list[dict]:
    """
    pages: [(page_number, page_text), ...]
    Returns: [{"text":..., "page":..., "section":...}, ...]

    Chunk boundaries page ke andar hi rehte hain (koi chunk do pages ko span
    nahi karta) — isse page number attribution hamesha sahi rehta hai.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    chunks = []
    current_title = "General"
    for page_num, page_text in pages:
        if not page_text.strip():
            continue

        sections, current_title = split_into_sections(page_text, current_title)

        for section_title, section_text in sections:
            if not section_text.strip():
                continue

            for piece in splitter.split_text(section_text):
                if piece.strip():
                    chunks.append({
                        "text": piece,
                        "page": page_num,
                        "section": section_title,
                    })

    return chunks