from sqlalchemy import Column, String, Integer, DateTime
from datetime import datetime

from app.core.database import Base

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

