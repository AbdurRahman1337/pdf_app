import logging
import sys
from logging.config import dictConfig
from app.core.config import settings

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "json": {
            "format": '{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "level": "INFO",
            "formatter": "json" if settings.ENVIRONMENT == "production" else "standard",
            "class": "logging.StreamHandler",
            "stream": sys.stdout,
        },
    },
    "loggers": {
        "": {  # root logger
            "handlers": ["default"],
            "level": "INFO",
            "propagate": True,
        },
        "uvicorn.error": {
            "level": "INFO",
            "handlers": ["default"],
            "propagate": False,
        },
        "uvicorn.access": {
            "level": "INFO",
            "handlers": ["default"],
            "propagate": False,
        },
        "sqlalchemy.engine": {
            "level": "WARNING",
            "handlers": ["default"],
            "propagate": False,
        },
    },
}


def setup_logging() -> None:
    """Sets up the custom logging configuration for the FastAPI system."""
    dictConfig(LOGGING_CONFIG)
