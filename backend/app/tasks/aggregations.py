from __future__ import annotations

from datetime import datetime, timezone, timedelta, date

from sqlalchemy import text

from app.core.celery_app import celery_app
from app.db.session import SessionLocal
import statistics


def _day_utc(d: date) -> str:
    return d.isoformat()

def _median(xs: list[float]) -> float:
    return statistics.median(xs)

def _mad(xs: list[float], med: float) -> float:
    return statistics.median([abs(x - med) for x in xs])


@celery_app.task(name="aggregations.compute_emotion_daily")
def compute_emotion_daily(day: str | None = None) -> dict:
    """
    Computes daily aggregates for a given UTC day (YYYY-MM-DD).
    If day is None, computes yesterday.
    """
    db = SessionLocal()
    try:
        if day is None:
            day_date = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        else:
            day_date = date.fromisoformat(day)

        day_start = datetime(day_date.year, day_date.month, day_date.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        # Delete existing aggregates for idempotency
        db.execute(
            text("DELETE FROM emotion_daily WHERE day = :day"),
            {"day": day_date},
        )

        # We flatten emotion_labels (JSON array) to one row per emotion label.
        # If emotion_labels is NULL, we still store a row with emotion=NULL (optional).
        #
        # Note: Documents use timestamp when present, else created_at.
        sql = text("""
            WITH base AS (
              SELECT
                DATE_TRUNC('day', COALESCE(d.timestamp, d.created_at))::date AS day,
                d.org_id, d.team_id, d.channel, d.source,
                di.sentiment,
                di.emotion_labels,
                di.calibrated_confidence
              FROM document_inference di
              JOIN documents d ON d.id = di.document_id
              WHERE COALESCE(d.timestamp, d.created_at) >= :start
                AND COALESCE(d.timestamp, d.created_at) <  :end
            ),
            exploded AS (
              SELECT
                day, org_id, team_id, channel, source,
                sentiment,
                jsonb_array_elements_text(COALESCE(emotion_labels::jsonb, '["__none__"]'::jsonb)) AS emotion,
                calibrated_confidence
              FROM base
            )
            INSERT INTO emotion_daily (
              id, day, org_id, team_id, channel, source, sentiment, emotion, doc_count, avg_confidence, created_at
            )
            SELECT
              gen_random_uuid(),
              day, org_id, team_id, channel, source,
              sentiment,
              NULLIF(emotion, '__none__') AS emotion,
              COUNT(*)::int AS doc_count,
              AVG(calibrated_confidence)::float AS avg_confidence,
              NOW()
            FROM exploded
            GROUP BY day, org_id, team_id, channel, source, sentiment, NULLIF(emotion, '__none__')
        """)

        # gen_random_uuid() needs pgcrypto; if not installed, we’ll replace with uuid in Python.
        # Most Postgres images don’t enable pgcrypto by default.
        # Safer approach: enable pgcrypto once or switch to UUID from Python.
        #
        # We'll use a safer method: insert without id and let Python generate is not possible with pure SQL.
        # Instead, ensure pgcrypto exists:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))

        db.execute(sql, {"start": day_start, "end": day_end})
        db.commit()

        # Count inserted rows
        res = db.execute(text("SELECT COUNT(*) FROM emotion_daily WHERE day=:day"), {"day": day_date}).scalar()
        return {"ok": True, "day": _day_utc(day_date), "rows": int(res or 0)}

    finally:
        db.close()

@celery_app.task(name="aggregations.compute_emotion_rolling")
def compute_emotion_rolling(as_of_day: str | None = None, windows: list[int] | None = None) -> dict:
    """
    Computes rolling windows (7/30/90) ending at as_of_day (inclusive).
    If as_of_day is None, uses yesterday.
    """
    db = SessionLocal()
    try:
        if as_of_day is None:
            as_of = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        else:
            as_of = date.fromisoformat(as_of_day)

        windows = windows or [7, 30, 90]

        db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto;"))

        for w in windows:
            start_day = as_of - timedelta(days=w - 1)

            # idempotency
            db.execute(
                text("DELETE FROM emotion_rolling WHERE as_of_day=:d AND window_days=:w"),
                {"d": as_of, "w": w},
            )

            sql = text("""
                INSERT INTO emotion_rolling (
                  id, as_of_day, window_days,
                  org_id, team_id, channel, source, sentiment, emotion,
                  doc_count, avg_confidence, created_at
                )
                SELECT
                  gen_random_uuid(),
                  :as_of::date AS as_of_day,
                  :w::int AS window_days,
                  org_id, team_id, channel, source, sentiment, emotion,
                  SUM(doc_count)::int AS doc_count,
                  CASE WHEN SUM(doc_count) > 0
                    THEN SUM(doc_count * COALESCE(avg_confidence, 0)) / SUM(doc_count)
                    ELSE NULL
                  END::float AS avg_confidence,
                  NOW()
                FROM emotion_daily
                WHERE day >= :start::date AND day <= :as_of::date
                GROUP BY org_id, team_id, channel, source, sentiment, emotion
            """)
            db.execute(sql, {"as_of": as_of, "start": start_day, "w": w})

        db.commit()
        return {"ok": True, "as_of_day": as_of.isoformat(), "windows": windows}

    finally:
        db.close()

@celery_app.task(name="aggregations.detect_risk_spikes")
def detect_risk_spikes(
    day: str | None = None,
    baseline_days: int = 30,
    z_threshold: float = 3.5,
    min_docs: int = 10,
) -> dict:
    """
    Detect spikes in negative_rate per (org_id, team_id, channel).
    Uses robust z-score against the previous baseline_days (excluding target day).
    """
    db = SessionLocal()
    try:
        if day is None:
            target_day = (datetime.now(timezone.utc) - timedelta(days=1)).date()
        else:
            target_day = date.fromisoformat(day)

        start_baseline = target_day - timedelta(days=baseline_days)

        # Fetch daily totals by segment for baseline + target
        rows = db.execute(text("""
            SELECT day, org_id, team_id, channel,
                   SUM(CASE WHEN sentiment='negative' THEN doc_count ELSE 0 END)::int AS neg,
                   SUM(doc_count)::int AS total
            FROM emotion_daily
            WHERE day >= :start AND day <= :target
            GROUP BY day, org_id, team_id, channel
        """), {"start": start_baseline, "target": target_day}).fetchall()

        # Organize by segment
        from collections import defaultdict
        seg_to_series: dict[tuple, list[tuple[date, float, int]]] = defaultdict(list)

        for r in rows:
            d = r[0]
            org_id, team_id, channel = r[1], r[2], r[3]
            neg, total = int(r[4] or 0), int(r[5] or 0)
            rate = (neg / total) if total > 0 else 0.0
            seg_to_series[(org_id, team_id, channel)].append((d, rate, total))

        # Clear existing alerts for idempotency (same day/type)
        db.execute(
            text("DELETE FROM alerts WHERE day=:day AND alert_type='risk_spike'"),
            {"day": target_day},
        )

        inserted = 0
        for (org_id, team_id, channel), series in seg_to_series.items():
            series.sort(key=lambda x: x[0])

            # separate baseline and target
            baseline = [(d, rate, total) for (d, rate, total) in series if d < target_day]
            target = [(d, rate, total) for (d, rate, total) in series if d == target_day]
            if not target:
                continue

            x_day, x_rate, x_total = target[0]
            if x_total < min_docs:
                continue

            baseline_rates = [rate for (_d, rate, total) in baseline if total >= min_docs]
            if len(baseline_rates) < 7:
                continue  # not enough history

            med = _median(baseline_rates)
            mad = _mad(baseline_rates, med)
            denom = 1.4826 * mad if mad > 1e-9 else 1e-9
            z = (x_rate - med) / denom

            # Only alert on upward spikes that pass threshold and are meaningfully higher
            if z >= z_threshold and x_rate >= med + 0.10:
                severity = "high" if z >= z_threshold * 1.5 else "medium"
                msg = f"Risk spike: negative_rate={x_rate:.2f} vs median={med:.2f} (z={z:.2f})"

                db.execute(text("""
                    INSERT INTO alerts (
                      id, created_at, day, alert_type, severity,
                      org_id, team_id, channel,
                      metric, value, baseline, message
                    )
                    VALUES (
                      gen_random_uuid(), NOW(), :day, 'risk_spike', :sev,
                      :org, :team, :chan,
                      'negative_rate', :val,
                      :baseline::jsonb, :msg
                    )
                """), {
                    "day": target_day,
                    "sev": severity,
                    "org": org_id,
                    "team": team_id,
                    "chan": channel,
                    "val": float(x_rate),
                    "baseline": {
                        "median": float(med),
                        "mad": float(mad),
                        "z": float(z),
                        "baseline_days": int(baseline_days),
                        "min_docs": int(min_docs),
                    },
                    "msg": msg,
                })
                inserted += 1

        db.commit()
        return {"ok": True, "day": target_day.isoformat(), "alerts_inserted": inserted}

    finally:
        db.close()