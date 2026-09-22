from fastapi import APIRouter
from app.config import settings
from app.db.models import HealthCheckResponse
from app.db.vector_store import vector_store

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Checks API health, version, and ChromaDB collection chunk count.
    """
    count = vector_store.get_collection_count()
    return HealthCheckResponse(
        status="healthy",
        version=settings.API_VERSION,
        chroma_status="connected",
        collection_count=count,
    )

