from typing import List, Optional
from pydantic import AnyHttpUrl, EmailStr, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    # --- API Service Attributes ---
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "PDF AI Assistant"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "9a2b8e3c4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # --- SQL Database Binds ---
    DATABASE_URL: str = "postgresql+asyncpg://postgres_master:secure_postgres_pass_2026@db:5432/pdf_app_dev"

    # --- Redis Configurations ---
    REDIS_HOST: str = "cache"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # --- Queue brokers ---
    CELERY_BROKER_URL: str = "redis://cache:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://cache:6379/2"

    # --- Chromadb Engine ---
    CHROMADB_HOST: str = "vector_db"
    CHROMADB_PORT: int = 8000

    # --- Ollama Pipeline ---
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_MODEL: str = "mistral:7b-instruct-v0.2"
    EMBEDDINGS_MODEL: str = "all-MiniLM-L6-v2"

    # --- Support Frameworks ---
    LIBRETRANSLATE_URL: str = "http://translation:5000"
    SPACY_MODEL: str = "en_core_web_md"

    # --- File Upload Limits ---
    UPLOAD_DIR: str = "/app/storage/uploads"
    MAX_FILE_SIZE_MB: int = 50


settings = Settings()
