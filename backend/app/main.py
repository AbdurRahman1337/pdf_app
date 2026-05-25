from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.cache import get_redis_client

# Import backend module presentation routes
from app.modules.auth.presentation.routers import router as auth_router
from app.modules.pdf.presentation.routers import router as pdf_router
from app.modules.ai.presentation.routers import router as ai_router

# Setup logger configuration
setup_logging()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Apply CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initializes external engines like Redis connections on startup triggers."""
    get_redis_client()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleans up system linkages during shutdown calls."""
    redis_client = get_redis_client()
    await redis_client.close()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Guarantees clean, json-safe responses are always delivered
    to the frontend clients in case of unhandled server exceptions.
    """
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred.", "err_msg": str(exc)},
    )


# Register all active routers to unified v1 root path
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(pdf_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
async def health_check():
    """Root system diagnostics routes."""
    return {
        "status": "Green",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }
