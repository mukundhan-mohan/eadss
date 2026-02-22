from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.security import require_api_key, ClientContext
from app.db.session import get_db
from app.db.models.usage import UsageEvent

router = APIRouter(prefix="/usage")

@router.get("")
def get_usage(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    client: ClientContext = Depends(require_api_key),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            func.date_trunc("day", UsageEvent.created_at).label("day"),
            func.count().label("requests"),
            func.avg(UsageEvent.latency_ms).label("avg_latency_ms"),
        )
        .filter(UsageEvent.org_id == client.org_id, UsageEvent.created_at >= since)
        .group_by("day")
        .order_by("day")
        .all()
    )

    top = (
        db.query(UsageEvent.path, func.count().label("requests"))
        .filter(UsageEvent.org_id == client.org_id, UsageEvent.created_at >= since)
        .group_by(UsageEvent.path)
        .order_by(func.count().desc())
        .limit(10)
        .all()
    )

    return {
        "org_id": client.org_id,
        "days": days,
        "by_day": [
            {
                "day": r.day.date().isoformat(),
                "requests": int(r.requests),
                "avg_latency_ms": float(r.avg_latency_ms or 0),
            }
            for r in rows
        ],
        "top_paths": [{"path": p, "requests": int(c)} for (p, c) in top],
    }