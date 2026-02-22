from datetime import datetime
import uuid

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models.document import Document
from app.db.models.inference import InferenceRun, DocumentInference
from app.ml.models.emotion import predict_emotion


@celery_app.task(name="infer_docs.run_emotion_inference")
def run_emotion_inference(inference_run_id: str, document_ids: list[str]) -> dict:
    run_uuid = uuid.UUID(inference_run_id)
    doc_uuids = [uuid.UUID(d) for d in document_ids]

    db = SessionLocal()
    try:
        run = db.get(InferenceRun, run_uuid)
        if run is None:
            return {"ok": False, "error": "inference_run not found"}

        run.status = "running"
        run.started_at = run.started_at or datetime.utcnow()
        db.commit()

        inserted = 0

        docs = db.query(Document).filter(Document.id.in_(doc_uuids)).all()
        docs_by_id = {d.id: d for d in docs}

        for doc_id in doc_uuids:
            doc = docs_by_id.get(doc_id)
            if doc is None:
                continue

            pred = predict_emotion(doc.text_redacted)

            row = DocumentInference(
                document_id=doc.id,
                inference_run_id=run.id,
                sentiment=pred.sentiment,
                emotion_labels=pred.emotion_labels,
                calibrated_confidence=pred.calibrated_confidence,
                # optional generic payload too
                result={
                    "sentiment": pred.sentiment,
                    "emotion_labels": pred.emotion_labels,
                    "calibrated_confidence": pred.calibrated_confidence,
                },
            )
            db.add(row)
            inserted += 1

        run.status = "completed"
        run.finished_at = datetime.utcnow()
        run.summary = {"inserted": inserted}
        db.commit()

        return {"ok": True, "inserted": inserted}

    except Exception as e:
        # best-effort mark failed
        try:
            run = db.get(InferenceRun, run_uuid)
            if run is not None:
                run.status = "failed"
                run.finished_at = datetime.utcnow()
                run.summary = {"error": str(e)}
                db.commit()
        except Exception:
            pass
        raise
    finally:
        db.close()