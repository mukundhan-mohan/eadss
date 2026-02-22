import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, JSON, UniqueConstraint, Index, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    is_enabled: Mapped[bool] = mapped_column(nullable=False, default=True)

    # JSON rule definition (simple engine reads this)
    # example: {"type":"risk_spike","metric":"negative_rate","z_threshold":3.5,"baseline_days":30,...}
    definition: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class AlertEvidence(Base):
    __tablename__ = "alert_evidence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # contribution signals
    contribution: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    emotion_match: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    keyword_hits: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # explainability / highlights: list of spans and/or snippets
    # example: [{"start":10,"end":18,"label":"keyword","text":"hopeless"}]
    highlights: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("alert_id", "document_id", name="uq_alert_evidence_alert_document"),
        Index("ix_alert_evidence_alert_contrib", "alert_id", "contribution"),
    )