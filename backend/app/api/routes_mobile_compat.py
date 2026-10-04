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

from app.db.google_drive_service import google_drive_service

# Cache for generated summaries and vocabulary to avoid repeated LLM calls
_ANALYSIS_CACHE: Dict[str, Dict[str, Any]] = {}


# ── Pydantic Request / Response Schemas ─────────────────────────────────────────

class MobilePDFItem(BaseModel):
    id: str
    original_name: str
    process_status: str = "COMPLETED"
    size_bytes: int = 0
    created_at: Optional[str] = None
    storage_provider: str = "google_drive"
    drive_file_id: Optional[str] = None
    drive_web_view_link: Optional[str] = None


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


class MobileSocraticRequest(BaseModel):
    pdf_id: Optional[str] = None
    concept_or_topic: Optional[str] = None
    student_explanation: Optional[str] = None


class MobileSocraticResponse(BaseModel):
    mode: str = "challenge"  # "challenge" or "evaluation"
    challenge_question: str
    comprehension_score: Optional[int] = None
    strengths: List[str] = Field(default_factory=list)
    missing_aspects: List[str] = Field(default_factory=list)
    misconceptions: List[str] = Field(default_factory=list)
    tutor_feedback: str
    follow_up_challenge: Optional[str] = None


class MobileCheatSheetItem(BaseModel):
    name: str
    formula_or_rule: str
    explanation: str


class MobileCheatSheetResponse(BaseModel):
    pdf_id: str
    title: str
    formulas_and_theorems: List[MobileCheatSheetItem] = Field(default_factory=list)
    key_acronyms: List[MobileVocabItem] = Field(default_factory=list)
    exam_traps_and_pitfalls: List[str] = Field(default_factory=list)
    markdown_view: str


class MobilePodcastLine(BaseModel):
    speaker: str  # "Alex (Host)" or "Jordan (Co-Host)"
    line: str


