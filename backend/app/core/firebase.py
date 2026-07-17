"""
Firebase Admin SDK — Token Verification Service

Initializes Firebase Admin once at startup and exposes a single helper
`verify_firebase_token(id_token)` that validates a Firebase ID Token and
returns the decoded payload (uid, email, etc.).

Setup:
  1. Go to Firebase Console → Project Settings → Service Accounts
  2. Click "Generate new private key" → download the JSON file
  3. Place it at backend/firebase_service_account.json
  4. OR set FIREBASE_SERVICE_ACCOUNT_JSON env var with the JSON content (base64 ok)

The service account file is gitignored and should never be committed.
"""
import os
import json
import logging
from pathlib import Path
from typing import Optional

import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)

# ── Initialize Firebase Admin ──────────────────────────────────────────────────
_SERVICE_ACCOUNT_PATH = Path(__file__).parent.parent.parent.parent / "firebase_service_account.json"
_SERVICE_ACCOUNT_ENV  = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

def _init_firebase() -> None:
    """Initialize the Firebase Admin SDK (idempotent)."""
    if firebase_admin._apps:
        return  # Already initialized

    try:
        if _SERVICE_ACCOUNT_ENV:
            # Support passing the service-account JSON directly via env var
            sa_info = json.loads(_SERVICE_ACCOUNT_ENV)
            cred = credentials.Certificate(sa_info)
            logger.info("Firebase Admin: initialized from FIREBASE_SERVICE_ACCOUNT_JSON env var")
        elif _SERVICE_ACCOUNT_PATH.exists():
            cred = credentials.Certificate(str(_SERVICE_ACCOUNT_PATH))
            logger.info(f"Firebase Admin: initialized from {_SERVICE_ACCOUNT_PATH}")
        else:
            # Application Default Credentials (GCP / Cloud Run)
            cred = credentials.ApplicationDefault()
            logger.info("Firebase Admin: initialized using Application Default Credentials")

        firebase_admin.initialize_app(cred)

    except Exception as exc:
        logger.error(f"Firebase Admin initialization failed: {exc}")
        raise RuntimeError(
            "Firebase Admin could not be initialized. "
            "Provide firebase_service_account.json or set FIREBASE_SERVICE_ACCOUNT_JSON env var."
        ) from exc


# Run initialization at module import time
_init_firebase()


# ── Public API ─────────────────────────────────────────────────────────────────
def verify_firebase_token(id_token: str) -> Optional[dict]:
    """
    Verify a Firebase ID Token and return the decoded claims dict.

    Returns:
        dict with keys: uid, email, email_verified, name (optional), etc.
        None if the token is invalid, expired, or Firebase is unreachable.
    """
    try:
        decoded = auth.verify_id_token(id_token, check_revoked=True)
        return decoded
    except auth.RevokedIdTokenError:
        logger.warning("Firebase token has been revoked.")
        return None
    except auth.UserDisabledError:
        logger.warning("Firebase user account is disabled.")
        return None
    except auth.InvalidIdTokenError as exc:
        logger.warning(f"Firebase invalid ID token: {exc}")
        return None
    except Exception as exc:
        logger.error(f"Unexpected Firebase token verification error: {exc}")
        return None
