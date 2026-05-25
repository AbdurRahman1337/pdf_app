from sqlalchemy import Column, String, Integer, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base


class PDFRecord(Base):
    __tablename__ = "pdf_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    original_name = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    process_status = Column(
        String,
        default="PENDING",
        nullable=False,
        index=True
    )  # PENDING | PROCESSING | COMPLETED | FAILED
    
    summary_brief = Column(String, nullable=True)
    
    # Store Tiered summary maps: hierarchical levels JSON format
    summary_details = Column(JSONB, nullable=True)
    
    # Store vocab list in format [{"term": "word", "tag": "POS", "definition": "str", "translation": "str"}]
    vocabulary = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    owner = relationship("User", back_populates="pdfs")
