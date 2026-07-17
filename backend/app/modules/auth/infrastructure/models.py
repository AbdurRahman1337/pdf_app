from sqlalchemy import Column, String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    firebase_uid = Column(String, unique=True, index=True, nullable=False)   # Firebase UID (immutable)
    email        = Column(String, unique=True, index=True, nullable=True)    # nullable — Firebase may not expose it
    password_hash = Column(String, nullable=True)                            # NOT used — Firebase owns credentials
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at   = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Cascade delete: remove all PDFs when user is deleted
    pdfs = relationship("PDFRecord", back_populates="owner", cascade="all, delete-orphan")
