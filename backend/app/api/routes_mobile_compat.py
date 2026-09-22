import json
import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.dependencies import get_session_id
from app.db.vector_store import vector_store
from app.db.firestore_service import firestore_service
from app.core.chunking import get_token_chunks
from app.utils.file_parser import extract_text_from_file
from app.core.llm_client import llm_client
from app.core.rag_pipeline import run_rag_pipeline

router = APIRouter(tags=["Mobile App Compatibility API"])

# Cache for generated summaries and vocabulary to avoid repeated LLM calls
_ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}


# ── Pydantic Request / Response Schemas ─────────────────────────────────────────

class MobilePDFItem(BaseModel):
    id: str
    original_name: str
    process_status: str = "COMPLETED"
    size_bytes: int = 0
    created_at: Optional[str] = None


class MobileSummaryDetails(BaseModel):
    main_points: str


class MobileVocabItem(BaseModel):
    term: str
    definition: str


class MobilePDFDetailResponse(BaseModel):
    id: str
    original_name: str
    process_status: str = "COMPLETED"
    summary_brief: str = "Summary not yet generated."
    summary_details: MobileSummaryDetails = Field(
        default_factory=lambda: MobileSummaryDetails(main_points="No detailed points available.")
    )
    vocabulary: List[MobileVocabItem] = Field(default_factory=list)


class MobileRAGQueryRequest(BaseModel):
    pdf_id: Optional[str] = None
    question: str


class MobileRAGQueryResponse(BaseModel):
    answer: str
    sources: List[str] = Field(default_factory=list)


class MobileTranslateRequest(BaseModel):
    text: str
    target_language: str = "es"


class MobileTranslateResponse(BaseModel):
    translated_text: str


def _clean_json_str(text: str) -> str:
    """Strip markdown code fence blocks if present."""
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text.strip()


# ── PDF Endpoints ─────────────────────────────────────────────────────────────

@router.get("/pdf/list", response_model=List[MobilePDFItem])
async def list_mobile_pdfs(session_id: str = Depends(get_session_id)):
    """
    Returns indexed documents stored in Firestore 'books' collection
    (synchronized with vector store).
    """
    # 1. Fetch books recorded in Firestore
    firestore_books = firestore_service.list_books(session_id=session_id) or []
    if not firestore_books and session_id not in ("session_default", "*"):
        firestore_books = firestore_service.list_books(session_id="session_default") or []

    # 2. Also check vector store and sync any missing docs into Firestore
    vector_docs = vector_store.list_documents(session_id=session_id) or []
    if not vector_docs and session_id != "session_default":
        vector_docs = vector_store.list_documents(session_id="session_default") or []

    known_ids = {b.get("id") or b.get("doc_id") for b in firestore_books}
    for vd in vector_docs:
        doc_id = vd["doc_id"]
        if doc_id not in known_ids:
            # Sync vector doc to Firestore
            firestore_service.save_book({
                "id": doc_id,
                "title": vd.get("filename", "document.pdf"),
                "original_name": vd.get("filename", "document.pdf"),
                "session_id": session_id,
                "chunk_count": vd.get("chunk_count", 1),
                "size_bytes": vd.get("chunk_count", 1) * 2048,
                "created_at": vd.get("uploaded_at"),
            })
            known_ids.add(doc_id)

    # Re-fetch consolidated list from Firestore
    all_books = firestore_service.list_books(session_id=session_id) or firestore_books

    items = []
    for b in all_books:
        book_id = b.get("id") or b.get("doc_id")
        chunk_count = b.get("chunk_count", 1)
        items.append(
            MobilePDFItem(
                id=book_id,
                original_name=b.get("original_name") or b.get("title") or "document.pdf",
                process_status=b.get("process_status", "COMPLETED"),
                size_bytes=b.get("size_bytes") or (chunk_count * 2048),
                created_at=b.get("created_at"),
            )
        )
    return items


