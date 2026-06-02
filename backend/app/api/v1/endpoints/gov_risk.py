from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.security import ClientContext, require_api_key
from app.db.models.audit_log import AuditLog
from app.db.models.gov_risk import GovRiskAssessment, GovRiskHistoricalRecord, GovRiskIncident
from app.db.session import get_db
from app.schemas.gov_risk import (
    CreateGovRiskHistoricalRecordIn,
    CreateGovRiskIncidentIn,
    GovRiskAssessmentOut,
    GovRiskAuditEntryOut,
    GovRiskHistoricalRecordListResponse,
    GovRiskHistoricalRecordOut,
    GovRiskIncidentListResponse,
    GovRiskIncidentOut,
    SubmitGovRiskReviewIn,
)
from app.services.gov_risk import analyze_gov_risk

router = APIRouter(prefix="/gov-risk", dependencies=[Depends(require_api_key)])


def to_history_entry(row: AuditLog) -> GovRiskAuditEntryOut:
    return GovRiskAuditEntryOut(
        id=str(row.id),
        actor=row.actor,
        action=row.action,
        created_at=row.created_at,
        meta=row.meta or {},
    )


def to_assessment_out(assessment: GovRiskAssessment) -> GovRiskAssessmentOut:
    return GovRiskAssessmentOut(
        id=str(assessment.id),
        incident_id=str(assessment.incident_id),
        status=assessment.status,
        risk_level=assessment.risk_level,
        risk_score=assessment.risk_score,
        reason=assessment.reason,
        recommended_action=assessment.recommended_action,
        policy_match=assessment.policy_match,
        evidence=assessment.evidence or [],
        matched_record_count=assessment.matched_record_count,
        human_status=assessment.human_status,
        reviewer_name=assessment.reviewer_name,
        reviewer_feedback=assessment.reviewer_feedback,
        approved_risk_level=assessment.approved_risk_level,
        approved_risk_score=assessment.approved_risk_score,
        approved_recommended_action=assessment.approved_recommended_action,
        reviewed_at=assessment.reviewed_at,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
    )


def latest_assessment_for_incident(db: Session, incident_id: str) -> GovRiskAssessment | None:
    return (
        db.query(GovRiskAssessment)
        .filter(GovRiskAssessment.incident_id == incident_id)
        .order_by(desc(GovRiskAssessment.created_at))
        .first()
    )


def to_incident_out(db: Session, incident: GovRiskIncident) -> GovRiskIncidentOut:
    assessment = latest_assessment_for_incident(db, str(incident.id))
    history_rows = (
        db.query(AuditLog)
        .filter(AuditLog.entity_type == "gov_risk_incident", AuditLog.entity_id == str(incident.id))
        .order_by(desc(AuditLog.created_at))
        .limit(8)
        .all()
    )
    return GovRiskIncidentOut(
        id=str(incident.id),
        org_id=incident.org_id,
        title=incident.title,
        incident_text=incident.incident_text,
        sector=incident.sector,
        department=incident.department,
        severity=incident.severity,
        incident_date=incident.incident_date,
        location=incident.location,
        status=incident.status,
        latest_assessment=to_assessment_out(assessment) if assessment else None,
        history=[to_history_entry(row) for row in history_rows],
        created_at=incident.created_at,
        updated_at=incident.updated_at,
    )


def review_actor(payload: SubmitGovRiskReviewIn, ctx: ClientContext) -> str:
    if payload.reviewer_name:
        return payload.reviewer_name
    return f"gov-reviewer:{ctx.org_id}"


@router.post("/incidents", response_model=GovRiskIncidentOut)
def create_incident(
    payload: CreateGovRiskIncidentIn,
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
) -> GovRiskIncidentOut:
    incident = GovRiskIncident(
        org_id=ctx.org_id,
        title=payload.title,
        incident_text=payload.incident_text,
        sector=payload.sector,
        department=payload.department,
        severity=payload.severity,
        incident_date=payload.incident_date,
        location=payload.location,
        status="open",
    )
    db.add(incident)
    db.flush()

    analysis = analyze_gov_risk(
        db,
        org_id=ctx.org_id,
        incident_text=payload.incident_text,
        sector=payload.sector,
        department=payload.department,
        severity=payload.severity,
        location=payload.location,
    )
    assessment = GovRiskAssessment(
        incident_id=incident.id,
        org_id=ctx.org_id,
        status="generated",
        risk_level=analysis.risk_level,
        risk_score=analysis.risk_score,
        reason=analysis.reason,
        recommended_action=analysis.recommended_action,
        policy_match=analysis.policy_match,
        evidence=analysis.evidence,
        matched_record_count=analysis.matched_record_count,
        human_status="pending",
    )
    db.add(assessment)
    db.add(
        AuditLog(
            actor=f"org:{ctx.org_id}",
            action="gov_risk_incident_created",
            entity_type="gov_risk_incident",
            entity_id=str(incident.id),
            meta={
                "title": incident.title,
                "sector": incident.sector,
                "department": incident.department,
                "severity": incident.severity,
                "risk_level": analysis.risk_level,
                "risk_score": analysis.risk_score,
            },
        )
    )
    db.commit()
    db.refresh(incident)
    return to_incident_out(db, incident)


