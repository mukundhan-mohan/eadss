from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.core.security import require_api_key
from app.db.session import get_db
from app.db.models.document import Document
from app.schemas.document import DocumentOut, DocumentListResponse

router = APIRouter(prefix="/documents", dependencies=[Depends(require_api_key)])

@router.get("", response_model=DocumentListResponse)
def list_documents(
    db: Session = Depends(get_db),
    # pagination
    limit: int = Query(25, ge=1, le=200),
    offset: int = Query(0, ge=0),

    # filters
    org_id: str | None = None,
    team_id: str | None = None,
    source: str | None = None,
    channel: str | None = None,
    external_id: str | None = None,
    tag: str | None = None,

    # time window on the event timestamp (not created_at)
    since: datetime | None = None,
    until: datetime | None = None,
):
    q = db.query(Document)

    if org_id:
        q = q.filter(Document.org_id == org_id)
    if team_id:
        q = q.filter(Document.team_id == team_id)
    if source:
        q = q.filter(Document.source == source)
    if channel:
        q = q.filter(Document.channel == channel)
    if external_id:
        q = q.filter(Document.external_id == external_id)
    if tag:
        # tags stored as JSON array; simplest portable approach is substring match on JSON text
        # If you later switch tags to ARRAY(Text), we can make this clean.
        q = q.filter(func.cast(Document.tags, func.TEXT).ilike(f'%"{tag}"%'))
    if since:
        q = q.filter(Document.timestamp >= since)
    if until:
        q = q.filter(Document.timestamp <= until)

    total = q.order_by(None).count()

    rows = (
        q.order_by(desc(Document.created_at))
         .limit(limit)
         .offset(offset)
         .all()
    )

    items = [
        DocumentOut(
            id=str(d.id),
            external_id=d.external_id,
            org_id=d.org_id,
            team_id=d.team_id,
            source=d.source,
            channel=d.channel,
            tags=d.tags,
            timestamp=d.timestamp,
            text_redacted=d.text_redacted,
            redaction_summary=d.redaction_summary or {},
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in rows
    ]

    return DocumentListResponse(total=total, limit=limit, offset=offset, items=items)