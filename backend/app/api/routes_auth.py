import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body, Header
from pydantic import BaseModel, Field

from app.db.google_drive_service import google_drive_service, GoogleDriveServiceException

router = APIRouter(tags=["Google Drive & Authentication"])
logger = logging.getLogger("study_assistant.auth")


class GoogleOAuthUrlResponse(BaseModel):
    url: str
    client_id: str


class GoogleCodeExchangeRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None


class GoogleTokenRefreshRequest(BaseModel):
    refresh_token: str


class GoogleUser(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    id: Optional[str] = None


class GoogleOAuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: Optional[str] = "Bearer"
    scope: Optional[str] = None
    user: Optional[GoogleUser] = None


@router.get("/auth/google/url", response_model=GoogleOAuthUrlResponse)
async def get_google_oauth_url(
    redirect_uri: str = Query(..., description="OAuth redirect URI configured in Google Cloud Console"),
    state: Optional[str] = Query(default=None)
):
    """
    Returns the Google OAuth 2.0 authorization URL with Google Drive file access scopes.
    """
    try:
        url = google_drive_service.get_oauth_url(redirect_uri=redirect_uri, state=state)
        return GoogleOAuthUrlResponse(
            url=url,
            client_id=google_drive_service.client_id or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Google OAuth URL: {e}")


@router.post("/auth/google/exchange", response_model=GoogleOAuthResponse)
async def exchange_google_code(payload: GoogleCodeExchangeRequest):
    """
    Exchanges an authorization code returned from Google OAuth consent flow for access and refresh tokens.
    """
    try:
        data = await google_drive_service.exchange_code(
            code=payload.code,
            redirect_uri=payload.redirect_uri
        )
        return GoogleOAuthResponse(
            access_token=data.get("access_token", ""),
            refresh_token=data.get("refresh_token"),
            expires_in=data.get("expires_in"),
            token_type=data.get("token_type", "Bearer"),
            scope=data.get("scope"),
            user=GoogleUser(**(data.get("user") or {}))
        )
    except GoogleDriveServiceException as gde:
        raise HTTPException(status_code=400, detail=str(gde))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to exchange Google OAuth code: {e}")


@router.post("/auth/google/refresh")
async def refresh_google_token(payload: GoogleTokenRefreshRequest):
    """
    Refreshes an expired Google access token using the stored refresh token.
    """
    try:
        data = await google_drive_service.refresh_access_token(payload.refresh_token)
        return data
    except GoogleDriveServiceException as gde:
        raise HTTPException(status_code=400, detail=str(gde))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh Google token: {e}")


@router.get("/auth/google/status")
async def check_google_drive_status(
    google_access_token: Optional[str] = Header(default=None, alias="X-Google-Access-Token")
):
    """
    Validates whether the provided Google Access Token has active Google Drive access.
    """
    if not google_access_token:
        return {
            "connected": False,
            "message": "No Google Access Token provided."
        }

    try:
        service = google_drive_service.get_service(google_access_token)
        if service:
            # Probe drive
            about = service.about().get(fields="user(displayName, emailAddress)").execute()
            user_info = about.get("user", {})
            return {
                "connected": True,
                "email": user_info.get("emailAddress"),
                "display_name": user_info.get("displayName"),
                "message": "Google Drive connected and authenticated."
            }
        return {
            "connected": False,
            "message": "Could not instantiate Google Drive service."
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
            "message": "Google Drive token is invalid or expired."
        }
