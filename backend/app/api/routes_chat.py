from fastapi import APIRouter, Depends
from app.db.models import ChatRequest, ChatResponse
from app.core.rag_pipeline import run_rag_pipeline
from app.dependencies import get_session_id

router = APIRouter(tags=["Chat & Tutor"])


@router.post("/chat", response_model=ChatResponse)
async def chat_interaction(
    payload: ChatRequest,
    resolved_session_id: str = Depends(get_session_id)
):
    """
    Handles conversational academic tutoring:
    Performs session-isolated vector retrieval, dialogue history budget pruning,
    tutor prompt synthesis, LLM generation, and source citation mapping.
    """
    effective_session_id = payload.session_id or resolved_session_id

    response = await run_rag_pipeline(
        query=payload.message,
        session_id=effective_session_id,
        history=payload.history
    )

    return response

