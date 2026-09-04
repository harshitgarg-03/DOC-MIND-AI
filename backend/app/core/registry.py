from sqlalchemy.orm import Session
from app.models.db_models import Document, ChatMessage

# DOCS OPERATION 

def add_document(db: Session, document_id: str, filename: str, total_pages: int, total_chunks: int):
    # print("PRINT ARE ++++++ ", document_id, filename, total_chuks, total_pages)
    doc = Document(
        document_id = document_id,
        filename = filename,
        total_pages = total_pages,
        total_chunks = total_chunks
    )

    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc

def get_allDocs(db: Session):
    return db.query(Document).all()

def get_document(db: Session, document_id: str):
    return db.query(Document).filter(Document.document_id == document_id).first()

def delete_document(db: Session, document_id: str) -> bool:
    doc = get_document(db, document_id)
    if not doc:
        return False

    db.delete(doc)
    db.commit()
    return True

# CHAT MESSAGES OPERATION

def save_message(db: Session, document_id: str, role: str, text: str, citations: list | None = None):
    msg = ChatMessage(document_id = document_id, role = role, text = text, citations = citations)

    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def get_message(db: Session, document_id: str):
    return (
        db.query(ChatMessage).filter(ChatMessage.document_id == document_id).order_by(ChatMessage.created_at.asc()).all()
    )
