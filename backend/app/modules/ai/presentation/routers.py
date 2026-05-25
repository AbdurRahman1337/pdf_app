from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import httpx
from typing import List, Optional

from app.core.database import get_db
from app.modules.auth.presentation.routers import get_current_user
from app.modules.auth.infrastructure.models import User
from app.modules.ai.infrastructure.services import ai_service
from app.core.config import settings

router = APIRouter(prefix="/ai", tags=["AI Orchestrator"])


class RAGQueryRequest(BaseModel):
    pdf_id: str
    question: str


class RAGQueryResponse(BaseModel):
    answer: str
    sources: List[str]


class TranslationRequest(BaseModel):
    text: str
    target_language: str = "es"  # Defaults Spanish ('es')


class TranslationResponse(BaseModel):
    translated_text: str


@router.post("/query", response_model=RAGQueryResponse)
async def query_pdf_rag(
    payload: RAGQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    RAG Prompt gate. Locates similar context matrices in vector maps,
    injects relevance elements to the system prompts and synthesizes answers.
    """
    try:
        response = await ai_service.query_rag(payload.pdf_id, payload.question)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during vector retrieval or reasoning: {str(e)}"
        )


@router.post("/translate", response_model=TranslationResponse)
async def translate_text(
    payload: TranslationRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Connects with the local LibreTranslate service to execute multi-language translation.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        payload_data = {
            "q": payload.text,
            "source": "en",
            "target": payload.target_language,
            "format": "text"
        }
        try:
            response = await client.post(f"{settings.LIBRETRANSLATE_URL}/translate", json=payload_data)
            if response.status_code == 200:
                translated = response.json().get("translatedText", "")
                return {"translated_text": translated}
            else:
                # Fallback in case Translation services are booting
                return {"translated_text": f"[Translation Service Unavailable]: {payload.text}"}
        except Exception:
            return {"translated_text": f"[Failed to establish translator connection]: {payload.text}"}
