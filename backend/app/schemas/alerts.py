from datetime import datetime, date
from pydantic import BaseModel

class AlertOut(BaseModel):
    id: str
    created_at: datetime
    day: date
    alert_type: str
    severity: str
    org_id: str | None = None
    team_id: str | None = None
    channel: str | None = None
    metric: str
    value: float
    baseline: dict
    message: str | None = None

class EvidenceOut(BaseModel):
    document_id: str
    contribution: float
    keyword_hits: list[str] | None = None
    highlights: list[dict] | None = None

    # optional document preview
    external_id: str | None = None
    text_redacted: str | None = None
    sentiment: str | None = None
    emotion_labels: list[str] | None = None
    calibrated_confidence: float | None = None

class AlertDetail(BaseModel):
    alert: AlertOut
    evidence: list[EvidenceOut]