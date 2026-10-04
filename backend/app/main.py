import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from app.config import settings
from app.middleware.rate_limiter import SlidingWindowRateLimiter
from app.middleware.error_handler import register_error_handlers
from app.api.routes_health import router as health_router
from app.api.routes_upload import router as upload_router
from app.api.routes_chat import router as chat_router
from app.api.routes_quiz import router as quiz_router
from app.api.routes_mobile_compat import router as mobile_compat_router
from app.api.routes_exam_prep import router as exam_prep_router
from app.api.routes_courses import router as courses_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.API_VERSION,
    description="AI Study Assistant Full-Stack RAG System API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# 1. Register CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Register Sliding-Window Rate Limiter
app.add_middleware(SlidingWindowRateLimiter)

# 3. Register Global Exception Handlers
register_error_handlers(app)

# 4. Include Core API Routers
app.include_router(health_router)
app.include_router(upload_router)
app.include_router(chat_router)
app.include_router(quiz_router)
app.include_router(mobile_compat_router)
app.include_router(exam_prep_router)
app.include_router(courses_router)

# Also expose under /api and /api/v1 prefixes for standard client setups & mobile
app.include_router(health_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(mobile_compat_router, prefix="/api")
app.include_router(exam_prep_router, prefix="/api")
app.include_router(courses_router, prefix="/api")

app.include_router(health_router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(quiz_router, prefix="/api/v1")
app.include_router(mobile_compat_router, prefix="/api/v1")
app.include_router(exam_prep_router, prefix="/api/v1")
app.include_router(courses_router, prefix="/api/v1")

# 5. Static Files and Frontend Single Page App serving
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def serve_index():
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return HTMLResponse("<h2>AI Study Assistant Backend Active</h2><p>Visit <a href='/docs'>/docs</a> for API documentation.</p>")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def catch_all_spa(full_path: str):
        # Don't intercept api, docs, or schema routes
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json", "health", "upload", "documents", "chat", "quiz", "pdf", "ai")):
            raise HTTPException(status_code=404, detail="Not Found")
        file_candidate = os.path.join(static_dir, full_path)
        if os.path.exists(file_candidate) and os.path.isfile(file_candidate):
            return FileResponse(file_candidate)
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return HTMLResponse("<h2>AI Study Assistant</h2>")
