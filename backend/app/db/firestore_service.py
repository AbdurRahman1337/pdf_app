import os
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx

try:
    import jwt
except ImportError:
    jwt = None

from app.config import settings

logger = logging.getLogger("study_assistant.firestore")

# ── Optional Firebase Admin / Google Cloud Firestore SDK ──────────────────────
_admin_db = None
_sdk_initialized = False

try:
    import firebase_admin
    from firebase_admin import credentials, firestore

    cred_path = settings.FIREBASE_CREDENTIALS_PATH
    if not cred_path or not os.path.exists(cred_path):
        # Auto-discover in backend, root, or mobile directory
        for p in [
            "./firebase_service_account.json",
            "./backend/firebase_service_account.json",
            os.path.join(os.path.dirname(__file__), "..", "..", "firebase_service_account.json"),
            "/home/mrrobot/Desktop/pdf/pdf_app/mobile/pdf-app-48c12-firebase-adminsdk-fbsvc-f497cb66cf.json",
            "/home/mrrobot/Desktop/pdf/pdf_app/backend/firebase_service_account.json",
        ]:
            if os.path.exists(p):
                cred_path = p
                break

    if cred_path and os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
            _admin_db = firestore.client()
            _sdk_initialized = True
            logger.info(f"Initialized Firebase Admin SDK via service account: {cred_path}")
        except Exception as e:
            logger.warning(f"Failed to initialize Firebase Admin with service account: {e}")

    if not _sdk_initialized:
        try:
            if not firebase_admin._apps:
                firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})
            _admin_db = firestore.client()
            _sdk_initialized = True
            logger.info(f"Initialized Firebase Admin SDK for project: {settings.FIREBASE_PROJECT_ID}")
        except Exception as e:
            logger.info(f"Firebase Admin SDK direct auth not available, using authenticated REST client: {e}")
except Exception as e:
    logger.info(f"Firebase Admin SDK not loaded ({e}). Running with authenticated Firestore REST & resilient store.")


