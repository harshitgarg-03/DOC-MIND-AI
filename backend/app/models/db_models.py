from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, JSON
from datetime import datetime

from app.core.database import Base
import uuid

class Document(Base):
    __tablename__ = "documents"
    document_id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    total_pages = Column(Integer, nullable=False)
    total_chunks = Column(Integer, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "document_id": self.document_id,
            "filename": self.filename,
            "total_pages": self.total_pages,
            "total_chunks": self.total_chunks,
            "uploaded_at": self.uploaded_at.isoformat(),
        }


class ChatMessage(Base):
    __tablename__ = "chats-message"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.document_id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "text": self.text,
            "citations": self.citations,
        }

