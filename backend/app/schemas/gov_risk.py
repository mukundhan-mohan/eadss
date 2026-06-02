from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator


ALLOWED_REVIEW_STATUSES = {"approved", "edited", "rejected"}


class GovRiskEvidenceOut(BaseModel):
    document_id: str
    document_title: str | None = None
    page_number: int
    chunk_index: int
    score: float
    excerpt: str


class GovRiskHistoricalRecordOut(BaseModel):
    id: str
    title: str
    summary: str
    sector: str
    department: str | None = None
    severity: str
    location: str | None = None
    event_date: date | None = None
    outcome: str | None = None
    created_at: datetime
    updated_at: datetime


class GovRiskAssessmentOut(BaseModel):
    id: str
    incident_id: str
    status: str
    risk_level: str
    risk_score: float
    reason: str
    recommended_action: str
    policy_match: str | None = None
    evidence: list[GovRiskEvidenceOut] = Field(default_factory=list)
    matched_record_count: int = 0
    human_status: str
    reviewer_name: str | None = None
    reviewer_feedback: str | None = None
    approved_risk_level: str | None = None
    approved_risk_score: float | None = None
    approved_recommended_action: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class GovRiskAuditEntryOut(BaseModel):
    id: str
    actor: str | None = None
    action: str
    created_at: datetime
    meta: dict = Field(default_factory=dict)


class GovRiskIncidentOut(BaseModel):
    id: str
    org_id: str
    title: str
    incident_text: str
    sector: str
    department: str
    severity: str
    incident_date: date | None = None
    location: str | None = None
    status: str
    latest_assessment: GovRiskAssessmentOut | None = None
    history: list[GovRiskAuditEntryOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class GovRiskIncidentListResponse(BaseModel):
    items: list[GovRiskIncidentOut]


class GovRiskHistoricalRecordListResponse(BaseModel):
    items: list[GovRiskHistoricalRecordOut]


class CreateGovRiskIncidentIn(BaseModel):
    title: str
    incident_text: str
    sector: str
    department: str
    severity: str
    incident_date: date | None = None
    location: str | None = None

    @model_validator(mode="after")
    def normalize(self) -> "CreateGovRiskIncidentIn":
        self.title = self.title.strip()
        self.incident_text = self.incident_text.strip()
        self.sector = self.sector.strip()
        self.department = self.department.strip()
        self.severity = self.severity.strip().lower()
        if self.location is not None:
            self.location = self.location.strip() or None
        if not self.title:
            raise ValueError("title is required")
        if not self.incident_text:
            raise ValueError("incident_text is required")
        if self.severity not in {"low", "medium", "high", "critical"}:
            raise ValueError("severity must be low, medium, high, or critical")
        return self


class CreateGovRiskHistoricalRecordIn(BaseModel):
    title: str
    summary: str
    sector: str
    department: str | None = None
    severity: str
    location: str | None = None
    event_date: date | None = None
    outcome: str | None = None

    @model_validator(mode="after")
    def normalize(self) -> "CreateGovRiskHistoricalRecordIn":
        self.title = self.title.strip()
        self.summary = self.summary.strip()
        self.sector = self.sector.strip()
        self.severity = self.severity.strip().lower()
        if self.department is not None:
            self.department = self.department.strip() or None
        if self.location is not None:
            self.location = self.location.strip() or None
        if self.outcome is not None:
            self.outcome = self.outcome.strip() or None
        if not self.title:
            raise ValueError("title is required")
        if not self.summary:
            raise ValueError("summary is required")
        if self.severity not in {"low", "medium", "high", "critical"}:
            raise ValueError("severity must be low, medium, high, or critical")
        return self


class SubmitGovRiskReviewIn(BaseModel):
    status: str
    reviewer_name: str | None = None
    feedback: str | None = None
    approved_risk_level: str | None = None
    approved_risk_score: float | None = None
    approved_recommended_action: str | None = None

    @model_validator(mode="after")
    def normalize(self) -> "SubmitGovRiskReviewIn":
        self.status = self.status.strip().lower()
        if self.status not in ALLOWED_REVIEW_STATUSES:
            raise ValueError("status must be approved, edited, or rejected")
        if self.reviewer_name is not None:
            self.reviewer_name = self.reviewer_name.strip() or None
        if self.feedback is not None:
            self.feedback = self.feedback.strip() or None
        if self.approved_risk_level is not None:
            self.approved_risk_level = self.approved_risk_level.strip().lower() or None
        if self.approved_recommended_action is not None:
            self.approved_recommended_action = self.approved_recommended_action.strip() or None
        if self.approved_risk_score is not None:
            self.approved_risk_score = max(0.0, min(1.0, self.approved_risk_score))

        if self.status == "edited" and not any(
            value is not None
            for value in (self.feedback, self.approved_risk_level, self.approved_risk_score, self.approved_recommended_action)
        ):
            raise ValueError("edited reviews must include feedback or an approved override")
        return self
