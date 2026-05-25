from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any


class PDFResponse(BaseModel):
    id: UUID
    user_id: UUID
    original_name: str
    size_bytes: int
    process_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PDFDetailResponse(PDFResponse):
    summary_brief: Optional[str] = None
    summary_details: Optional[Dict[str, Any]] = None
    vocabulary: Optional[List[Dict[str, Any]]] = None


class PDFStatusResponse(BaseModel):
    id: UUID
    process_status: str
