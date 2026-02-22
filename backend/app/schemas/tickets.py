from pydantic import BaseModel
from datetime import datetime

class TicketDocOut(BaseModel):
    id: str
    external_id: str
    org_id: str
    team_id: str | None = None
    source: str | None = None
    channel: str | None = None
    tags: list[str] | None = None
    timestamp: datetime | None = None
    text_redacted: str
    redaction_summary: dict

class TicketInferenceOut(BaseModel):
    id: str
    inference_run_id: str
    created_at: datetime
    sentiment: str | None = None
    emotion_labels: list[str] | None = None
    calibrated_confidence: float | None = None
    result: dict | None = None

class TicketResponse(BaseModel):
    ticket: TicketDocOut
    latest_inference: TicketInferenceOut | None = None