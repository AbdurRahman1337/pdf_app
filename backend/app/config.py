from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Study Assistant"
    API_VERSION: str = "1.0.0"
    
    # LLM API Keys & Model configuration
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    MODEL_NAME: str = "gemini-2.5-flash"
    
    # Vector Database configuration
    CHROMA_DB_PATH: str = "./chroma_db"
    
    # Chunking parameters
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50
    
    # Operational parameters
    RATE_LIMIT_PER_MINUTE: int = 20
    LLM_TIMEOUT_SECONDS: int = 15
    MAX_CONTEXT_TOKENS: int = 8000

    # Firebase & Firestore Database configuration
    FIREBASE_PROJECT_ID: str = "pdf-app-48c12"
    FIREBASE_CREDENTIALS_PATH: str = "./firebase_service_account.json"
    FIRESTORE_COLLECTION_BOOKS: str = "books"

    # Google Drive & Google Cloud configuration (loaded from .env)
    GOOGLE_API_KEY: str = ""
    GOOGLE_DRIVE_FOLDER_NAME: str = "AI Study Assistant"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_SECRET_PATH: str = "./google_client_secret.json"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

