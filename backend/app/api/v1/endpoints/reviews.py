from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.security import ClientContext, require_api_key
from app.db.models.audit_log import AuditLog
from app.db.models.document import Document
from app.db.models.inference import DocumentInference
from app.db.models.inference_review import InferenceReview
from app.db.session import get_db
from app.schemas.reviews import (
    InferenceReviewOut,
    ReviewHistoryEntryOut,
    ReviewQueueInferenceOut,
    ReviewQueueItemOut,
    ReviewQueueResponse,
    SubmitInferenceReviewIn,
)

router = APIRouter(prefix="/reviews", dependencies=[Depends(require_api_key)])


def to_review_out(review: InferenceReview) -> InferenceReviewOut:
    return InferenceReviewOut(
        id=str(review.id),
        status=review.status,
        reviewer_name=review.reviewer_name,
        feedback=review.feedback,
        edited_sentiment=review.edited_sentiment,
        edited_emotion_labels=review.edited_emotion_labels,
        edited_confidence=review.edited_confidence,
        reviewed_at=review.reviewed_at,
        created_at=review.created_at,
        updated_at=review.updated_at,
    )


def review_actor(payload: SubmitInferenceReviewIn, ctx: ClientContext) -> str:
    if payload.reviewer_name:
        return payload.reviewer_name
    return f"org-reviewer:{ctx.org_id}"


@router.get("/queue", response_model=ReviewQueueResponse)
def get_review_queue(
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
    limit: int = Query(10, ge=1, le=50),
    state: str = Query("pending"),
):
    normalized_state = state.strip().lower()
    if normalized_state not in {"pending", "reviewed", "all"}:
        raise HTTPException(status_code=400, detail="state must be pending, reviewed, or all")

    docs = (
        db.query(Document)
        .filter(Document.org_id == ctx.org_id)
        .order_by(desc(Document.created_at))
        .limit(max(limit * 3, limit))
        .all()
    )

    items: list[ReviewQueueItemOut] = []
    for doc in docs:
        latest = (
            db.query(DocumentInference)
            .filter(DocumentInference.document_id == doc.id)
            .order_by(desc(DocumentInference.created_at))
            .first()
        )
        if latest is None:
            continue

        review = (
            db.query(InferenceReview)
            .filter(InferenceReview.document_inference_id == latest.id)
            .first()
        )
        review_status = review.status if review else "pending"

        if normalized_state == "pending" and review is not None:
            continue
        if normalized_state == "reviewed" and review is None:
            continue

        history_rows = (
            db.query(AuditLog)
            .filter(
                AuditLog.entity_type == "document_inference_review",
                AuditLog.entity_id == str(latest.id),
            )
            .order_by(desc(AuditLog.created_at))
            .limit(5)
            .all()
        )

        items.append(
            ReviewQueueItemOut(
                document_id=str(doc.id),
                external_id=doc.external_id,
                org_id=doc.org_id,
                source=doc.source,
                channel=doc.channel,
                timestamp=doc.timestamp,
                text_redacted=doc.text_redacted,
                inference=ReviewQueueInferenceOut(
                    id=str(latest.id),
                    created_at=latest.created_at,
                    sentiment=latest.sentiment,
                    emotion_labels=latest.emotion_labels,
                    calibrated_confidence=latest.calibrated_confidence,
                    result=latest.result,
                ),
                review_status=review_status,
                review=to_review_out(review) if review else None,
                history=[
                    ReviewHistoryEntryOut(
                        id=str(row.id),
                        actor=row.actor,
                        action=row.action,
                        created_at=row.created_at,
                        meta=row.meta or {},
                    )
                    for row in history_rows
                ],
            )
        )

        if len(items) >= limit:
            break

    return ReviewQueueResponse(items=items)


@router.post("/documents/{document_id}", response_model=InferenceReviewOut)
def submit_inference_review(
    document_id: str,
    payload: SubmitInferenceReviewIn,
    db: Session = Depends(get_db),
    ctx: ClientContext = Depends(require_api_key),
):
    doc = db.get(Document, document_id)
    if doc is None or doc.org_id != ctx.org_id:
        raise HTTPException(status_code=404, detail="Document not found")

    latest = (
        db.query(DocumentInference)
        .filter(DocumentInference.document_id == doc.id)
        .order_by(desc(DocumentInference.created_at))
        .first()
    )
    if latest is None:
        raise HTTPException(status_code=404, detail="No inference found for document")

    review = (
        db.query(InferenceReview)
        .filter(InferenceReview.document_inference_id == latest.id)
        .first()
    )

    now = datetime.utcnow()
    created = review is None
    if review is None:
        review = InferenceReview(
            document_id=doc.id,
            document_inference_id=latest.id,
            org_id=doc.org_id,
            status=payload.status,
            reviewer_name=payload.reviewer_name,
            feedback=payload.feedback,
            edited_sentiment=payload.edited_sentiment,
            edited_emotion_labels=payload.edited_emotion_labels,
            edited_confidence=payload.edited_confidence,
            reviewed_at=now,
        )
        db.add(review)
    else:
        review.status = payload.status
        review.reviewer_name = payload.reviewer_name
        review.feedback = payload.feedback
        review.edited_sentiment = payload.edited_sentiment
        review.edited_emotion_labels = payload.edited_emotion_labels
        review.edited_confidence = payload.edited_confidence
        review.reviewed_at = now

    db.add(
        AuditLog(
            actor=review_actor(payload, ctx),
            action="inference_review_submitted" if created else "inference_review_updated",
            entity_type="document_inference_review",
            entity_id=str(latest.id),
            meta={
                "document_id": str(doc.id),
                "document_inference_id": str(latest.id),
                "status": payload.status,
                "feedback": payload.feedback,
                "edited_sentiment": payload.edited_sentiment,
                "edited_emotion_labels": payload.edited_emotion_labels,
                "edited_confidence": payload.edited_confidence,
            },
        )
    )
    db.commit()
    db.refresh(review)
    return to_review_out(review)
