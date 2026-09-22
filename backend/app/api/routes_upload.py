import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException

from app.db.models import UploadResponse, DocumentListResponse, DocumentInfo
from app.db.vector_store import vector_store
from app.db.firestore_service import firestore_service
from app.core.chunking import get_token_chunks
from app.utils.file_parser import extract_text_from_file
from app.dependencies import get_session_id

router = APIRouter(tags=["Documents & Ingestion"])
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    session_id_form: Optional[str] = Form(default=None, alias="session_id"),
    resolved_session_id: str = Depends(get_session_id),
):
    """
    Ingests and indexes a study document (.pdf, .txt, .md up to 25MB).
    Extracts text, splits into token-aware chunks, and saves to vector store with session isolation.
    """
    session_id = session_id_form.strip() if (session_id_form and session_id_form.strip()) else resolved_session_id

    content_bytes = await file.read()
    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
        )

    filename = file.filename or "uploaded_note.txt"
    extracted_text = extract_text_from_file(filename=filename, file_bytes=content_bytes)

    doc_id = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).isoformat()

    chunks = get_token_chunks(
        text=extracted_text,
        doc_id=doc_id,
        base_metadata={
            "session_id": session_id,
            "filename": filename,
            "uploaded_at": uploaded_at,
        }
    )

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="Document yielded no text chunks for indexing."
        )

    chunk_ids = [c["id"] for c in chunks]
    chunk_texts = [c["text"] for c in chunks]
    chunk_metas = [c["metadata"] for c in chunks]

    vector_store.add_documents(
        documents=chunk_texts,
        metadatas=chunk_metas,
        ids=chunk_ids
    )

    # 1. Save Book to Firestore 'books' collection
    firestore_service.save_book({
        "id": doc_id,
        "doc_id": doc_id,
        "title": filename,
        "original_name": filename,
        "session_id": session_id,
        "user_id": session_id,
        "size_bytes": len(content_bytes),
        "chunk_count": len(chunks),
        "total_characters": len(extracted_text),
        "process_status": "COMPLETED",
        "created_at": uploaded_at,
    })

    # 2. Record UPLOAD_AND_INDEX operation
    firestore_service.record_book_operation(
        doc_id=doc_id,
        op_type="UPLOAD_AND_INDEX",
        details={
            "filename": filename,
            "chunk_count": len(chunks),
            "total_characters": len(extracted_text),
            "size_bytes": len(content_bytes),
        }
    )

    return UploadResponse(
        doc_id=doc_id,
        filename=filename,
        total_chunks=len(chunks),
        total_characters=len(extracted_text),
        session_id=session_id,
        message="Document uploaded, parsed, chunked, and indexed successfully into vector knowledge base."
    )


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(session_id: str = Depends(get_session_id)):
    """
    Lists all indexed documents for the active session (combining Firestore and vector store).
    """
    firestore_books = firestore_service.list_books(session_id=session_id) or []
    raw_docs = vector_store.list_documents(session_id=session_id)

    known_ids = {d["doc_id"] for d in raw_docs}
    for b in firestore_books:
        bid = b.get("id") or b.get("doc_id")
        if bid not in known_ids:
            raw_docs.append({
                "doc_id": bid,
                "filename": b.get("original_name") or b.get("title", "Document"),
                "chunk_count": b.get("chunk_count", 1),
                "uploaded_at": b.get("created_at"),
            })
            known_ids.add(bid)

    doc_infos = [
        DocumentInfo(
            doc_id=d["doc_id"],
            filename=d["filename"],
            chunk_count=d["chunk_count"],
            uploaded_at=d.get("uploaded_at"),
        )
        for d in raw_docs
    ]
    total_chunks = sum(d.chunk_count for d in doc_infos)

    return DocumentListResponse(
        documents=doc_infos,
        total_documents=len(doc_infos),
        total_chunks=total_chunks
    )


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    session_id: str = Depends(get_session_id)
):
    """
    Deletes all chunks of a specific document within the active session and removes from Firestore.
    """
    deleted = vector_store.delete_document(doc_id=doc_id, session_id=session_id)
    firestore_service.delete_book(doc_id)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Document '{doc_id}' not found or already removed in this session."
        )

    return {
        "success": True,
        "message": f"Document '{doc_id}' successfully removed.",
        "doc_id": doc_id,
        "session_id": session_id
    }

