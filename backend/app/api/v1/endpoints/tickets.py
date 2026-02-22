from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.security import require_api_key, ClientContext
from app.db.session import get_db
from app.db.models.document import Document
from app.db.models.inference import DocumentInference
from app.schemas.tickets import TicketResponse, TicketDocOut, TicketInferenceOut

router = APIRouter(prefix="/tickets")


@router.get("/{external_id}", response_model=TicketResponse)
def get_ticket(
    external_id: str,
    team_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    client: ClientContext = Depends(require_api_key),
) -> TicketResponse:
    q = db.query(Document).filter(Document.external_id == external_id, Document.org_id == client.org_id)
    if team_id:
        q = q.filter(Document.team_id == team_id)

    doc = q.order_by(desc(Document.created_at)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Ticket not found")

    latest = (
        db.query(DocumentInference)
        .filter(DocumentInference.document_id == doc.id)
        .order_by(desc(DocumentInference.created_at))
        .first()
    )

    return TicketResponse(
        ticket=TicketDocOut(
            id=str(doc.id),
            external_id=doc.external_id,
            org_id=doc.org_id,
            team_id=doc.team_id,
            source=doc.source,
            channel=doc.channel,
            tags=doc.tags,
            timestamp=doc.timestamp,
            text_redacted=doc.text_redacted,
            redaction_summary=doc.redaction_summary,
        ),
        latest_inference=(
            TicketInferenceOut(
                id=str(latest.id),
                inference_run_id=str(latest.inference_run_id),
                created_at=latest.created_at,
                sentiment=latest.sentiment,
                emotion_labels=latest.emotion_labels,
                calibrated_confidence=latest.calibrated_confidence,
                result=latest.result,
            )
            if latest
            else None
        ),
    )