from datetime import datetime
from pydantic import BaseModel, Field

class IngestItem(BaseModel):
    text: str
    timestamp: datetime | None = None
    source: str | None = None
    channel: str | None = None
    tags: list[str] | None = None
    org_id: str | None = None
    team_id: str | None = None
    external_id: str | None = None

class IngestRequest(BaseModel):
    items: list[IngestItem] = Field(min_length=1)
    enqueue_inference: bool = False

class IngestResponseItem(BaseModel):
    document_id: str
    external_id: str | None = None
    redaction_summary: dict

class IngestResponse(BaseModel):
    inserted: int
    items: list[IngestResponseItem]