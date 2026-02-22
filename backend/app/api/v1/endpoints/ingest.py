from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_api_key
from app.core.pii import redact_pii
from app.db.session import get_db
from app.db.models.document import Document
from app.schemas.ingestion import IngestRequest, IngestResponse, IngestResponseItem
from app.db.models.inference import InferenceRun
from app.tasks.infer_docs import run_emotion_inference

router = APIRouter(prefix="/ingest", dependencies=[Depends(require_api_key)])

@router.post("/tickets", response_model=IngestResponse)
def ingest_tickets(payload: IngestRequest, db: Session = Depends(get_db)) -> IngestResponse:
    out_items: list[IngestResponseItem] = []
    doc_ids: list[str] = []  # <-- collect document IDs for the worker

    for item in payload.items:
        redaction = redact_pii(item.text)

        doc = Document(
            external_id=item.external_id,
            org_id=item.org_id,
            team_id=item.team_id,
            source=item.source,
            channel=item.channel,
            tags=item.tags,
            timestamp=item.timestamp,
            text_redacted=redaction.text_redacted,
            redaction_summary=redaction.summary,
        )
        db.add(doc)
        db.flush()  # assigns doc.id

        doc_ids.append(str(doc.id))  # <-- add doc id for inference

        out_items.append(
            IngestResponseItem(
                document_id=str(doc.id),
                external_id=doc.external_id,
                redaction_summary=doc.redaction_summary,
            )
        )

    inference_run_id: str | None = None

    # If requested, create an inference run record (queued)
    if payload.enqueue_inference:
        run = InferenceRun(
            model_name="emotion",
            model_version="v1",
            status="queued",
        )
        db.add(run)
        db.flush()  # assigns run.id
        inference_run_id = str(run.id)

    db.commit()  # commit docs + run before the worker reads them

    # Enqueue celery job after commit
    if payload.enqueue_inference and inference_run_id:
        run_emotion_inference.delay(inference_run_id, doc_ids)

    return IngestResponse(inserted=len(out_items), items=out_items)