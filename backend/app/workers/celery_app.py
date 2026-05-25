from celery import Celery
from app.core.config import settings

# Initialize Celery async execution loops
celery_app = Celery(
    "pdf_app_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Guarantee worker threads don't choke during high-concurrency PDF ingestion
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Autodiscover background queues executions maps
celery_app.autodiscover_tasks(["app.workers"])
