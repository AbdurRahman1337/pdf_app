import logging
import asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.llm_client import LLMException

logger = logging.getLogger("ai_study_assistant.errors")


class VectorStoreException(Exception):
    """Exception raised when vector database operations fail."""
    pass


class FileParsingError(Exception):
    """Exception raised when an uploaded document cannot be parsed."""
    pass


def register_error_handlers(app: FastAPI):
    """
    Registers global exception handlers mapping system errors to standard HTTP status codes:
    - asyncio.TimeoutError -> 504 Gateway Timeout
    - LLMException -> 503 Service Unavailable
    - VectorStoreException -> 500 Internal Server Error
    - FileParsingError -> 400 Bad Request
    - RequestValidationError -> 422 Unprocessable Entity
    - General uncaught exceptions -> 500 Internal Server Error (redacted from client)
    """

    @app.exception_handler(asyncio.TimeoutError)
    async def timeout_exception_handler(request: Request, exc: asyncio.TimeoutError):
        logger.warning(f"Request timeout at {request.url.path}: {exc}")
        return JSONResponse(
            status_code=504,
            content={
                "detail": "Request timed out while processing with AI engine or vector database.",
                "error_type": "GatewayTimeout",
                "status_code": 504
            }
        )

    @app.exception_handler(LLMException)
    async def llm_exception_handler(request: Request, exc: LLMException):
        logger.error(f"LLM failure at {request.url.path}: {exc}")
        return JSONResponse(
            status_code=503,
            content={
                "detail": f"AI model service temporarily unavailable: {str(exc)}",
                "error_type": "LLMServiceUnavailable",
                "status_code": 503
            }
        )

    @app.exception_handler(VectorStoreException)
    async def vector_exception_handler(request: Request, exc: VectorStoreException):
        logger.error(f"Vector store error at {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "A vector storage or indexing error occurred.",
                "error_type": "VectorStoreError",
                "status_code": 500
            }
        )

    @app.exception_handler(FileParsingError)
    async def file_parsing_exception_handler(request: Request, exc: FileParsingError):
        logger.warning(f"File parsing error at {request.url.path}: {exc}")
        return JSONResponse(
            status_code=400,
            content={
                "detail": str(exc),
                "error_type": "FileParsingError",
                "status_code": 400
            }
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.info(f"Validation error at {request.url.path}: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Request payload validation failed.",
                "errors": exc.errors(),
                "error_type": "ValidationError",
                "status_code": 422
            }
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "error_type": "HTTPException",
                "status_code": exc.status_code
            }
        )

    @app.exception_handler(Exception)
    async def uncaught_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled internal server error at {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "An internal server error occurred.",
                "error_type": "InternalServerError",
                "status_code": 500
            }
        )