@router.post("/pdf/upload", response_model=MobilePDFItem)
async def upload_mobile_pdf(
    file: UploadFile = File(...),
    session_id: str = Depends(get_session_id),
):
    """
    Ingests and indexes PDF from Mobile DashboardScreen, persisting book and operation to Firestore.
    """
    content_bytes = await file.read()
    if len(content_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum size of 25MB.")

    filename = file.filename or "document.pdf"
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

    if chunks:
        vector_store.add_documents(
            documents=[c["text"] for c in chunks],
            metadatas=[c["metadata"] for c in chunks],
            ids=[c["id"] for c in chunks]
        )

    # 1. Save Book in Firestore 'books' collection
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

    # 2. Record UPLOAD_AND_INDEX operation in book's history
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

    return MobilePDFItem(
        id=doc_id,
        original_name=filename,
        process_status="COMPLETED",
        size_bytes=len(content_bytes),
        created_at=uploaded_at,
    )


@router.get("/pdf/{pdf_id}/status")
async def get_mobile_pdf_status(pdf_id: str):
    book = firestore_service.get_book(pdf_id)
    status = book.get("process_status", "COMPLETED") if book else "COMPLETED"
    return {"id": pdf_id, "process_status": status}


@router.get("/pdf/{pdf_id}", response_model=MobilePDFDetailResponse)
async def get_mobile_pdf_details(pdf_id: str):
    """
    Returns brief summary, detailed points, and vocabulary bank for SummaryScreen and VocabularyScreen.
    Checks Firestore 'books' collection first; synthesizes with AI and saves to Firestore if not cached.
    """
    # 1. Check in-memory fast cache
    if pdf_id in _ANALYSIS_CACHE:
        return _ANALYSIS_CACHE[pdf_id]

    # 2. Check Firestore 'books' collection for existing summary & vocabulary
    book = firestore_service.get_book(pdf_id)
    filename = "Document"
    if book:
        filename = book.get("original_name") or book.get("title") or "Document"
        summary_obj = book.get("summary")
        vocab_list = book.get("vocabulary")
        if summary_obj and isinstance(summary_obj, dict) and summary_obj.get("summary_brief"):
            vocab_items = [
                MobileVocabItem(term=v.get("term", ""), definition=v.get("definition", ""))
                for v in (vocab_list or [])
                if v.get("term")
            ]
            cached_res = MobilePDFDetailResponse(
                id=pdf_id,
                original_name=filename,
                process_status=book.get("process_status", "COMPLETED"),
                summary_brief=summary_obj.get("summary_brief", ""),
                summary_details=MobileSummaryDetails(
                    main_points=summary_obj.get("main_points", "• Key points documented.")
                ),
                vocabulary=vocab_items
            )
            _ANALYSIS_CACHE[pdf_id] = cached_res
            return cached_res

    chunks = vector_store.get_document_chunks(pdf_id)
    if chunks and not book:
        filename = chunks[0]["metadata"].get("filename", "Document")

    # If document has no chunks, check if any chunks exist in collection
    if not chunks:
        fallback_res = MobilePDFDetailResponse(
            id=pdf_id,
            original_name=filename,
            process_status="COMPLETED",
            summary_brief="Document was processed. Ask any questions in the RAG Assistant chat.",
            summary_details=MobileSummaryDetails(
                main_points="• Core themes indexed in vector store.\n• Ready for interactive RAG querying."
            ),
            vocabulary=[
                MobileVocabItem(term="Knowledge Base", definition="A vector-indexed repository of document facts and concepts."),
                MobileVocabItem(term="RAG", definition="Retrieval-Augmented Generation connecting LLMs with reference material.")
            ]
        )
        return fallback_res

    # Combine text from first few chunks (up to ~14000 chars) for rich prompt context
    sample_text = "\n\n".join([c["text"] for c in chunks[:10]])[:14000]

    system_prompt = (
        "You are an expert, encouraging study tutor and curriculum educator.\n"
        "Analyze the provided document text and create a clear, comprehensive, and student-friendly summary.\n\n"
        "Guidelines:\n"
        "1. 'summary_brief': Must be a well-developed, clear, and comprehensive multi-paragraph overview (3 to 4 paragraphs, around 200-350 words total) written in simple, accessible language (avoid dense academic jargon or overly compact sentences):\n"
        "   - Paragraph 1 (Overview & Purpose): What is this document about in simple terms, why is it important, and what is its main goal?\n"
        "   - Paragraph 2 (Core Concepts & Roadmap): What are the major topics, phases, or components covered in the material?\n"
        "   - Paragraph 3 (Key Learning Outcomes & Practical Value): What skills, knowledge, and practical takeaways will the student gain from studying this document?\n"
        "   Separate paragraphs with double linebreaks (\\n\\n) for easy reading.\n\n"
        "2. 'main_points': A structured breakdown of 5 to 7 key takeaways or core concepts. Format each bullet point with a bold title and 1-2 simple explanatory sentences:\n"
        "   • Concept Title: Clear explanation in simple terms.\\n\\n• Next Title: Explanation...\n\n"
        "3. 'vocabulary': Extract 8 to 12 essential terms or concepts with clear, beginner-friendly definitions.\n\n"
        "Return ONLY a valid JSON object formatted as:\n"
        "{\n"
        '  "summary_brief": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...",\n'
        '  "main_points": "• Topic 1: Explanation...\\n\\n• Topic 2: Explanation...",\n'
        '  "vocabulary": [\n'
        '    {"term": "Term", "definition": "Clear, simple definition."}\n'
        '  ]\n'
        "}"
    )

    user_prompt = f"Document filename: {filename}\n\nDocument excerpt:\n{sample_text}"
    full_prompt = f"{system_prompt}\n\n{user_prompt}"

    try:
        raw_response = await llm_client.generate(
            prompt_text=full_prompt,
            temperature=0.4
        )
        cleaned = _clean_json_str(raw_response)
        data = json.loads(cleaned)

        vocab_items = [
            MobileVocabItem(term=v.get("term", ""), definition=v.get("definition", ""))
            for v in data.get("vocabulary", [])
            if v.get("term")
        ]

        result = MobilePDFDetailResponse(
            id=pdf_id,
            original_name=filename,
            process_status="COMPLETED",
            summary_brief=data.get("summary_brief", "Summary generated successfully."),
            summary_details=MobileSummaryDetails(
                main_points=data.get("main_points", "• Detailed analysis completed.")
            ),
            vocabulary=vocab_items
        )
        _ANALYSIS_CACHE[pdf_id] = result

        # Persist summary & vocabulary to Firestore
        firestore_service.update_book_summary(
            doc_id=pdf_id,
            summary_brief=result.summary_brief,
            main_points=result.summary_details.main_points,
            vocabulary=[{"term": v.term, "definition": v.definition} for v in vocab_items]
        )
        firestore_service.record_book_operation(
            doc_id=pdf_id,
            op_type="SUMMARY_AND_VOCABULARY",
            details={
                "summary_length": len(result.summary_brief),
                "vocab_terms_count": len(vocab_items),
            }
        )

        return result

    except Exception as exc:
        fallback_result = MobilePDFDetailResponse(
            id=pdf_id,
            original_name=filename,
            process_status="COMPLETED",
            summary_brief=f"Key materials extracted from {filename}.",
            summary_details=MobileSummaryDetails(
                main_points="• Document ingested and vector embeddings calculated.\n• Ready for conversational exploration."
            ),
            vocabulary=[
                MobileVocabItem(term="Overview", definition="General subject overview extracted from document."),
            ]
        )
        return fallback_result


# ── AI Endpoints ──────────────────────────────────────────────────────────────

@router.post("/ai/query", response_model=MobileRAGQueryResponse)
async def query_mobile_rag(
    payload: MobileRAGQueryRequest,
    session_id: str = Depends(get_session_id)
):
    """
    RAG Chat endpoint for Mobile ChatScreen.
    Logs RAG_QUERY operation to the book in Firestore.
    """
    rag_res = await run_rag_pipeline(
        query=payload.question,
        session_id=session_id
    )

    if not rag_res.sources and session_id != "session_default":
        fallback_res = await run_rag_pipeline(
            query=payload.question,
            session_id="session_default"
        )
        if fallback_res.sources:
            rag_res = fallback_res

    sources_text = [
        f"[{s.filename} - chunk {s.chunk_index}]: {s.content[:150]}"
        for s in rag_res.sources
    ]

    # Record RAG_QUERY operation in Firestore
    target_doc_id = payload.pdf_id
    if not target_doc_id and rag_res.sources:
        target_doc_id = getattr(rag_res.sources[0], "doc_id", None)

    if target_doc_id:
        firestore_service.record_book_operation(
            doc_id=target_doc_id,
            op_type="RAG_QUERY",
            details={
                "question": payload.question,
                "sources_count": len(rag_res.sources),
                "answer_preview": rag_res.answer[:200] if rag_res.answer else "",
            }
        )

    return MobileRAGQueryResponse(
        answer=rag_res.answer,
        sources=sources_text
    )


@router.post("/ai/translate", response_model=MobileTranslateResponse)
async def translate_mobile_text(payload: MobileTranslateRequest):
    """
    AI Translation endpoint for Mobile VocabularyScreen.
    Uses Gemini LLM for high-accuracy contextual translation.
    """
    target = payload.target_language
    lang_names = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "zh": "Chinese",
        "ar": "Arabic",
        "ur": "Urdu",
        "hi": "Hindi",
        "ja": "Japanese"
    }
    lang_label = lang_names.get(target, target)
    system_instruction = (
        f"You are a professional translator. Translate the given text accurately into {lang_label}.\n"
        "Return ONLY the direct translated text. Do not provide explanations, footnotes, quotation marks, or notes."
    )
    full_prompt = f"{system_instruction}\n\nText to translate:\n{payload.text}"

    try:
        translated = await llm_client.generate(
            prompt_text=full_prompt,
            temperature=0.1
        )
        return MobileTranslateResponse(translated_text=translated.strip())
    except Exception as exc:
        return MobileTranslateResponse(
            translated_text=f"[Translation unavailable]: {payload.text}"
        )
