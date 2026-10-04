import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_session_id
from app.db.vector_store import vector_store
from app.db.firestore_service import firestore_service
from app.core.chunking import get_token_chunks
from app.utils.file_parser import extract_text_from_file
from app.core.llm_client import llm_client

router = APIRouter(tags=["Courses - Multi-Subject Learning & MDCAT Prep"])
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────────────────────

class SubjectDocument(BaseModel):
    id: str
    filename: str
    size_bytes: int = 0
    chunk_count: int = 0
    uploaded_at: str


class SubjectInfo(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    color: Optional[str] = None
    documents: List[SubjectDocument] = Field(default_factory=list)
    mastery_percentage: int = 0
    summary_brief: Optional[str] = None
    vocab_count: int = 0


class CourseInfo(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    target_exam_or_degree: Optional[str] = None
    created_at: str
    subjects: List[SubjectInfo] = Field(default_factory=list)
    total_documents: int = 0
    total_subjects: int = 0
    overall_progress_percentage: int = 0


class CreateCourseRequest(BaseModel):
    title: str
    description: Optional[str] = None
    target_exam_or_degree: Optional[str] = None
    subject_names: List[str] = Field(default_factory=list)


class AddSubjectRequest(BaseModel):
    name: str
    code: Optional[str] = None
    color: Optional[str] = None


class PrepareTestFromSelectionRequest(BaseModel):
    course_id: str
    selected_subject_ids: List[str] = Field(default_factory=list)
    selected_doc_ids: List[str] = Field(default_factory=list)
    num_questions: int = 15
    difficulty: str = "Medium"


# In-memory cache for user's course tracks
_COURSES_CACHE: Dict[str, CourseInfo] = {}


def _get_default_mdcat_course() -> CourseInfo:
    return CourseInfo(
        id="mdcat_course_primary",
        title="MDCAT 2026 Pre-Medical Track",
        description="Comprehensive study course covering all 5 MDCAT subjects: Biology, Chemistry, Physics, English, and Logical Reasoning.",
        target_exam_or_degree="MDCAT (PMDC / UHS)",
        created_at=datetime.now(timezone.utc).isoformat(),
        subjects=[
            SubjectInfo(
                id="sub_mdcat_bio",
                name="Biology",
                code="BIO-101",
                color="#10B981",
                documents=[],
                mastery_percentage=0,
                summary_brief="Cell Biology, Bioenergetics, Genetics, Human Physiology, Biotechnology & Evolution.",
                vocab_count=0
            ),
            SubjectInfo(
                id="sub_mdcat_chem",
                name="Chemistry",
                code="CHEM-102",
                color="#38BDF8",
                documents=[],
                mastery_percentage=0,
                summary_brief="Physical, Inorganic, Organic Chemistry & Biochemical reaction mechanisms.",
                vocab_count=0
            ),
            SubjectInfo(
                id="sub_mdcat_phy",
                name="Physics",
                code="PHY-103",
                color="#818CF8",
                documents=[],
                mastery_percentage=0,
                summary_brief="Force & Motion, Work & Energy, Thermodynamics, Electrostatics & Nuclear Physics.",
                vocab_count=0
            ),
            SubjectInfo(
                id="sub_mdcat_eng",
                name="English",
                code="ENG-104",
                color="#C084FC",
                documents=[],
                mastery_percentage=0,
                summary_brief="Vocabulary, Grammar rules, Tenses, Sentence completion & Critical reading.",
                vocab_count=0
            ),
            SubjectInfo(
                id="sub_mdcat_logic",
                name="Logical Reasoning",
                code="LOG-105",
                color="#F59E0B",
                documents=[],
                mastery_percentage=0,
                summary_brief="Critical deduction, Symbol sequences, Logical syllogisms & Analytical reasoning.",
                vocab_count=0
            ),
        ],
        total_documents=0,
        total_subjects=5,
        overall_progress_percentage=0
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/courses/list", response_model=List[CourseInfo])
async def list_user_courses(session_id: str = Depends(get_session_id)):
    """
    Returns all registered multi-subject courses for the student (initialized with clean MDCAT structure).
    """
    if not _COURSES_CACHE:
        default_c = _get_default_mdcat_course()
        _COURSES_CACHE[default_c.id] = default_c

    return list(_COURSES_CACHE.values())


@router.post("/courses/create", response_model=CourseInfo)
async def create_course(payload: CreateCourseRequest, session_id: str = Depends(get_session_id)):
    """
    Creates a new custom course container.
    """
    course_id = f"course_{uuid.uuid4().hex[:8]}"
    colors = ["#10B981", "#38BDF8", "#818CF8", "#C084FC", "#F59E0B", "#EC4899", "#2DD4BF"]

    subjects: List[SubjectInfo] = []
    for idx, s_name in enumerate(payload.subject_names or ["General Science"]):
        subjects.append(
            SubjectInfo(
                id=f"sub_{uuid.uuid4().hex[:6]}",
                name=s_name.strip(),
                code=f"{s_name.strip()[:3].upper()}-{100 + idx}",
                color=colors[idx % len(colors)],
                documents=[],
                mastery_percentage=0,
                vocab_count=0
            )
        )

    course = CourseInfo(
        id=course_id,
        title=payload.title,
        description=payload.description or "Multi-subject study track",
        target_exam_or_degree=payload.target_exam_or_degree or "MDCAT",
        created_at=datetime.now(timezone.utc).isoformat(),
        subjects=subjects,
        total_documents=0,
        total_subjects=len(subjects),
        overall_progress_percentage=0
    )

    _COURSES_CACHE[course_id] = course
    return course


@router.post("/courses/{course_id}/subjects/add", response_model=SubjectInfo)
async def add_subject_to_course(course_id: str, payload: AddSubjectRequest):
    """
    Adds a new subject track to an existing course.
    """
    course = _COURSES_CACHE.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")

    colors = ["#10B981", "#38BDF8", "#818CF8", "#C084FC", "#F59E0B", "#EC4899", "#2DD4BF"]
    color = payload.color or colors[len(course.subjects) % len(colors)]
    sub = SubjectInfo(
        id=f"sub_{uuid.uuid4().hex[:6]}",
        name=payload.name.strip(),
        code=payload.code or f"{payload.name.strip()[:3].upper()}-{100 + len(course.subjects)}",
        color=color,
        documents=[],
        mastery_percentage=0,
        vocab_count=0
    )
    course.subjects.append(sub)
    course.total_subjects = len(course.subjects)
    return sub


@router.post("/courses/{course_id}/upload-batch")
async def upload_course_batch_files(
    course_id: str,
    subject_id: str = Form(...),
    files: List[UploadFile] = File(...),
    session_id: str = Depends(get_session_id)
):
    """
    Batch uploads documents (.pdf, .txt, .md) to a specific subject in the course.
    """
    course = _COURSES_CACHE.get(course_id)
    if not course:
        courses = list(_COURSES_CACHE.values())
        if courses:
            course = courses[0]
        else:
            default_c = _get_default_mdcat_course()
            _COURSES_CACHE[default_c.id] = default_c
            course = default_c

    subject = next((s for s in course.subjects if s.id == subject_id), None)
    if not subject and course.subjects:
        subject = course.subjects[0]

    uploaded_docs: List[SubjectDocument] = []

    for f in files:
        content_bytes = await f.read()
        filename = f.filename or "subject_note.pdf"
        extracted = extract_text_from_file(filename=filename, file_bytes=content_bytes)

        doc_id = str(uuid.uuid4())
        uploaded_at = datetime.now(timezone.utc).isoformat()

        chunks = get_token_chunks(
            text=extracted,
            doc_id=doc_id,
            base_metadata={
                "session_id": session_id,
                "course_id": course_id,
                "subject_id": subject.id if subject else "",
                "subject_name": subject.name if subject else "General",
                "filename": filename,
                "uploaded_at": uploaded_at
            }
        )

        if chunks:
            vector_store.add_documents(
                documents=[c["text"] for c in chunks],
                metadatas=[c["metadata"] for c in chunks],
                ids=[c["id"] for c in chunks]
            )

        doc_item = SubjectDocument(
            id=doc_id,
            filename=filename,
            size_bytes=len(content_bytes),
            chunk_count=len(chunks),
            uploaded_at=uploaded_at
        )

        if subject:
            subject.documents.append(doc_item)
            subject.vocab_count += max(15, len(chunks) * 2)
            subject.mastery_percentage = min(100, subject.mastery_percentage + 20)

        uploaded_docs.append(doc_item)

    course.total_documents = sum(len(s.documents) for s in course.subjects)

    return {
        "success": True,
        "course_id": course_id,
        "subject_name": subject.name if subject else "General",
        "uploaded_count": len(uploaded_docs),
        "documents": uploaded_docs
    }


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str):
    """
    Deletes a course track from cache.
    """
    _COURSES_CACHE.pop(course_id, None)
    return {"success": True, "course_id": course_id}