class FirestoreService:
    """
    Manages persistence of Books and Operation histories in the Firestore 'books' collection.
    Features:
      1. Firebase Admin SDK integration (when service account or ADC credentials exist).
      2. Authenticated Firestore REST API (using Service Account JWT OAuth2 access token).
      3. Local in-memory / SQLite mirror to ensure zero disruption during offline development.
    """

    def __init__(self):
        self.project_id = settings.FIREBASE_PROJECT_ID
        self.collection_name = settings.FIRESTORE_COLLECTION_BOOKS
        self.rest_base_url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents"
        # In-memory mirror of books collection
        self._local_books_cache: Dict[str, Dict[str, Any]] = {}
        # Cached OAuth2 access token
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def _find_service_account_path(self) -> Optional[str]:
        candidates = [
            settings.FIREBASE_CREDENTIALS_PATH,
            "./firebase_service_account.json",
            "./backend/firebase_service_account.json",
            os.path.join(os.path.dirname(__file__), "..", "..", "firebase_service_account.json"),
            "/home/mrrobot/Desktop/pdf/pdf_app/backend/firebase_service_account.json",
            "/home/mrrobot/Desktop/pdf/pdf_app/mobile/pdf-app-48c12-firebase-adminsdk-fbsvc-f497cb66cf.json",
        ]
        for c in candidates:
            if c and os.path.exists(c):
                return os.path.abspath(c)
        return None

    def _get_access_token(self) -> Optional[str]:
        if self._cached_token and time.time() < self._token_expires_at - 60:
            return self._cached_token

        if jwt is None:
            return None

        key_path = self._find_service_account_path()
        if not key_path:
            return None

        try:
            with open(key_path, "r", encoding="utf-8") as f:
                key_data = json.load(f)

            client_email = key_data.get("client_email")
            private_key = key_data.get("private_key")
            if not client_email or not private_key:
                return None

            now = int(time.time())
            payload = {
                "iss": client_email,
                "sub": client_email,
                "aud": "https://oauth2.googleapis.com/token",
                "iat": now,
                "exp": now + 3600,
                "scope": "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/drive.file"
            }

            assertion = jwt.encode(payload, private_key, algorithm="RS256")
            token_url = key_data.get("token_uri") or "https://oauth2.googleapis.com/token"

            with httpx.Client(timeout=6.0) as client:
                resp = client.post(
                    token_url,
                    data={
                        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                        "assertion": assertion,
                    }
                )
                if resp.status_code == 200:
                    token_info = resp.json()
                    self._cached_token = token_info.get("access_token")
                    expires_in = token_info.get("expires_in", 3600)
                    self._token_expires_at = time.time() + expires_in
                    logger.info("Successfully refreshed Google Service Account OAuth2 token for Cloud Firestore.")
                    return self._cached_token
        except Exception as e:
            logger.debug(f"Could not refresh service account token: {e}")

        return None

    def _get_auth_headers(self) -> Dict[str, str]:
        token = self._get_access_token()
        if token:
            return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        return {"Content-Type": "application/json"}

    # ── Internal Conversion Helpers for Firestore REST API ────────────────────

    def _to_firestore_value(self, val: Any) -> Dict[str, Any]:
        if val is None:
            return {"nullValue": None}
        elif isinstance(val, bool):
            return {"booleanValue": val}
        elif isinstance(val, int):
            return {"integerValue": str(val)}
        elif isinstance(val, float):
            return {"doubleValue": val}
        elif isinstance(val, str):
            return {"stringValue": val}
        elif isinstance(val, list):
            return {"arrayValue": {"values": [self._to_firestore_value(v) for v in val]}}
        elif isinstance(val, dict):
            return {"mapValue": {"fields": {k: self._to_firestore_value(v) for k, v in val.items()}}}
        else:
            return {"stringValue": str(val)}

    def _from_firestore_value(self, val_dict: Dict[str, Any]) -> Any:
        if not isinstance(val_dict, dict):
            return val_dict
        if "stringValue" in val_dict:
            return val_dict["stringValue"]
        if "integerValue" in val_dict:
            return int(val_dict["integerValue"])
        if "doubleValue" in val_dict:
            return float(val_dict["doubleValue"])
        if "booleanValue" in val_dict:
            return val_dict["booleanValue"]
        if "nullValue" in val_dict:
            return None
        if "arrayValue" in val_dict:
            values = val_dict["arrayValue"].get("values", [])
            return [self._from_firestore_value(v) for v in values]
        if "mapValue" in val_dict:
            fields = val_dict["mapValue"].get("fields", {})
            return {k: self._from_firestore_value(v) for k, v in fields.items()}
        return val_dict

    def _document_to_dict(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        fields = doc_data.get("fields", {})
        result = {}
        for k, v in fields.items():
            result[k] = self._from_firestore_value(v)
        return result

    # ── Public Books Collection API ───────────────────────────────────────────

    def save_book(self, book_data: Dict[str, Any]) -> bool:
        """
        Saves or updates a book document in the 'books' Firestore collection.
        """
        doc_id = str(book_data.get("id") or book_data.get("doc_id") or uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()

        record = {
            "id": doc_id,
            "doc_id": doc_id,
            "title": book_data.get("title") or book_data.get("filename") or book_data.get("original_name") or "Untitled Document",
            "original_name": book_data.get("original_name") or book_data.get("filename") or "document.pdf",
            "session_id": book_data.get("session_id") or "session_default",
            "user_id": book_data.get("user_id") or book_data.get("session_id") or "session_default",
            "storage_provider": book_data.get("storage_provider", "google_drive"),
            "drive_file_id": book_data.get("drive_file_id"),
            "drive_folder_id": book_data.get("drive_folder_id"),
            "drive_web_view_link": book_data.get("drive_web_view_link"),
            "drive_web_content_link": book_data.get("drive_web_content_link"),
            "size_bytes": int(book_data.get("size_bytes", 0)),
            "chunk_count": int(book_data.get("chunk_count") or book_data.get("total_chunks", 0)),
            "total_characters": int(book_data.get("total_characters", 0)),
            "process_status": book_data.get("process_status", "COMPLETED"),
            "created_at": book_data.get("created_at") or now_iso,
            "updated_at": now_iso,
            "summary": book_data.get("summary"),
            "vocabulary": book_data.get("vocabulary") or [],
            "operations": book_data.get("operations") or [],
            "stats": book_data.get("stats") or {
                "query_count": 0,
                "quiz_count": 0,
                "last_accessed_at": now_iso,
            },
        }

        # Keep existing operations/summary if updating
        if doc_id in self._local_books_cache:
            existing = self._local_books_cache[doc_id]
            if not record["summary"] and existing.get("summary"):
                record["summary"] = existing["summary"]
            if not record["vocabulary"] and existing.get("vocabulary"):
                record["vocabulary"] = existing["vocabulary"]
            if not record["operations"] and existing.get("operations"):
                record["operations"] = existing["operations"]

        # Always update local cache
        self._local_books_cache[doc_id] = record

        # 1. Try Firebase Admin SDK
        if _admin_db:
            try:
                doc_ref = _admin_db.collection(self.collection_name).document(doc_id)
                doc_ref.set(record, merge=True)
                logger.debug(f"Saved book {doc_id} via Firebase Admin SDK")
                return True
            except Exception as e:
                logger.warning(f"Firebase Admin save failed for {doc_id}: {e}")

        # 2. Try Authenticated Firestore REST API
        try:
            url = f"{self.rest_base_url}/{self.collection_name}/{doc_id}"
            fields_payload = {"fields": {k: self._to_firestore_value(v) for k, v in record.items() if v is not None}}
            headers = self._get_auth_headers()
            with httpx.Client(timeout=5.0) as client:
                resp = client.patch(url, json=fields_payload, headers=headers)
                if resp.status_code in (200, 201):
                    logger.debug(f"Saved book {doc_id} to Firestore REST")
                    return True
        except Exception as e:
            logger.debug(f"Firestore REST save error for {doc_id}: {e}")

        return True

    def get_book(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a book document by its ID from Firestore.
        """
        # 1. Try Firebase Admin SDK
        if _admin_db:
            try:
                doc_ref = _admin_db.collection(self.collection_name).document(doc_id)
                snapshot = doc_ref.get()
                if snapshot.exists:
                    data = snapshot.to_dict()
                    self._local_books_cache[doc_id] = data
                    return data
            except Exception as e:
                logger.warning(f"Firebase Admin get_book failed: {e}")

        # 2. Try Authenticated Firestore REST API
        try:
            url = f"{self.rest_base_url}/{self.collection_name}/{doc_id}"
            headers = self._get_auth_headers()
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = self._document_to_dict(resp.json())
                    self._local_books_cache[doc_id] = data
                    return data
        except Exception:
            pass

        # 3. Fallback to local cache
        return self._local_books_cache.get(doc_id)

    def list_books(self, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lists all books in the 'books' collection, optionally filtered by session_id.
        """
        cloud_books: List[Dict[str, Any]] = []

        # 1. Try Firebase Admin SDK
        if _admin_db:
            try:
                col_ref = _admin_db.collection(self.collection_name)
                if session_id and session_id not in ("session_default", "*", "all"):
                    try:
                        from google.cloud.firestore import FieldFilter
                        docs = col_ref.where(filter=FieldFilter("session_id", "==", session_id)).stream()
                    except Exception:
                        docs = col_ref.where("session_id", "==", session_id).stream()
                else:
                    docs = col_ref.stream()

                for d in docs:
                    b = d.to_dict()
                    cloud_books.append(b)
                    self._local_books_cache[b.get("id", d.id)] = b

                if cloud_books:
                    return cloud_books
            except Exception as e:
                logger.warning(f"Firebase Admin list_books failed: {e}")

        # 2. Try Authenticated Firestore REST API
        try:
            url = f"{self.rest_base_url}/{self.collection_name}"
            headers = self._get_auth_headers()
            with httpx.Client(timeout=4.0) as client:
                resp = client.get(url, headers=headers)
                if resp.status_code == 200:
                    documents = resp.json().get("documents", [])
                    for d in documents:
                        b = self._document_to_dict(d)
                        doc_id = b.get("id") or d.get("name", "").split("/")[-1]
                        b["id"] = doc_id
                        b["doc_id"] = doc_id
                        cloud_books.append(b)
                        self._local_books_cache[doc_id] = b
                    if cloud_books:
                        if session_id and session_id not in ("session_default", "*", "all"):
                            return [b for b in cloud_books if b.get("session_id") == session_id]
                        return cloud_books
        except Exception:
            pass

        # 3. Local cache fallback
        if session_id and session_id not in ("session_default", "*", "all"):
            return [b for b in self._local_books_cache.values() if b.get("session_id") == session_id]
        return list(self._local_books_cache.values())

    def update_book_summary(
        self,
        doc_id: str,
        summary_brief: str,
        main_points: str,
        vocabulary: List[Dict[str, str]]
    ) -> bool:
        """
        Updates the summary and vocabulary fields for a book in Firestore.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        summary_data = {
            "summary_brief": summary_brief,
            "main_points": main_points,
            "generated_at": now_iso,
        }

        # Update local cache
        if doc_id in self._local_books_cache:
            self._local_books_cache[doc_id]["summary"] = summary_data
            self._local_books_cache[doc_id]["vocabulary"] = vocabulary
            self._local_books_cache[doc_id]["updated_at"] = now_iso

        # 1. Try Firebase Admin SDK
        if _admin_db:
            try:
                doc_ref = _admin_db.collection(self.collection_name).document(doc_id)
                doc_ref.set({
                    "summary": summary_data,
                    "vocabulary": vocabulary,
                    "updated_at": now_iso,
                }, merge=True)
                return True
            except Exception as e:
                logger.warning(f"Firebase Admin update_summary failed for {doc_id}: {e}")

        # 2. Try Authenticated Firestore REST API
        try:
            url = f"{self.rest_base_url}/{self.collection_name}/{doc_id}?updateMask.fieldPaths=summary&updateMask.fieldPaths=vocabulary&updateMask.fieldPaths=updated_at"
            payload = {
                "fields": {
                    "summary": self._to_firestore_value(summary_data),
                    "vocabulary": self._to_firestore_value(vocabulary),
                    "updated_at": self._to_firestore_value(now_iso),
                }
            }
            headers = self._get_auth_headers()
            with httpx.Client(timeout=4.0) as client:
                client.patch(url, json=payload, headers=headers)
                return True
        except Exception:
            pass

        return True

    def record_book_operation(
        self,
        doc_id: str,
        op_type: str,
        details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Records an operation entry (e.g. UPLOAD_AND_INDEX, SUMMARY_AND_VOCABULARY, RAG_QUERY, QUIZ_GENERATION)
        in the book document's 'operations' array in Firestore.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        op_entry = {
            "op_id": f"op_{int(time.time())}_{uuid.uuid4().hex[:6]}",
            "type": op_type,
            "timestamp": now_iso,
            "details": details or {},
        }

        # Update local cache
        book = self._local_books_cache.get(doc_id)
        if book:
            if "operations" not in book or not isinstance(book["operations"], list):
                book["operations"] = []
            book["operations"].append(op_entry)
            book["updated_at"] = now_iso
            if "stats" not in book:
                book["stats"] = {"query_count": 0, "quiz_count": 0, "last_accessed_at": now_iso}
            book["stats"]["last_accessed_at"] = now_iso
            if op_type == "RAG_QUERY":
                book["stats"]["query_count"] = book["stats"].get("query_count", 0) + 1
            elif op_type == "QUIZ_GENERATION":
                book["stats"]["quiz_count"] = book["stats"].get("quiz_count", 0) + 1

        # 1. Try Firebase Admin SDK
        if _admin_db:
            try:
                from google.cloud import firestore as g_firestore
                doc_ref = _admin_db.collection(self.collection_name).document(doc_id)
                update_payload = {
                    "operations": g_firestore.ArrayUnion([op_entry]),
                    "updated_at": now_iso,
                    "stats.last_accessed_at": now_iso,
                }
                if op_type == "RAG_QUERY":
                    update_payload["stats.query_count"] = g_firestore.Increment(1)
                elif op_type == "QUIZ_GENERATION":
                    update_payload["stats.quiz_count"] = g_firestore.Increment(1)

                doc_ref.set(update_payload, merge=True)
                return True
            except Exception as e:
                logger.warning(f"Firebase Admin record_operation failed for {doc_id}: {e}")

        # 2. Try Authenticated Firestore REST API
        if book:
            try:
                url = f"{self.rest_base_url}/{self.collection_name}/{doc_id}?updateMask.fieldPaths=operations&updateMask.fieldPaths=stats&updateMask.fieldPaths=updated_at"
                payload = {
                    "fields": {
                        "operations": self._to_firestore_value(book["operations"]),
                        "stats": self._to_firestore_value(book["stats"]),
                        "updated_at": self._to_firestore_value(now_iso),
                    }
                }
                headers = self._get_auth_headers()
                with httpx.Client(timeout=4.0) as client:
                    client.patch(url, json=payload, headers=headers)
                    return True
            except Exception:
                pass

        return True

    def delete_book(self, doc_id: str) -> bool:
        """
        Deletes a book document from the 'books' Firestore collection.
        """
        self._local_books_cache.pop(doc_id, None)

        if _admin_db:
            try:
                _admin_db.collection(self.collection_name).document(doc_id).delete()
                return True
            except Exception as e:
                logger.warning(f"Firebase Admin delete_book failed: {e}")

        try:
            url = f"{self.rest_base_url}/{self.collection_name}/{doc_id}"
            headers = self._get_auth_headers()
            with httpx.Client(timeout=4.0) as client:
                client.delete(url, headers=headers)
                return True
        except Exception:
            pass

        return True


# Singleton instance for the application
firestore_service = FirestoreService()
