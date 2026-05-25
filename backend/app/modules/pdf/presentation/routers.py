from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import os
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.modules.auth.presentation.routers import get_current_user
from app.modules.auth.infrastructure.models import User
from app.modules.pdf.infrastructure.models import PDFRecord
from app.modules.pdf.infrastructure.schemas import PDFResponse, PDFDetailResponse, PDFStatusResponse

router = APIRouter(prefix="/pdf", tags=["PDF Ingest"])


@router.post("/upload", response_model=PDFResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validates uploaded files, writes content to disk volumes,
    registers metadata in DB, and fires out processing tasks in Celery.
    """
    # 1. Validate PDF signatures
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Forbidden format. Standard PDFs only."
        )

    # 2. Setup directory
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # 3. Stream write blocks to preserve memory buffers
    size_bytes = 0
    try:
        with open(file_path, "wb") as buffer:
            while chunk := await file.read(1024 * 1024):  # 1MB blocks
                size_bytes += len(chunk)
                if size_bytes > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
                    # Cleanup allocations
                    buffer.close()
                    os.remove(file_path)
                    raise HTTPException(
                        status_code=status.HTTP_413_payload_TOO_LARGE,
                        detail=f"Inbound size exceeded {settings.MAX_FILE_SIZE_MB}MB limit."
                    )
                buffer.write(chunk)
    except IOError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed writing binary content to targets structure. Error: {str(e)}"
        )

    # 4. Save metadata records
    pdf_entry = PDFRecord(
        user_id=current_user.id,
        original_name=file.filename,
        storage_path=file_path,
        size_bytes=size_bytes,
        process_status="PENDING"
    )
    
    db.add(pdf_entry)
    await db.commit()
    await db.refresh(pdf_entry)

    # 5. Delegate downstream task handling to background systems
    # Imported inside route helper to avoid circularity issues
    from app.workers.tasks import process_pdf_task
    process_pdf_task.delay(str(pdf_entry.id))

    return pdf_entry


@router.get("/list", response_model=List[PDFResponse])
async def list_pdfs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve historical PDF operations registered under this account."""
    result = await db.execute(
        select(PDFRecord)
        .where(PDFRecord.user_id == current_user.id)
        .order_by(PDFRecord.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{pdf_id}/status", response_model=PDFStatusResponse)
async def query_status(
    pdf_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fast-check route fetching status indicators."""
    result = await db.execute(
        select(PDFRecord).where(PDFRecord.id == pdf_id, PDFRecord.user_id == current_user.id)
    )
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Requested PDF metadata not found.")
    return record


@router.get("/{pdf_id}", response_model=PDFDetailResponse)
async def query_details(
    pdf_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Detailed summary viewer mapping hierarchical tiers and vocabulary mappings."""
    result = await db.execute(
        select(PDFRecord).where(PDFRecord.id == pdf_id, PDFRecord.user_id == current_user.id)
    )
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Requested PDF details not found.")
    return record
