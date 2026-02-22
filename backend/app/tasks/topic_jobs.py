from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models.document import Document
from app.db.models.topic import Topic
from app.db.models.document_topic import DocumentTopic

# Heavy imports inside task to keep worker startup fast
def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

@celery_app.task(name="topic_jobs.run_bertopic")
def run_bertopic(
    org_id: str | None = "demo",
    team_id: str | None = None,
    lookback_days: int = 14,
    min_docs: int = 20,
) -> dict:
    """
    Periodic job: cluster recent docs into topics.
    Stores:
      - topics (per run_id)
      - document_topics (per run_id)
    """
    db = SessionLocal()
    run_id = uuid.uuid4()
    try:
        since = _utc_now() - timedelta(days=int(lookback_days))

        q = db.query(Document).filter(Document.created_at >= since)
        if org_id:
            q = q.filter(Document.org_id == org_id)
        if team_id:
            q = q.filter(Document.team_id == team_id)

        docs = q.order_by(Document.created_at.asc()).all()
        if len(docs) < min_docs:
            return {"ok": True, "skipped": True, "reason": f"not enough docs ({len(docs)})", "run_id": str(run_id)}

        texts = [d.text_redacted for d in docs]
        doc_ids = [d.id for d in docs]

        from sentence_transformers import SentenceTransformer
        from bertopic import BERTopic

        embedder = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = embedder.encode(texts, show_progress_bar=False, normalize_embeddings=True)

        topic_model = BERTopic(verbose=False)
        topics, probs = topic_model.fit_transform(texts, embeddings)

        # Build topic metadata
        topic_info = topic_model.get_topic_info()
        # topic_info has columns like: Topic, Count, Name (varies by version); we avoid hard dependency.

        # Create Topic rows keyed by BERTopic topic id
        topic_uuid_by_key: dict[int, uuid.UUID] = {}

        # topic_model.get_topics() returns dict: topic_id -> list[(word, weight)]
        topics_dict = topic_model.get_topics()

        for topic_key, words in topics_dict.items():
            if words is None:
                top_words = None
            else:
                top_words = [w for (w, _score) in words[:10]]

            # Count docs assigned to that topic_key
            doc_count = int(sum(1 for t in topics if t == topic_key))

            trow = Topic(
                id=uuid.uuid4(),
                run_id=run_id,
                org_id=org_id,
                team_id=team_id,
                topic_key=int(topic_key),
                name=(f"Topic {topic_key}" if topic_key != -1 else "Outliers"),
                top_words=top_words,
                doc_count=doc_count,
            )
            db.add(trow)
            topic_uuid_by_key[int(topic_key)] = trow.id

        db.flush()

        # Write document assignments
        inserted = 0
        for i, doc_id in enumerate(doc_ids):
            topic_key = int(topics[i])
            topic_id = topic_uuid_by_key.get(topic_key)
            if topic_id is None:
                continue

            p = None
            if probs is not None:
                try:
                    p = float(probs[i]) if probs[i] is not None else None
                except Exception:
                    p = None

            db.add(
                DocumentTopic(
                    run_id=run_id,
                    document_id=doc_id,
                    topic_id=topic_id,
                    probability=p,
                )
            )
            inserted += 1

        db.commit()
        return {"ok": True, "run_id": str(run_id), "docs": len(docs), "assignments": inserted}

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()