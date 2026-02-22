from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.security import require_api_key
from app.db.session import get_db
from app.db.models.document import Document
from app.db.models.inference import DocumentInference
from app.schemas.document import DocumentLatestInferenceResponse, InferenceOut

router = APIRouter(prefix="/documents", dependencies=[Depends(require_api_key)])

@router.get("/{document_id}/inference", response_model=DocumentLatestInferenceResponse)
def get_latest_inference(document_id: str, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    latest = (
        db.query(DocumentInference)
        .filter(DocumentInference.document_id == doc.id)
        .order_by(desc(DocumentInference.created_at))
        .first()
    )

    if latest is None:
        return DocumentLatestInferenceResponse(document_id=str(doc.id), latest=None)

    return DocumentLatestInferenceResponse(
        document_id=str(doc.id),
        latest=InferenceOut(
            id=str(latest.id),
            inference_run_id=str(latest.inference_run_id),
            created_at=latest.created_at,
            sentiment=latest.sentiment,
            emotion_labels=latest.emotion_labels,
            calibrated_confidence=latest.calibrated_confidence,
            result=latest.result,
        ),
    )