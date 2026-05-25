from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="Unique email address for the user")


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, description="Cleartext password")


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: str | None = None
