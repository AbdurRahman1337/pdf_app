import io
import os
import json
import logging
from typing import Dict, Any, Optional
import httpx

from app.config import settings

logger = logging.getLogger("study_assistant.google_drive")

_has_google_client = False
try:
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
    from google.oauth2.credentials import Credentials
    from google.oauth2 import service_account
    _has_google_client = True
except ImportError:
    _has_google_client = False


class GoogleDriveServiceException(Exception):
    """Exception raised when Google Drive operations fail."""
    pass


class GoogleDriveService:
    """
    Manages direct Google Drive storage operations for study notes and PDFs.
    Authenticates via:
      1. User OAuth2 Access Token (per-user personal Google Drive storage)
      2. Service Account (central enterprise drive)
      3. Direct Google REST API with Bearer token
    """

    def __init__(self):
        self.folder_name = settings.GOOGLE_DRIVE_FOLDER_NAME or "AI Study Assistant"
        self.drive_api_url = "https://www.googleapis.com/drive/v3/files"
        self.upload_api_url = "https://www.googleapis.com/upload/drive/v3/files"
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET

    def get_service(self, user_access_token: Optional[str] = None):
        """
        Builds Google Drive API client using user access token or service account.
        """
        if not _has_google_client:
            return None

        if user_access_token:
            creds = Credentials(token=user_access_token)
            return build('drive', 'v3', credentials=creds, cache_discovery=False)

        cred_path = settings.FIREBASE_CREDENTIALS_PATH
        if cred_path and os.path.exists(cred_path):
            try:
                scopes = ['https://www.googleapis.com/auth/drive.file']
                creds = service_account.Credentials.from_service_account_file(cred_path, scopes=scopes)
                return build('drive', 'v3', credentials=creds, cache_discovery=False)
            except Exception as e:
                logger.warning(f"Failed to build Google Drive client from service account: {e}")

        return None

    def get_or_create_folder(self, service, folder_name: Optional[str] = None) -> Optional[str]:
        """
        Locates or creates the application study folder in Google Drive.
        """
        target_name = folder_name or self.folder_name
        if not service:
            return None

        try:
            query = f"mimeType='application/vnd.google-apps.folder' and name='{target_name}' and trashed=false"
            results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
            files = results.get('files', [])

            if files:
                return files[0]['id']

            # Create folder
            folder_metadata = {
                'name': target_name,
                'mimeType': 'application/vnd.google-apps.folder'
            }
            folder = service.files().create(body=folder_metadata, fields='id').execute()
            logger.info(f"Created Google Drive folder '{target_name}' with ID: {folder.get('id')}")
            return folder.get('id')
        except Exception as e:
            logger.warning(f"Could not retrieve/create Google Drive folder: {e}")
            return None

    def upload_file(
        self,
        filename: str,
        file_bytes: bytes,
        mime_type: str = "application/pdf",
        user_access_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads a study file directly to Google Drive and returns real file ID and view links.
        Raises GoogleDriveServiceException if not authenticated.
        """
        service = self.get_service(user_access_token)

        # 1. SDK-based upload with user OAuth token or Service Account
        if service:
            try:
                folder_id = self.get_or_create_folder(service)
                file_metadata = {'name': filename}
                if folder_id:
                    file_metadata['parents'] = [folder_id]

                media = MediaIoBaseUpload(io.BytesIO(file_bytes), mimetype=mime_type, resumable=True)
                drive_file = service.files().create(
                    body=file_metadata,
                    media_body=media,
                    fields='id, name, webViewLink, webContentLink, size'
                ).execute()

                file_id = drive_file.get('id')
                logger.info(f"Successfully uploaded '{filename}' to Google Drive (ID: {file_id})")
                return {
                    "success": True,
                    "drive_file_id": file_id,
                    "drive_folder_id": folder_id,
                    "drive_web_view_link": drive_file.get('webViewLink') or f"https://drive.google.com/file/d/{file_id}/view",
                    "drive_web_content_link": drive_file.get('webContentLink') or f"https://drive.google.com/uc?id={file_id}&export=download",
                    "filename": filename,
                    "size_bytes": int(drive_file.get('size', len(file_bytes))),
                }
            except Exception as e:
                logger.error(f"Google Drive SDK upload failed for {filename}: {e}")
                if not user_access_token:
                    raise GoogleDriveServiceException(f"Google Drive upload failed: {e}")

        # 2. Direct REST API multipart upload if user_access_token is provided
        if user_access_token:
            try:
                headers = {"Authorization": f"Bearer {user_access_token}"}
                boundary = "===boundary_study_assistant==="
                meta_json = json.dumps({"name": filename})

                body = (
                    f"--{boundary}\r\n"
                    f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
                    f"{meta_json}\r\n"
                    f"--{boundary}\r\n"
                    f"Content-Type: {mime_type}\r\n\r\n"
                ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

                post_headers = {
                    "Authorization": f"Bearer {user_access_token}",
                    "Content-Type": f"multipart/related; boundary={boundary}",
                }

                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(
                        f"{self.upload_api_url}?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size",
                        headers=post_headers,
                        content=body,
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        file_id = data.get("id")
                        logger.info(f"REST upload succeeded: ID={file_id}")
                        return {
                            "success": True,
                            "drive_file_id": file_id,
                            "drive_web_view_link": data.get("webViewLink") or f"https://drive.google.com/file/d/{file_id}/view",
                            "drive_web_content_link": data.get("webContentLink") or f"https://drive.google.com/uc?id={file_id}&export=download",
                            "filename": filename,
                            "size_bytes": len(file_bytes),
                        }
                    else:
                        raise GoogleDriveServiceException(f"Google Drive REST upload failed (HTTP {resp.status_code}): {resp.text}")
            except GoogleDriveServiceException:
                raise
            except Exception as e:
                raise GoogleDriveServiceException(f"Google Drive upload network error: {e}")

        # No valid token provided
        raise GoogleDriveServiceException(
            "Google Drive authentication required. Please sign in with Google Drive to upload documents."
        )

    def read_file_text(self, drive_file_id: str, user_access_token: Optional[str] = None) -> Optional[str]:
        """
        Streams and downloads text content from a Google Drive file.
        """
        service = self.get_service(user_access_token)
        if service:
            try:
                request = service.files().get_media(fileId=drive_file_id)
                fh = io.BytesIO()
                downloader = MediaIoBaseDownload(fh, request)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                fh.seek(0)
                return fh.read().decode('utf-8')
            except Exception as e:
                logger.warning(f"Failed to read file {drive_file_id} via Google Drive SDK: {e}")

        # REST fallback with user token
        if user_access_token:
            try:
                url = f"{self.drive_api_url}/{drive_file_id}?alt=media"
                headers = {"Authorization": f"Bearer {user_access_token}"}
                with httpx.Client(timeout=15.0) as client:
                    resp = client.get(url, headers=headers)
                    if resp.status_code == 200:
                        return resp.text
            except Exception as e:
                logger.warning(f"Failed to read file {drive_file_id} via REST: {e}")

        return None

    def get_oauth_url(self, redirect_uri: str, state: Optional[str] = None) -> str:
        """
        Generates Google OAuth consent screen URL for requesting Google Drive file access.
        """
        client_id = self.client_id or settings.GOOGLE_CLIENT_ID
        scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
        url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?"
            f"client_id={client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope={scope}&"
            f"access_type=offline&"
            f"prompt=consent"
        )
        if state:
            url += f"&state={state}"
        return url

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        """
        Exchanges authorization code for access_token, refresh_token, and user info.
        """
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            "code": code,
            "client_id": self.client_id or settings.GOOGLE_CLIENT_ID,
            "client_secret": self.client_secret or settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(token_url, data=payload)
            if resp.status_code != 200:
                logger.error(f"Failed to exchange Google OAuth code: {resp.text}")
                raise GoogleDriveServiceException(f"OAuth token exchange failed: {resp.text}")
            
            token_data = resp.json()
            access_token = token_data.get("access_token")

            # Fetch user profile info
            user_info = {}
            if access_token:
                try:
                    user_resp = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    if user_resp.status_code == 200:
                        user_info = user_resp.json()
                except Exception as e:
                    logger.warning(f"Could not fetch user profile: {e}")

            return {
                "access_token": token_data.get("access_token"),
                "refresh_token": token_data.get("refresh_token"),
                "expires_in": token_data.get("expires_in"),
                "token_type": token_data.get("token_type"),
                "scope": token_data.get("scope"),
                "user": {
                    "email": user_info.get("email"),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture"),
                    "id": user_info.get("sub"),
                }
            }

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refreshes an expired access token using the stored refresh_token.
        """
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            "client_id": self.client_id or settings.GOOGLE_CLIENT_ID,
            "client_secret": self.client_secret or settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token"
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(token_url, data=payload)
            if resp.status_code != 200:
                logger.error(f"Failed to refresh Google OAuth token: {resp.text}")
                raise GoogleDriveServiceException(f"OAuth token refresh failed: {resp.text}")
            return resp.json()

    def delete_file(self, drive_file_id: str, user_access_token: Optional[str] = None) -> bool:
        """
        Deletes a file from Google Drive.
        """
        service = self.get_service(user_access_token)
        if service:
            try:
                service.files().delete(fileId=drive_file_id).execute()
                return True
            except Exception as e:
                logger.warning(f"Failed to delete Google Drive file {drive_file_id}: {e}")

        if user_access_token:
            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.delete(
                        f"{self.drive_api_url}/{drive_file_id}",
                        headers={"Authorization": f"Bearer {user_access_token}"}
                    )
                    return resp.status_code in (200, 204)
            except Exception as e:
                logger.warning(f"REST delete failed: {e}")

        return False


# Singleton instance
google_drive_service = GoogleDriveService()
