from __future__ import annotations

from datetime import datetime
import uuid

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models.pdf_document import PdfDocument
from app.db.models.pdf_chunk import PdfChunk
from app.services.pdf_rag import PDF_EMBEDDING_MODEL, chunk_page_text, embed_texts, extract_pdf_pages


@celery_app.task(name="pdf_rag.process_pdf_document")
def process_pdf_document(document_id: str) -> dict:
    db = SessionLocal()
    try:
        doc_uuid = uuid.UUID(document_id)
        document = db.get(PdfDocument, doc_uuid)
        if document is None:
            return {"ok": False, "error": "pdf_document not found"}

        document.status = "processing"
        document.error_message = None
        db.commit()

        pages = extract_pdf_pages(document.storage_path)

        chunk_candidates = []
        next_chunk_index = 0
        for page_number, text in pages:
            page_chunks = chunk_page_text(page_number=page_number, text=text, start_index=next_chunk_index)
            chunk_candidates.extend(page_chunks)
            next_chunk_index += len(page_chunks)

        chunk_texts = [candidate.text for candidate in chunk_candidates]
        embeddings = embed_texts(chunk_texts) if chunk_texts else []

        db.query(PdfChunk).filter(PdfChunk.document_id == document.id).delete()
        db.flush()

        for candidate, embedding in zip(chunk_candidates, embeddings):
            db.add(
                PdfChunk(
                    document_id=document.id,
                    org_id=document.org_id,
                    page_number=candidate.page_number,
                    chunk_index=candidate.chunk_index,
                    text=candidate.text,
                    embedding=embedding,
                )
            )

        document.page_count = len(pages)
        document.chunk_count = len(chunk_candidates)
        document.embedding_model = PDF_EMBEDDING_MODEL
        document.status = "ready"
        document.updated_at = datetime.utcnow()
        db.commit()

        return {
            "ok": True,
            "document_id": document_id,
            "pages": len(pages),
            "chunks": len(chunk_candidates),
            "embedding_model": PDF_EMBEDDING_MODEL,
        }
    except Exception as exc:
        try:
            document = db.get(PdfDocument, uuid.UUID(document_id))
            if document is not None:
                document.status = "failed"
                document.error_message = str(exc)
                document.updated_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()
