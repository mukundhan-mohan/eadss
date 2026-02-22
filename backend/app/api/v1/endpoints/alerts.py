from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.security import require_api_key
from app.db.session import get_db
from app.db.models.aggregations import AlertEvent
from app.db.models.alerts import AlertEvidence
from app.db.models.document import Document
from app.db.models.inference import DocumentInference
from app.schemas.alerts import AlertOut, AlertDetail, EvidenceOut

router = APIRouter(prefix="/alerts", dependencies=[Depends(require_api_key)])

@router.get("", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    org_id: str | None = None,
    team_id: str | None = None,
    alert_type: str | None = None,
    severity: str | None = None,
):
    q = db.query(AlertEvent)
    if org_id: q = q.filter(AlertEvent.org_id == org_id)
    if team_id: q = q.filter(AlertEvent.team_id == team_id)
    if alert_type: q = q.filter(AlertEvent.alert_type == alert_type)
    if severity: q = q.filter(AlertEvent.severity == severity)

    rows = q.order_by(desc(AlertEvent.created_at)).limit(limit).all()

    return [
        AlertOut(
            id=str(a.id),
            created_at=a.created_at,
            day=a.day,
            alert_type=a.alert_type,
            severity=a.severity,
            org_id=a.org_id,
            team_id=a.team_id,
            channel=a.channel,
            metric=a.metric,
            value=float(a.value),
            baseline=a.baseline or {},
            message=a.message,
        )
        for a in rows
    ]


@router.get("/{alert_id}", response_model=AlertDetail)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    alert = db.get(AlertEvent, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    evidence_rows = (
        db.query(AlertEvidence)
        .filter(AlertEvidence.alert_id == alert.id)
        .order_by(desc(AlertEvidence.contribution))
        .all()
    )

    evidence_out: list[EvidenceOut] = []
    for ev in evidence_rows:
        doc = db.get(Document, ev.document_id)
        latest_inf = (
            db.query(DocumentInference)
            .filter(DocumentInference.document_id == ev.document_id)
            .order_by(desc(DocumentInference.created_at))
            .first()
        )
        evidence_out.append(
            EvidenceOut(
                document_id=str(ev.document_id),
                contribution=float(ev.contribution),
                keyword_hits=ev.keyword_hits,
                highlights=ev.highlights,
                external_id=doc.external_id if doc else None,
                text_redacted=doc.text_redacted if doc else None,
                sentiment=latest_inf.sentiment if latest_inf else None,
                emotion_labels=latest_inf.emotion_labels if latest_inf else None,
                calibrated_confidence=latest_inf.calibrated_confidence if latest_inf else None,
            )
        )

    alert_out = AlertOut(
        id=str(alert.id),
        created_at=alert.created_at,
        day=alert.day,
        alert_type=alert.alert_type,
        severity=alert.severity,
        org_id=alert.org_id,
        team_id=alert.team_id,
        channel=alert.channel,
        metric=alert.metric,
        value=float(alert.value),
        baseline=alert.baseline or {},
        message=alert.message,
    )

    return AlertDetail(alert=alert_out, evidence=evidence_out)