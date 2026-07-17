"""
Authentication Router

All endpoints now use Firebase Authentication:
- The frontend signs users in/up via the Firebase client SDK.
- The Firebase ID Token is sent in the `Authorization: Bearer <token>` header.
- This backend verifies the token using Firebase Admin SDK,
  then auto-creates or fetches the local PostgreSQL user record.

Endpoints:
  POST /auth/sync      — Verify Firebase token & upsert local user profile
  GET  /auth/me        — Fetch current authenticated user profile
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.core.database import get_db
from app.core.firebase import verify_firebase_token
from app.modules.auth.infrastructure.models import User
from app.modules.auth.infrastructure.schemas import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Use HTTPBearer to extract token from Authorization header
_bearer_scheme = HTTPBearer(auto_error=True)


# ── Dependency: get current user from Firebase ID Token ───────────────────────
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    1. Decode and verify the Firebase ID Token from the Bearer header.
    2. Look up the user in PostgreSQL by Firebase UID, auto-create if missing.
    3. Raise 401 on any verification failure.
    """
    id_token = credentials.credentials

    decoded = verify_firebase_token(id_token)
    if decoded is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid: str = decoded.get("uid")
    email: str = decoded.get("email", "")

    if not firebase_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase token missing UID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Upsert user in Postgres ───────────────────────────────────────────────
    # We store users by firebase_uid. On first call the user is auto-created.
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalars().first()

    if not user:
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            # password_hash not needed — Firebase owns the credential
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return user


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post(
    "/sync",
    response_model=UserResponse,
    summary="Sync Firebase user → local DB",
    status_code=status.HTTP_200_OK,
)
async def sync_user(current_user: User = Depends(get_current_user)):
    """
    Called by the frontend immediately after Firebase sign-in.
    Ensures the user exists in the local PostgreSQL database and returns
    the user profile. Idempotent — safe to call on every app launch.
    """
    return current_user


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(current_user: User = Depends(get_current_user)):
    """Fetch the authenticated user's local profile record."""
    return current_user
