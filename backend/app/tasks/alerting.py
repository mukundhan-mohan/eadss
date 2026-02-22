from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
import uuid

from sqlalchemy import text, desc, and_, or_, func
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
from app.db.models.aggregations import AlertEvent
from app.db.models.alerts import AlertRule, AlertEvidence
from app.db.models.document import Document
from app.db.models.inference import DocumentInference
from app.db.models.audit_log import AuditLog
from app.utils.explain import find_keyword_spans, compute_contribution


def utc_yesterday() -> date:
    return (datetime.now(timezone.utc) - timedelta(days=1)).date()


def audit(db: Session, action: str, entity_type: str | None, entity_id: str | None, meta: dict | None):
    db.add(
        AuditLog(
            actor="system",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=meta or {},
        )
    )


@celery_app.task(name="alerting.run_rules")
def run_rules(day: str | None = None) -> dict:
    db = SessionLocal()
    try:
        target_day = date.fromisoformat(day) if day else utc_yesterday()
        run_id = str(uuid.uuid4())

        audit(db, "rule_engine_run_started", "rule_engine_run", run_id, {"day": target_day.isoformat()})
        db.commit()

        rules = db.query(AlertRule).filter(AlertRule.is_enabled == True).all()  # noqa: E712
        created_alerts = 0
        created_evidence = 0

        # Idempotency: clear existing risk_spike alerts + evidence for that day
        # (Simple first. Later you can key by rule_id to avoid clobbering other alert types.)
        existing_alert_ids = [
            str(r[0]) for r in db.execute(
                text("SELECT id FROM alerts WHERE day=:day AND alert_type='risk_spike'"),
                {"day": target_day},
            ).fetchall()
        ]
        if existing_alert_ids:
            db.execute(text("DELETE FROM alert_evidence WHERE alert_id = ANY(:ids)"), {"ids": existing_alert_ids})
            db.execute(text("DELETE FROM alerts WHERE id = ANY(:ids)"), {"ids": existing_alert_ids})
            db.commit()

        for rule in rules:
            d = rule.definition or {}
            if d.get("type") != "risk_spike":
                continue

            baseline_days = int(d.get("baseline_days", 30))
            z_threshold = float(d.get("z_threshold", 3.5))
            min_docs = int(d.get("min_docs", 10))
            keywords = list(d.get("keywords", []))
            top_k = int(d.get("top_k_evidence", 10))

            rows = db.execute(
                text("""
                    SELECT day, org_id, team_id, channel,
                           SUM(CASE WHEN sentiment='negative' THEN doc_count ELSE 0 END)::int AS neg,
                           SUM(doc_count)::int AS total
                    FROM emotion_daily
                    WHERE day >= :start AND day <= :target
                    GROUP BY day, org_id, team_id, channel
                """),
                {"start": target_day - timedelta(days=baseline_days), "target": target_day},
            ).fetchall()

            from collections import defaultdict
            import statistics

            seg_series = defaultdict(list)
            for r in rows:
                day_i, org_id, team_id, channel, neg, total = r
                total = int(total or 0)
                neg = int(neg or 0)
                rate = (neg / total) if total > 0 else 0.0
                seg_series[(org_id, team_id, channel)].append((day_i, rate, total))

            def median(xs): return statistics.median(xs)
            def mad(xs, med): return statistics.median([abs(x - med) for x in xs])

            day_start = datetime(target_day.year, target_day.month, target_day.day, tzinfo=timezone.utc)
            day_end = day_start + timedelta(days=1)

            for (org_id, team_id, channel), series in seg_series.items():
                series.sort(key=lambda x: x[0])

                baseline = [(d0, r0, n0) for (d0, r0, n0) in series if d0 < target_day and n0 >= min_docs]
                target = [(d0, r0, n0) for (d0, r0, n0) in series if d0 == target_day]
                if not target or len(baseline) < 7:
                    continue

                _x_day, x_rate, x_total = target[0]
                if x_total < min_docs:
                    continue

                baseline_rates = [r0 for (_d0, r0, _n0) in baseline]
                med = float(median(baseline_rates))
                m = float(mad(baseline_rates, med))
                denom = 1.4826 * m if m > 1e-9 else 1e-9
                z = float((x_rate - med) / denom)

                if z < z_threshold or x_rate < med + 0.10:
                    continue

                severity = "high" if z >= z_threshold * 1.5 else "medium"
                msg = f"[{rule.name}] risk spike: negative_rate={x_rate:.2f} vs median={med:.2f} (z={z:.2f})"

                alert = AlertEvent(
                    day=target_day,
                    alert_type="risk_spike",
                    severity=severity,
                    org_id=org_id,
                    team_id=team_id,
                    channel=channel,
                    metric="negative_rate",
                    value=float(x_rate),
                    baseline={
                        "rule_id": str(rule.id),
                        "rule_name": rule.name,
                        "baseline_days": baseline_days,
                        "median": med,
                        "mad": m,
                        "z": z,
                        "min_docs": min_docs,
                    },
                    message=msg,
                )
                db.add(alert)
                db.flush()
                created_alerts += 1

                audit(
                    db,
                    "alert_created",
                    "alert",
                    str(alert.id),
                    {
                        "alert_type": alert.alert_type,
                        "severity": alert.severity,
                        "org_id": org_id,
                        "team_id": team_id,
                        "channel": channel,
                        "metric": alert.metric,
                        "value": alert.value,
                        "baseline": alert.baseline,
                    },
                )

                # ---- Evidence selection: latest inference per document for that segment/day ----
                latest_inf_subq = (
                    db.query(
                        DocumentInference.document_id.label("document_id"),
                        func.max(DocumentInference.created_at).label("max_created_at"),
                    )
                    .group_by(DocumentInference.document_id)
                    .subquery()
                )

                candidates = (
                    db.query(Document, DocumentInference)
                    .join(latest_inf_subq, latest_inf_subq.c.document_id == Document.id)
                    .join(
                        DocumentInference,
                        and_(
                            DocumentInference.document_id == latest_inf_subq.c.document_id,
                            DocumentInference.created_at == latest_inf_subq.c.max_created_at,
                        ),
                    )
                    .filter(Document.org_id == org_id)
                    .filter(Document.team_id == team_id)
                    .filter(Document.channel == channel)
                    .filter(
                        or_(
                            and_(Document.timestamp.is_(None), Document.created_at >= day_start, Document.created_at < day_end),
                            and_(Document.timestamp >= day_start, Document.timestamp < day_end),
                        )
                    )
                    .all()
                )

                scored = []
                for doc, inf in candidates:
                    hits, hl = find_keyword_spans(doc.text_redacted, keywords)
                    contrib = compute_contribution(
                        sentiment=inf.sentiment,
                        emotion_labels=inf.emotion_labels,
                        confidence=inf.calibrated_confidence,
                        keyword_hits=hits,
                        target_sentiment="negative",
                        target_emotions={"sadness", "fear", "fatigue", "anger"},
                    )
                    scored.append((contrib, doc, inf, hits, hl))

                scored.sort(key=lambda x: x[0], reverse=True)
                for contrib, doc, inf, hits, hl in scored[:top_k]:
                    db.add(
                        AlertEvidence(
                            alert_id=alert.id,
                            document_id=doc.id,
                            contribution=float(contrib),
                            emotion_match=(inf.sentiment or None),
                            keyword_hits=hits or None,
                            highlights=hl or None,
                        )
                    )
                    created_evidence += 1

        audit(
            db,
            "rule_engine_run_completed",
            "rule_engine_run",
            run_id,
            {"day": target_day.isoformat(), "alerts": created_alerts, "evidence": created_evidence},
        )
        db.commit()

        return {"ok": True, "day": target_day.isoformat(), "alerts": created_alerts, "evidence": created_evidence}

    finally:
        db.close()