@router.get("/incidents", response_model=GovRiskIncidentListResponse)
def list_incidents(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
) -> GovRiskIncidentListResponse:
    incidents = (
        db.query(GovRiskIncident)
        .filter(GovRiskIncident.org_id == ctx.org_id)
        .order_by(desc(GovRiskIncident.created_at))
        .limit(limit)
        .all()
    )
    return GovRiskIncidentListResponse(items=[to_incident_out(db, incident) for incident in incidents])


@router.get("/incidents/{incident_id}", response_model=GovRiskIncidentOut)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
) -> GovRiskIncidentOut:
    incident = db.get(GovRiskIncident, incident_id)
    if incident is None or incident.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Incident not found")
    return to_incident_out(db, incident)


@router.post("/historical-records", response_model=GovRiskHistoricalRecordOut)
def create_historical_record(
    payload: CreateGovRiskHistoricalRecordIn,
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
) -> GovRiskHistoricalRecordOut:
    record = GovRiskHistoricalRecord(
        org_id=ctx.org_id,
        title=payload.title,
        summary=payload.summary,
        sector=payload.sector,
        department=payload.department,
        severity=payload.severity,
        location=payload.location,
        event_date=payload.event_date,
        outcome=payload.outcome,
    )
    db.add(record)
    db.flush()
    db.add(
        AuditLog(
            actor=f"org:{ctx.org_id}",
            action="gov_risk_historical_record_created",
            entity_type="gov_risk_historical_record",
            entity_id=str(record.id),
            meta={
                "title": record.title,
                "sector": record.sector,
                "department": record.department,
                "severity": record.severity,
            },
        )
    )
    db.commit()
    db.refresh(record)
    return GovRiskHistoricalRecordOut(
        id=str(record.id),
        title=record.title,
        summary=record.summary,
        sector=record.sector,
        department=record.department,
        severity=record.severity,
        location=record.location,
        event_date=record.event_date,
        outcome=record.outcome,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.get("/historical-records", response_model=GovRiskHistoricalRecordListResponse)
def list_historical_records(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
) -> GovRiskHistoricalRecordListResponse:
    records = (
        db.query(GovRiskHistoricalRecord)
        .filter(GovRiskHistoricalRecord.org_id == ctx.org_id)
        .order_by(desc(GovRiskHistoricalRecord.created_at))
        .limit(limit)
        .all()
    )
    return GovRiskHistoricalRecordListResponse(
        items=[
            GovRiskHistoricalRecordOut(
                id=str(record.id),
                title=record.title,
                summary=record.summary,
                sector=record.sector,
                department=record.department,
                severity=record.severity,
                location=record.location,
                event_date=record.event_date,
                outcome=record.outcome,
                created_at=record.created_at,
                updated_at=record.updated_at,
            )
            for record in records
        ]
    )


@router.post("/incidents/{incident_id}/review", response_model=GovRiskAssessmentOut)
def review_incident(
    incident_id: str,
    payload: SubmitGovRiskReviewIn,
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
) -> GovRiskAssessmentOut:
    incident = db.get(GovRiskIncident, incident_id)
    if incident is None or incident.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Incident not found")

    assessment = latest_assessment_for_incident(db, incident_id)
    if assessment is None:
        raise HTTPException(status_code=404, detail="Assessment not found")

    assessment.human_status = payload.status
    assessment.reviewer_name = payload.reviewer_name
    assessment.reviewer_feedback = payload.feedback
    assessment.approved_risk_level = payload.approved_risk_level
    assessment.approved_risk_score = payload.approved_risk_score
    assessment.approved_recommended_action = payload.approved_recommended_action
    assessment.reviewed_at = datetime.utcnow()

    db.add(
        AuditLog(
            actor=review_actor(payload, ctx),
            action="gov_risk_review_submitted",
            entity_type="gov_risk_incident",
            entity_id=str(incident.id),
            meta={
                "assessment_id": str(assessment.id),
                "status": payload.status,
                "approved_risk_level": payload.approved_risk_level,
                "approved_risk_score": payload.approved_risk_score,
                "approved_recommended_action": payload.approved_recommended_action,
            },
        )
    )
    db.commit()
    db.refresh(assessment)
    return to_assessment_out(assessment)
