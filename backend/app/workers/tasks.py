import asyncio
import logging
from sqlalchemy.future import select
import fitz  # PyMuPDF
import sys

from app.workers.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.modules.pdf.infrastructure.models import PDFRecord
from app.modules.ai.infrastructure.services import ai_service

logger = logging.getLogger("celery_worker")


def get_async_loop():
    """Returns working asyncio execution loops or initializes a new process wrapper."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


@celery_app.task(name="app.workers.tasks.process_pdf_task")
def process_pdf_task(pdf_id: str) -> str:
    """
    Main ingestion orchestrator trigger.
    Extracts text, groups chunks, updates indices, summarizes pages, registers keys.
    """
    logger.info(f"Incoming Background Processing command for PDF uuid: {pdf_id}")
    
    # asyncio.run handles the complete lifecycle gracefully and safely
    return asyncio.run(_async_process_pdf(pdf_id))


async def _async_process_pdf(pdf_id: str) -> str:
    """Async engine executor handling file parsing and ML pipelines."""
    # 1. Fetch record from database
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(
                select(PDFRecord).where(PDFRecord.id == pdf_id)
            )
            pdf_record = result.scalars().first()
            if not pdf_record:
                logger.error(f"Requested PDF Record ({pdf_id}) was not located inside Postgres instance.")
                return "FAILED_NOT_FOUND"

            # Update process state to active processing status
            pdf_record.process_status = "PROCESSING"
            await session.commit()
            
            storage_path = pdf_record.storage_path
        except Exception as e:
            logger.error(f"Failed loading PDF definition mapping Database: {str(e)}")
            return f"FAILED_DB_ERROR: {str(e)}"

        try:
            # 2. Extract texts using low-level PyMuPDF engine
            logger.info(f"Triggering PyMuPDF parser execution on: {storage_path}")
            doc = fitz.open(storage_path)
            extracted_text_blocks = []
            
            for page in doc:
                text = page.get_text()
                if text:
                    extracted_text_blocks.append(text)
            
            full_text = "\n\n".join(extracted_text_blocks).strip()
            
            if not full_text:
                raise ValueError("PDF content parsed as empty or binary image structure without metadata.")

            # 3. Create semantic paragraph boundaries using spaCy NLP models
            logger.info("Executing spaCy token boundaries classifications...")
            semantic_chunks = ai_service.semantic_chunking(full_text)
            
            # 4. Generate embeddings and index vectors in ChromaDb
            logger.info(f"Vectorizing {len(semantic_chunks)} chunks into ChromaDB index mapping...")
            ai_service.inject_vector_chunks(pdf_id, semantic_chunks)

            # 5. Connect local Ollama pipelines to summarize pages map-reduce
            logger.info("Interrogating local Ollama models for executive & granular summaries...")
            summaries = await ai_service.summarize_tiers(full_text)

            # 6. Synthesize technical vocabularies definitions lists
            logger.info("Extracting advanced keywords definitions arrays...")
            vocab = await ai_service.extract_vocabulary(full_text)

            # 7. Commit structures inside target DB registers
            pdf_record.summary_brief = summaries.get("brief", "Failed synthesizing summary.")
            pdf_record.summary_details = summaries
            pdf_record.vocabulary = vocab
            pdf_record.process_status = "COMPLETED"
            
            session.add(pdf_record)
            await session.commit()
            
            logger.info(f"PDF uuid {pdf_id} successfully parsed, indexed and summarized!")
            return "SUCCESS"

        except Exception as e:
            logger.error(f"Failed PDF pipelines parsing: {str(e)}")
            # Rollback first if the active transaction was aborted/corrupted
            await session.rollback()
            pdf_record.process_status = "FAILED"
            # Add object back since it might be detached from rollback
            session.add(pdf_record)
            await session.commit()
            return f"FAILED_PIPELINE_ERROR: {str(e)}"
