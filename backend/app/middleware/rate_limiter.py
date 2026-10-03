import time
from collections import defaultdict
from typing import Dict, List
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from app.config import settings


class SlidingWindowRateLimiter(BaseHTTPMiddleware):
    """
    In-memory sliding-window rate limiter per client IP (20 req/min).
    Returns HTTP 429 with standard X-RateLimit headers when limit is exceeded.
    Exempts /health, /docs, /openapi.json, /redoc, and static assets.
    """
    def __init__(self, app):
        super().__init__(app)
        self.rate_limit = settings.RATE_LIMIT_PER_MINUTE
        self.window_seconds = 60.0
        self.ip_records: Dict[str, List[float]] = defaultdict(list)
        self.exempt_prefixes = (
            "/health",
            "/api/health",
            "/api/v1/health",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/static",
            "/favicon.ico",
        )

    def _is_exempt(self, path: str) -> bool:
        if path == "/" or path.startswith(self.exempt_prefixes) or path.endswith("/health"):
            return True
        return False

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        if self._is_exempt(path):
            return await call_next(request)

        # Determine client key (X-Forwarded-For, X-Session-ID, or client IP)
        forwarded = request.headers.get("x-forwarded-for")
        session_hdr = request.headers.get("x-session-id")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif session_hdr:
            client_ip = f"session_{session_hdr.strip()}"
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"

        now = time.time()
        window_start = now - self.window_seconds

        timestamps = self.ip_records[client_ip]
        # Remove timestamps outside of the 60s sliding window
        valid_timestamps = [ts for ts in timestamps if ts > window_start]
        self.ip_records[client_ip] = valid_timestamps

        if len(valid_timestamps) >= self.rate_limit:
            oldest_ts = valid_timestamps[0]
            reset_seconds = max(1, int(oldest_ts + self.window_seconds - now))

            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Maximum {self.rate_limit} requests per minute allowed.",
                    "status_code": 429,
                    "error_type": "RateLimitExceeded"
                },
                headers={
                    "X-RateLimit-Limit": str(self.rate_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(reset_seconds),
                    "Retry-After": str(reset_seconds)
                }
            )

        # Record this request
        valid_timestamps.append(now)
        self.ip_records[client_ip] = valid_timestamps

        response = await call_next(request)

        remaining = max(0, self.rate_limit - len(valid_timestamps))
        reset_seconds = int(valid_timestamps[0] + self.window_seconds - now)

        response.headers["X-RateLimit-Limit"] = str(self.rate_limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_seconds)

        return response