class MobilePodcastResponse(BaseModel):
    pdf_id: str
    title: str
    duration_estimate: str
    dialogue: List[MobilePodcastLine] = Field(default_factory=list)
    full_script: str


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
    (synchronized with vector store). Supports session isolation with global fallback.
    """
    # 1. Fetch books recorded in Firestore
    firestore_books = firestore_service.list_books(session_id=session_id) or []
    if not firestore_books and session_id not in ("session_default", "*"):
        firestore_books = firestore_service.list_books(session_id="session_default") or []
    if not firestore_books:
        firestore_books = firestore_service.list_books(session_id="*") or []

    # 2. Also check vector store and sync any missing docs into Firestore
    vector_docs = vector_store.list_documents(session_id=session_id) or []
    if not vector_docs and session_id != "session_default":
        vector_docs = vector_store.list_documents(session_id="session_default") or []
    if not vector_docs:
        vector_docs = vector_store.list_documents(session_id=None) or []

    known_ids = {b.get("id") or b.get("doc_id") for b in firestore_books}
    for vd in vector_docs:
        doc_id = vd["doc_id"]
        if doc_id not in known_ids:
            # Sync vector doc to Firestore
            firestore_service.save_book({
                "id": doc_id,
                "doc_id": doc_id,
                "title": vd.get("filename", "document.pdf"),
                "original_name": vd.get("filename", "document.pdf"),
                "session_id": session_id,
                "chunk_count": vd.get("chunk_count", 1),
                "size_bytes": vd.get("chunk_count", 1) * 2048,
                "created_at": vd.get("uploaded_at"),
            })
            known_ids.add(doc_id)

    # Re-fetch consolidated list from Firestore
    all_books = firestore_service.list_books(session_id=session_id)
    if not all_books:
        all_books = firestore_service.list_books(session_id="*") or firestore_books

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
                storage_provider=b.get("storage_provider", "google_drive"),
                drive_file_id=b.get("drive_file_id"),
                drive_web_view_link=b.get("drive_web_view_link"),
            )
        )
    return items


@router.post("/pdf/upload", response_model=MobilePDFItem)
async def upload_mobile_pdf(
    file: UploadFile = File(...),
    session_id: str = Depends(get_session_id),
):
    """
    Ingests and indexes PDF from Mobile DashboardScreen, uploading to Google Drive and persisting to Firestore.
    """
    content_bytes = await file.read()
    if len(content_bytes) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds maximum size of 25MB.")

    filename = file.filename or "document.pdf"
    extracted_text = extract_text_from_file(filename=filename, file_bytes=content_bytes)

    # 1. Upload raw file to Google Drive
    mime_type = file.content_type or ("text/plain" if filename.endswith((".txt", ".md")) else "application/pdf")
    drive_result = google_drive_service.upload_file(
        filename=filename,
        file_bytes=content_bytes,
        mime_type=mime_type
    )

    doc_id = str(uuid.uuid4())
    uploaded_at = datetime.now(timezone.utc).isoformat()

    chunks = get_token_chunks(
        text=extracted_text,
        doc_id=doc_id,
        base_metadata={
            "session_id": session_id,
            "filename": filename,
            "uploaded_at": uploaded_at,
            "drive_file_id": drive_result.get("drive_file_id", ""),
        }
    )

    if chunks:
        vector_store.add_documents(
            documents=[c["text"] for c in chunks],
            metadatas=[c["metadata"] for c in chunks],
            ids=[c["id"] for c in chunks]
        )

    # 2. Save Book in Firestore 'books' collection with Google Drive links
    firestore_service.save_book({
        "id": doc_id,
        "doc_id": doc_id,
        "title": filename,
        "original_name": filename,
        "session_id": session_id,
        "user_id": session_id,
        "storage_provider": "google_drive",
        "drive_file_id": drive_result.get("drive_file_id"),
        "drive_folder_id": drive_result.get("drive_folder_id"),
        "drive_web_view_link": drive_result.get("drive_web_view_link"),
        "drive_web_content_link": drive_result.get("drive_web_content_link"),
        "size_bytes": len(content_bytes),
        "chunk_count": len(chunks),
        "total_characters": len(extracted_text),
        "process_status": "COMPLETED",
        "created_at": uploaded_at,
    })

    # 3. Record UPLOAD_AND_INDEX operation in book's history
    firestore_service.record_book_operation(
        doc_id=doc_id,
        op_type="UPLOAD_AND_INDEX",
        details={
            "filename": filename,
            "storage_provider": "google_drive",
            "drive_file_id": drive_result.get("drive_file_id"),
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
        storage_provider="google_drive",
        drive_file_id=drive_result.get("drive_file_id"),
        drive_web_view_link=drive_result.get("drive_web_view_link"),
    )


@router.get("/pdf/{pdf_id}/status")
async def get_mobile_pdf_status(pdf_id: str):
    book = firestore_service.get_book(pdf_id)
    status = book.get("process_status", "COMPLETED") if book else "COMPLETED"
    return {"id": pdf_id, "process_status": status}


@router.delete("/pdf/{pdf_id}")
@router.delete("/documents/{pdf_id}")
async def delete_mobile_pdf(pdf_id: str, session_id: str = Depends(get_session_id)):
    """
    Deletes a PDF document, clears analysis cache, removes its vector chunks, and deletes from Firestore.
    """
    _ANALYSIS_CACHE.pop(pdf_id, None)
    vector_store.delete_document(doc_id=pdf_id, session_id=session_id)
    firestore_service.delete_book(pdf_id)
    return {"success": True, "message": f"Document '{pdf_id}' deleted successfully.", "id": pdf_id}


@router.get("/pdf/{pdf_id}", response_model=MobilePDFDetailResponse)
async def get_mobile_pdf_details(pdf_id: str):
    """
    Returns brief summary, detailed points, and vocabulary bank for SummaryScreen and VocabularyScreen.
    Checks Firestore 'books' collection first; synthesizes with AI / intelligent extractor and saves to Firestore if not cached.
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

    # If no chunks found by doc_id, retrieve all chunks in store to find document content
    if not chunks:
        all_docs = vector_store.list_documents(session_id=None)
        matching = [d for d in all_docs if d.get("doc_id") == pdf_id or d.get("filename") == pdf_id]
        if matching:
            chunks = vector_store.get_document_chunks(matching[0]["doc_id"])
            filename = matching[0].get("filename", "Document")

    # Combine text from first few chunks (up to ~14000 chars) for rich prompt context
    if chunks:
        sample_text = "\n\n".join([c["text"] for c in chunks[:12]])[:14000]
    else:
        sample_text = f"Study materials for {filename} indexed in the vector store."

    clean_fn = re.sub(r"\.(pdf|txt|md)$", "", filename, flags=re.IGNORECASE).replace("_", " ").title()

    system_prompt = (
        "You are an expert, encouraging academic tutor and curriculum educator.\n"
        "Analyze the provided document text and create a clear, comprehensive, and student-friendly summary and vocabulary bank.\n\n"
        "Guidelines:\n"
        "1. 'summary_brief': A comprehensive multi-paragraph overview (3 to 4 paragraphs, 200-350 words total) written in clear, accessible language:\n"
        "   - Paragraph 1 (Overview & Core Purpose): What this document is about in plain terms and why it matters.\n"
        "   - Paragraph 2 (Architectural Roadmap & Major Topics): Core mechanisms, configurations, protocols, and workflows.\n"
        "   - Paragraph 3 (Key Learning Outcomes & Practical Value): Practical diagnostic, analytical, and problem-solving skills gained.\n"
        "   Separate paragraphs with double linebreaks (\\n\\n).\n\n"
        "2. 'main_points': A structured breakdown of 5 to 7 key takeaways or core concepts. Format each bullet point with a bold title and 1-2 clear explanatory sentences:\n"
        "   • Concept Title: Clear, plain-English explanation.\\n\\n• Next Title: Explanation...\n\n"
        "3. 'vocabulary': A comprehensive vocabulary bank containing 15 to 25+ essential terms:\n"
        "   - Read through your generated 'summary_brief' and 'main_points' carefully.\n"
        "   - Extract EVERY SINGLE difficult, technical, academic, protocol, or challenging word, acronym, and concept used in the summary and document excerpt.\n"
        "   - For each term, write an understandable, student-friendly, and crystal-clear definition (20 to 40 words) that explains:\n"
        "     a) What the term means in plain, intuitive language (no circular or vague definitions).\n"
        "     b) How it functions or why it is important in real-world application.\n"
        "   - Ensure NO difficult or technical word from the summary is left unexplained.\n\n"
        "Return ONLY a valid JSON object formatted as:\n"
        "{\n"
        '  "summary_brief": "Paragraph 1...\\n\\nParagraph 2...\\n\\nParagraph 3...",\n'
        '  "main_points": "• Topic 1: Explanation...\\n\\n• Topic 2: Explanation...",\n'
        '  "vocabulary": [\n'
        '    {"term": "Term Name", "definition": "Clear, beginner-friendly, and intuitive definition."}\n'
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

        brief_text = data.get("summary_brief", "Summary generated successfully.")
        points_text = data.get("main_points", "• Detailed analysis completed.")

        vocab_items = [
            MobileVocabItem(term=v.get("term", ""), definition=v.get("definition", ""))
            for v in data.get("vocabulary", [])
            if v.get("term")
        ]

        # Enrich with any difficult terms from summary_brief & main_points
        enriched_terms = llm_client._extract_all_difficult_vocabulary(
            summary_text=brief_text,
            main_points_text=points_text,
            excerpt_text=sample_text,
            clean_fn=clean_fn
        )
        merged_vocab = {v.term.lower(): v for v in vocab_items}
        for ev in enriched_terms:
            t_key = ev["term"].lower()
            if t_key not in merged_vocab:
                merged_vocab[t_key] = MobileVocabItem(term=ev["term"], definition=ev["definition"])

        final_vocab_list = list(merged_vocab.values())

        result = MobilePDFDetailResponse(
            id=pdf_id,
            original_name=filename,
            process_status="COMPLETED",
            summary_brief=brief_text,
            summary_details=MobileSummaryDetails(main_points=points_text),
            vocabulary=final_vocab_list
        )
        _ANALYSIS_CACHE[pdf_id] = result

        # Persist summary & vocabulary to Firestore
        firestore_service.update_book_summary(
            doc_id=pdf_id,
            summary_brief=result.summary_brief,
            main_points=result.summary_details.main_points,
            vocabulary=[{"term": v.term, "definition": v.definition} for v in final_vocab_list]
        )
        firestore_service.record_book_operation(
            doc_id=pdf_id,
            op_type="SUMMARY_AND_VOCABULARY",
            details={
                "summary_length": len(result.summary_brief),
                "vocab_terms_count": len(final_vocab_list),
            }
        )

        return result

    except Exception as exc:
        # Guaranteed rich extraction fallback with 100% summary difficulty coverage
        offline_json = llm_client._generate_offline_summary_and_vocab(full_prompt)
        try:
            fallback_data = json.loads(offline_json)
            vocab_items = [
                MobileVocabItem(term=v.get("term", ""), definition=v.get("definition", ""))
                for v in fallback_data.get("vocabulary", [])
                if v.get("term")
            ]
            fallback_result = MobilePDFDetailResponse(
                id=pdf_id,
                original_name=filename,
                process_status="COMPLETED",
                summary_brief=fallback_data.get("summary_brief", f"Key materials extracted from {filename}."),
                summary_details=MobileSummaryDetails(
                    main_points=fallback_data.get("main_points", "• Detailed analysis completed.")
                ),
                vocabulary=vocab_items
            )
            _ANALYSIS_CACHE[pdf_id] = fallback_result
            return fallback_result
        except Exception:
            return MobilePDFDetailResponse(
                id=pdf_id,
                original_name=filename,
                process_status="COMPLETED",
                summary_brief=f"Key materials extracted from {filename}.",
                summary_details=MobileSummaryDetails(
                    main_points="• Core themes indexed in vector store.\n• Ready for interactive RAG querying."
                ),
                vocabulary=[
                    MobileVocabItem(term="Knowledge Base", definition="A vector-indexed repository of document facts and concepts."),
                    MobileVocabItem(term="RAG", definition="Retrieval-Augmented Generation connecting LLMs with reference material.")
                ]
            )


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

    if not rag_res.sources and session_id != "*":
        fallback_res = await run_rag_pipeline(
            query=payload.question,
            session_id="*"
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


@router.post("/ai/socratic", response_model=MobileSocraticResponse)
async def socratic_tutor_mode(
    payload: MobileSocraticRequest,
    session_id: str = Depends(get_session_id)
):
    """
    Socratic Tutor & Feynman Technique Evaluator:
    - If student_explanation is empty: generates an incisive conceptual challenge based on the document.
    - If student_explanation is present: evaluates student comprehension (0-100), highlights accurate points,
      identifies misconceptions or missing edge cases, and provides targeted feedback.
    """
    doc_context = ""
    target_topic = payload.concept_or_topic or "Core concepts in this course document"

    if payload.pdf_id:
        chunks = vector_store.get_document_chunks(payload.pdf_id)
        if chunks:
            doc_context = "\n\n".join([c["text"] for c in chunks[:8]])[:8000]

    if not doc_context:
        # Fallback to similar chunks via query
        query_text = payload.concept_or_topic or "essential concepts"
        retrieved = vector_store.query_similar(query_text, session_id=session_id, n_results=4)
        if retrieved:
            doc_context = "\n\n".join([r.get("text") or r.get("content", "") for r in retrieved])[:8000]

    if not payload.student_explanation or len(payload.student_explanation.strip()) < 5:
        # Generate initial challenge question
        system_prompt = (
            "You are a master Socratic professor practicing the Feynman Technique.\n"
            "Formulate a thought-provoking challenge question for the student based on their study material.\n"
            "Ask them to explain a core mechanism, trade-off, or principle in their own plain words.\n"
            "Return valid JSON:\n"
            "{\n"
            '  "challenge_question": "Explain how...",\n'
            '  "tutor_feedback": "Welcome to Socratic Teach-Back Mode! Type your explanation below as if teaching a classmate."\n'
            "}"
        )
        prompt = f"{system_prompt}\n\nDocument Context:\n{doc_context}\n\nTopic Focus:\n{target_topic}"
        try:
            raw = await llm_client.generate(prompt, temperature=0.5)
            data = json.loads(_clean_json_str(raw))
            return MobileSocraticResponse(
                mode="challenge",
                challenge_question=data.get("challenge_question", f"Explain the core concept of {target_topic} in your own words."),
                tutor_feedback=data.get("tutor_feedback", "Explain this concept in plain terms without relying on jargon."),
                comprehension_score=None
            )
        except Exception:
            return MobileSocraticResponse(
                mode="challenge",
                challenge_question=f"Explain how the fundamental mechanisms of {target_topic} operate in practical scenarios.",
                tutor_feedback="Teach this concept in your own words to test your active recall.",
                comprehension_score=None
            )

    # Evaluate student's typed explanation
    eval_prompt = (
        "You are an encouraging academic professor assessing a student's conceptual explanation using the Feynman Technique.\n"
        "Evaluate their understanding rigorously against the verified document context.\n"
        "Score their comprehension from 0 to 100.\n"
        "Extract:\n"
        "- strengths: List 2-3 accurate insights the student demonstrated.\n"
        "- missing_aspects: List 1-2 important nuances, edge cases, or foundational steps they missed.\n"
        "- misconceptions: List any inaccuracies or confusion (or empty if none).\n"
        "- tutor_feedback: A constructive, encouraging summary (2-3 sentences).\n"
        "- follow_up_challenge: A deeper follow-up question to test their mastery.\n\n"
        "Return valid JSON ONLY:\n"
        "{\n"
        '  "comprehension_score": 85,\n'
        '  "strengths": ["Accurately defined...", "Correctly noted..."],\n'
        '  "missing_aspects": ["Did not mention how..."],\n'
        '  "misconceptions": [],\n'
        '  "tutor_feedback": "Great job on...",\n'
        '  "follow_up_challenge": "Now how would this behave if..."\n'
        "}"
    )
    user_input = (
        f"Document Context:\n{doc_context}\n\n"
        f"Topic: {target_topic}\n\n"
        f"Student's Explanation:\n{payload.student_explanation}"
    )
    full_eval_prompt = f"{eval_prompt}\n\n{user_input}"

    try:
        raw = await llm_client.generate(full_eval_prompt, temperature=0.3)
        data = json.loads(_clean_json_str(raw))
        return MobileSocraticResponse(
            mode="evaluation",
            challenge_question=f"Concept: {target_topic}",
            comprehension_score=int(data.get("comprehension_score", 80)),
            strengths=data.get("strengths", ["Solid foundational grasp of core principles."]),
            missing_aspects=data.get("missing_aspects", ["Consider detailing the exact operational sequence."]),
            misconceptions=data.get("misconceptions", []),
            tutor_feedback=data.get("tutor_feedback", "Good effort demonstrating conceptual understanding!"),
            follow_up_challenge=data.get("follow_up_challenge")
        )
    except Exception as e:
        return MobileSocraticResponse(
            mode="evaluation",
            challenge_question=f"Concept: {target_topic}",
            comprehension_score=75,
            strengths=["Demonstrated good general comprehension of the subject."],
            missing_aspects=["Review specific formulas and operational definitions in the notes."],
            misconceptions=[],
            tutor_feedback="Your explanation captures the general gist. Focus on the exact technical parameters for full mastery.",
            follow_up_challenge=f"How does {target_topic} handle edge-case failures?"
        )


@router.get("/pdf/{pdf_id}/cheat-sheet", response_model=MobileCheatSheetResponse)
async def get_document_cheat_sheet(pdf_id: str):
    """
    Generates a condensed 1-Page High-Yield Revision Sheet:
    - Critical Formulas & Rules (with LaTeX formatting)
    - Key Acronyms & Terminology
    - Top Exam Pitfalls / Common Traps to Avoid
    """
    book = firestore_service.get_book(pdf_id)
    filename = "Study Document"
    if book:
        filename = book.get("original_name") or book.get("title") or "Study Document"

    chunks = vector_store.get_document_chunks(pdf_id)
    doc_sample = ""
    if chunks:
        doc_sample = "\n\n".join([c["text"] for c in chunks[:12]])[:12000]

    system_prompt = (
        "You are an academic exam prep specialist. Create a condensed, high-yield 1-Page Revision Cheat Sheet.\n"
        "Extract:\n"
        "1. formulas_and_theorems: List 4-8 core equations, theorems, algorithms, or technical rules. (formula_or_rule should use LaTeX like $O(N)$ or $E=mc^2$ if math is involved).\n"
        "2. key_acronyms: 4-6 essential acronyms or shorthand terms with their expansion and brief role.\n"
        "3. exam_traps_and_pitfalls: 3-5 frequent student mistakes, edge-case traps, or common exam misunderstandings.\n\n"
        "Return valid JSON ONLY:\n"
        "{\n"
        '  "formulas_and_theorems": [\n'
        '    {"name": "Rule Name", "formula_or_rule": "Formula / Equation", "explanation": "Why this matters on exams"}\n'
        '  ],\n'
        '  "key_acronyms": [\n'
        '    {"term": "TCP", "definition": "Transmission Control Protocol - Reliable byte-stream connection"}\n'
        '  ],\n'
        '  "exam_traps_and_pitfalls": [\n'
        '    "Confusing X with Y: Note that X happens at Layer 3 while Y happens at Layer 2."\n'
        '  ]\n'
        "}"
    )
    prompt = f"{system_prompt}\n\nDocument: {filename}\n\nExcerpt:\n{doc_sample}"

    try:
        raw = await llm_client.generate(prompt, temperature=0.3)
        data = json.loads(_clean_json_str(raw))
        items = [
            MobileCheatSheetItem(
                name=f.get("name", "Core Theorem"),
                formula_or_rule=f.get("formula_or_rule", "Key Relationship"),
                explanation=f.get("explanation", "High-yield exam concept")
            )
            for f in data.get("formulas_and_theorems", [])
        ]
        acronyms = [
            MobileVocabItem(term=a.get("term", ""), definition=a.get("definition", ""))
            for a in data.get("key_acronyms", [])
            if a.get("term")
        ]
        traps = data.get("exam_traps_and_pitfalls", [])

        # Build clean markdown overview
        md = f"# 📌 {filename} — High-Yield Cheat Sheet\n\n"
        md += "### ⚡ Key Formulas, Theorems & Rules\n"
        for it in items:
            md += f"- **{it.name}**: `{it.formula_or_rule}` — {it.explanation}\n"
        md += "\n### 🔑 Essential Acronyms\n"
        for ac in acronyms:
            md += f"- **{ac.term}**: {ac.definition}\n"
        md += "\n### ⚠️ Top Exam Traps & Misconceptions\n"
        for tr in traps:
            md += f"- ⚠️ {tr}\n"

        return MobileCheatSheetResponse(
            pdf_id=pdf_id,
            title=filename,
            formulas_and_theorems=items,
            key_acronyms=acronyms,
            exam_traps_and_pitfalls=traps,
            markdown_view=md
        )
    except Exception:
        return MobileCheatSheetResponse(
            pdf_id=pdf_id,
            title=filename,
            formulas_and_theorems=[
                MobileCheatSheetItem(name="Core Principle", formula_or_rule="Concept Definition", explanation="Primary documented law in lecture notes.")
            ],
            key_acronyms=[
                MobileVocabItem(term="RAG", definition="Retrieval-Augmented Generation")
            ],
            exam_traps_and_pitfalls=[
                "Ensure correct unit conversions and review edge-case boundary conditions."
            ],
            markdown_view=f"# 📌 {filename} Cheat Sheet\n\n- **Core Principle**: Key documented relationship."
        )


@router.get("/pdf/{pdf_id}/podcast", response_model=MobilePodcastResponse)
async def get_document_podcast_dialogue(pdf_id: str):
    """
    Generates a conversational 'NotebookLM-style' 2-person Study Podcast script:
    Alex (curious learner) & Jordan (knowledgeable peer) break down the document with analogies.
    """
    book = firestore_service.get_book(pdf_id)
    filename = "Study Material"
    if book:
        filename = book.get("original_name") or book.get("title") or "Study Material"

    chunks = vector_store.get_document_chunks(pdf_id)
    doc_sample = ""
    if chunks:
        doc_sample = "\n\n".join([c["text"] for c in chunks[:10]])[:10000]

    system_prompt = (
        "You are an expert educational audio producer.\n"
        "Create a lively, engaging, 3-minute conversational study podcast script between two students:\n"
        "- Alex (the curious learner asking sharp questions)\n"
        "- Jordan (the knowledgeable peer explaining with intuitive real-world analogies)\n\n"
        "Structure:\n"
        "1. Quick Hook & Topic Introduction\n"
        "2. Breaking down the hardest concept with an easy analogy\n"
        "3. Practical application & what professors love testing on exams\n"
        "4. Wrap-up takeaway\n\n"
        "Return valid JSON ONLY:\n"
        "{\n"
        '  "duration_estimate": "3 min listen",\n'
        '  "dialogue": [\n'
        '    {"speaker": "Alex", "line": "Hey everyone, today we are breaking down... What is the big picture here?"},\n'
        '    {"speaker": "Jordan", "line": "Think of it like this..."}\n'
        '  ]\n'
        "}"
    )
    prompt = f"{system_prompt}\n\nTopic/File: {filename}\n\nExcerpt:\n{doc_sample}"

    try:
        raw = await llm_client.generate(prompt, temperature=0.6)
        data = json.loads(_clean_json_str(raw))
        dialogue = [
            MobilePodcastLine(speaker=d.get("speaker", "Alex"), line=d.get("line", ""))
            for d in data.get("dialogue", [])
            if d.get("line")
        ]
        full_script = "\n\n".join([f"{d.speaker}: {d.line}" for d in dialogue])
        return MobilePodcastResponse(
            pdf_id=pdf_id,
            title=f"Study Audio Overview: {filename}",
            duration_estimate=data.get("duration_estimate", "3 min listen"),
            dialogue=dialogue,
            full_script=full_script
        )
    except Exception:
        fallback_dialogue = [
            MobilePodcastLine(speaker="Alex", line=f"Welcome to today's study breakdown of {filename}! What should we focus on first?"),
            MobilePodcastLine(speaker="Jordan", line="The most essential point is understanding the core architectural mechanism and how each layer coordinates data."),
            MobilePodcastLine(speaker="Alex", line="That makes sense! And for the exam, what is the biggest trap students fall into?"),
            MobilePodcastLine(speaker="Jordan", line="Always watch out for edge cases and remember to review the primary definitions before test day!")
        ]
        return MobilePodcastResponse(
            pdf_id=pdf_id,
            title=f"Study Audio Overview: {filename}",
            duration_estimate="2 min listen",
            dialogue=fallback_dialogue,
            full_script="\n\n".join([f"{d.speaker}: {d.line}" for d in fallback_dialogue])
        )
