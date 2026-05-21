from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.security import ClientContext, require_api_key
from app.db.session import get_db
from app.db.models.pdf_document import PdfDocument
from app.schemas.pdf_rag import PdfAskIn, PdfAskOut, PdfAnswerEvidenceOut, PdfDocumentListResponse, PdfDocumentOut
from app.services.pdf_rag import build_answer, embed_texts, ensure_upload_dir, rerank_chunks, retrieve_similar_chunks
from app.tasks.pdf_rag import process_pdf_document

router = APIRouter(prefix="/pdf")


def _to_out(document: PdfDocument) -> PdfDocumentOut:
    return PdfDocumentOut(
        id=str(document.id),
        org_id=document.org_id,
        title=document.title,
        filename=document.filename,
        mime_type=document.mime_type,
        status=document.status,
        embedding_model=document.embedding_model,
        page_count=document.page_count,
        chunk_count=document.chunk_count,
        error_message=document.error_message,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.post("/upload", response_model=PdfDocumentOut)
def upload_pdf(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    client: ClientContext = Depends(require_api_key),
) -> PdfDocumentOut:
    filename = file.filename or "document.pdf"
    content_type = (file.content_type or "").lower()
    if content_type != "application/pdf" and not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    doc_id = uuid.uuid4()
    root = ensure_upload_dir()
    org_dir = root / client.org_id
    org_dir.mkdir(parents=True, exist_ok=True)
    storage_path = org_dir / f"{doc_id}.pdf"

    try:
        with storage_path.open("wb") as handle:
            shutil.copyfileobj(file.file, handle)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to store uploaded PDF: {exc}") from exc
    finally:
        file.file.close()

    document = PdfDocument(
        id=doc_id,
        org_id=client.org_id,
        title=(title or Path(filename).stem).strip() or Path(filename).stem,
        filename=filename,
        mime_type=content_type or "application/pdf",
        storage_path=str(storage_path),
        status="uploaded",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    process_pdf_document.delay(str(document.id))
    return _to_out(document)


@router.get("/documents", response_model=PdfDocumentListResponse)
def list_pdf_documents(
    db: Session = Depends(get_db),
    client: ClientContext = Depends(require_api_key),
) -> PdfDocumentListResponse:
    rows = (
        db.query(PdfDocument)
        .filter(PdfDocument.org_id == client.org_id)
        .order_by(PdfDocument.created_at.desc())
        .all()
    )
    return PdfDocumentListResponse(items=[_to_out(row) for row in rows])


@router.get("/documents/{document_id}", response_model=PdfDocumentOut)
def get_pdf_document(
    document_id: str,
    db: Session = Depends(get_db),
    client: ClientContext = Depends(require_api_key),
) -> PdfDocumentOut:
    row = db.query(PdfDocument).filter(PdfDocument.id == document_id, PdfDocument.org_id == client.org_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="PDF document not found")
    return _to_out(row)


@router.post("/ask", response_model=PdfAskOut)
def ask_pdf_question(
    payload: PdfAskIn,
    db: Session = Depends(get_db),
    client: ClientContext = Depends(require_api_key),
) -> PdfAskOut:
    target_document: PdfDocument | None = None
    if payload.document_id:
        target_document = (
            db.query(PdfDocument)
            .filter(PdfDocument.id == payload.document_id, PdfDocument.org_id == client.org_id)
            .first()
        )
        if target_document is None:
            raise HTTPException(status_code=404, detail="PDF document not found")
        if target_document.status != "ready":
            raise HTTPException(status_code=409, detail=f"PDF document is not ready (status={target_document.status})")

    question_embedding = embed_texts([payload.question])[0]
    chunks = retrieve_similar_chunks(
        db,
        org_id=client.org_id,
        question_embedding=question_embedding,
        top_k=payload.top_k,
        document_id=payload.document_id,
    )
    ranked_chunks = rerank_chunks(payload.question, chunks)

    answer = build_answer(payload.question, ranked_chunks)
    evidence = [
        PdfAnswerEvidenceOut(
            chunk_id=row["chunk_id"],
            document_id=row["document_id"],
            document_title=row.get("document_title"),
            page_number=int(row["page_number"]),
            chunk_index=int(row["chunk_index"]),
            score=float(row.get("boosted_score", row["score"])),
            excerpt=(row["text"][:400] + "...") if len(row["text"]) > 400 else row["text"],
        )
        for row in ranked_chunks
    ]

    return PdfAskOut(question=payload.question, answer=answer, evidence=evidence)
