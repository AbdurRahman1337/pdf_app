from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class UserResponse(BaseModel):
    """Public user profile returned by /auth/me and /auth/sync."""
    id:           UUID
    firebase_uid: str
    email:        Optional[str] = None
    is_active:    bool
    created_at:   datetime

    class Config:
        from_attributes = True
