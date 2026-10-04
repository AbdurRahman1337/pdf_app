from typing import List, Optional
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    chroma_status: str = "connected"
    collection_count: int = 0


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of message sender: user, assistant, or system")
    content: str = Field(..., description="Message text content")
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp string")


class DocumentSource(BaseModel):
    doc_id: str
    filename: str
    chunk_index: int
    content: str
    score: float = Field(..., description="Relevance score (0.0 to 1.0 or percentage)")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User query")
    history: List[ChatMessage] = Field(default_factory=list, description="Prior conversation turns")
    session_id: Optional[str] = Field(default=None, description="Client session identifier")


class ChatResponse(BaseModel):
    answer: str
    sources: List[DocumentSource] = Field(default_factory=list)
    session_id: str


class UploadResponse(BaseModel):
    doc_id: str
    filename: str
    total_chunks: int
    total_characters: int
    session_id: str
    storage_provider: str = "google_drive"
    drive_file_id: Optional[str] = None
    drive_web_view_link: Optional[str] = None
    message: str = "File uploaded to Google Drive and indexed successfully"


class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_answer: str
    explanation: str


class QuizGenerateRequest(BaseModel):
    topic: str = Field(default="General Concepts", description="Subject or concept to quiz on")
    pdf_id: Optional[str] = Field(default=None, description="Target document ID if scoped to a specific PDF")
    num_questions: int = Field(default=5, ge=1, le=15, description="Number of questions to generate (e.g. 3, 5, 10)")
    session_id: Optional[str] = Field(default=None, description="Client session identifier")


class QuizGenerateResponse(BaseModel):
    topic: str
    questions: List[QuizQuestion]
    total_questions: int
    session_id: str


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    chunk_count: int
    uploaded_at: Optional[str] = None
    storage_provider: str = "google_drive"
    drive_file_id: Optional[str] = None
    drive_web_view_link: Optional[str] = None


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo] = Field(default_factory=list)
    total_documents: int = 0
    total_chunks: int = 0


class ErrorDetailResponse(BaseModel):
    detail: str
    error_type: Optional[str] = None
    status_code: int

