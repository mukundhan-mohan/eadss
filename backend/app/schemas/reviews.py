from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class InferenceReviewOut(BaseModel):
    id: str
    status: str
    reviewer_name: str | None = None
    feedback: str | None = None
    edited_sentiment: str | None = None
    edited_emotion_labels: list[str] | None = None
    edited_confidence: float | None = None
    reviewed_at: datetime
    created_at: datetime
    updated_at: datetime


class ReviewHistoryEntryOut(BaseModel):
    id: str
    actor: str | None = None
    action: str
    created_at: datetime
    meta: dict = Field(default_factory=dict)


class ReviewQueueInferenceOut(BaseModel):
    id: str
    created_at: datetime
    sentiment: str | None = None
    emotion_labels: list[str] | None = None
    calibrated_confidence: float | None = None
    result: dict | None = None


class ReviewQueueItemOut(BaseModel):
    document_id: str
    external_id: str | None = None
    org_id: str | None = None
    source: str | None = None
    channel: str | None = None
    timestamp: datetime | None = None
    text_redacted: str
    inference: ReviewQueueInferenceOut
    review_status: str
    review: InferenceReviewOut | None = None
    history: list[ReviewHistoryEntryOut] = Field(default_factory=list)


class ReviewQueueResponse(BaseModel):
    items: list[ReviewQueueItemOut]


class SubmitInferenceReviewIn(BaseModel):
    status: str
    reviewer_name: str | None = None
    feedback: str | None = None
    edited_sentiment: str | None = None
    edited_emotion_labels: list[str] | None = None
    edited_confidence: float | None = None

    @model_validator(mode="after")
    def validate_review(self) -> "SubmitInferenceReviewIn":
        status = self.status.strip().lower()
        allowed = {"approved", "edited", "rejected"}
        if status not in allowed:
            raise ValueError(f"status must be one of: {', '.join(sorted(allowed))}")
        self.status = status

        if self.reviewer_name is not None:
            self.reviewer_name = self.reviewer_name.strip() or None
        if self.feedback is not None:
            self.feedback = self.feedback.strip() or None

        if status == "edited":
            has_edit = any(
                value is not None
                for value in (
                    self.edited_sentiment,
                    self.edited_emotion_labels,
                    self.edited_confidence,
                    self.feedback,
                )
            )
            if not has_edit:
                raise ValueError("edited reviews must include corrected values or feedback")

        return self
