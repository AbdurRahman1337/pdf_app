import uuid
from typing import Optional, Dict, Any
from fastapi import Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import logging

logger = logging.getLogger("study_assistant.auth")
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Mock JWT Bearer auth dependency.
    Validates bearer token if present, or provides mock student credentials.
    """
    if credentials and credentials.credentials:
        token = credentials.credentials
        logger.info(f"🔑 [BACKEND AUTH] Received Bearer Token: {token}")
        return {
            "user_id": "student_user_1",
            "email": "student@academy.edu",
            "role": "student",
            "token": token,
        }
    
    return {
        "user_id": "student_default",
        "email": "guest@academy.edu",
        "role": "student",
    }


async def get_session_id(
    x_session_id: Optional[str] = Header(default=None, alias="X-Session-ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> str:
    """
    Session resolver dependency.
    Resolves X-Session-ID header with fallback to current authenticated user.
    """
    if x_session_id and x_session_id.strip():
        return x_session_id.strip()
    
    user_id = current_user.get("user_id")
    if user_id:
        return f"session_{user_id}"
        
    return "session_default"

