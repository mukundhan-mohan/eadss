from datetime import datetime

from pydantic import BaseModel, Field


class PdfDocumentOut(BaseModel):
    id: str
    org_id: str
    title: str | None = None
    filename: str
    mime_type: str
    status: str
    embedding_model: str | None = None
    page_count: int | None = None
    chunk_count: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class PdfDocumentListResponse(BaseModel):
    items: list[PdfDocumentOut]


class PdfAskIn(BaseModel):
    question: str = Field(min_length=3)
    document_id: str | None = None
    top_k: int = Field(default=5, ge=1, le=10)


class PdfAnswerEvidenceOut(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str | None = None
    page_number: int
    chunk_index: int
    score: float
    excerpt: str


class PdfAskOut(BaseModel):
    question: str
    answer: str
    evidence: list[PdfAnswerEvidenceOut]
