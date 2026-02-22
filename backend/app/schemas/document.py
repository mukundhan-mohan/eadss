from datetime import datetime
from pydantic import BaseModel, Field

class DocumentOut(BaseModel):
    id: str
    external_id: str | None = None
    org_id: str | None = None
    team_id: str | None = None
    source: str | None = None
    channel: str | None = None
    tags: list[str] | None = None
    timestamp: datetime | None = None

    text_redacted: str
    redaction_summary: dict = Field(default_factory=dict)

    created_at: datetime
    updated_at: datetime

class DocumentListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[DocumentOut]


class InferenceOut(BaseModel):
    id: str
    inference_run_id: str
    created_at: datetime

    sentiment: str | None = None
    emotion_labels: list[str] | None = None
    calibrated_confidence: float | None = None

    # optional: keep generic payload if you want it in API
    result: dict | None = None


class DocumentLatestInferenceResponse(BaseModel):
    document_id: str
    latest: InferenceOut | None = None