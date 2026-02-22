import uuid
from datetime import datetime, date

from sqlalchemy import String, DateTime, Integer, Float, Date, JSON, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EmotionDaily(Base):
    __tablename__ = "emotion_daily"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # segment dimensions (keep it simple; expand as needed)
    org_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    channel: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    sentiment: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    emotion: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    doc_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "day", "org_id", "team_id", "channel", "source", "sentiment", "emotion",
            name="uq_emotion_daily_segment"
        ),
        Index("ix_emotion_daily_day_org_team", "day", "org_id", "team_id"),
    )


class EmotionRolling(Base):
    __tablename__ = "emotion_rolling"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    as_of_day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    window_days: Mapped[int] = mapped_column(Integer, nullable=False, index=True)  # 7/30/90

    org_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    channel: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    sentiment: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    emotion: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    doc_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "as_of_day", "window_days", "org_id", "team_id", "channel", "source", "sentiment", "emotion",
            name="uq_emotion_rolling_segment"
        ),
        Index("ix_emotion_rolling_asof_org_team", "as_of_day", "org_id", "team_id"),
    )


class AlertEvent(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    alert_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # e.g. "risk_spike"
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium", index=True)

    org_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    channel: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # payload for dashboards / debugging
    metric: Mapped[str] = mapped_column(String(64), nullable=False)  # e.g. "negative_rate"
    value: Mapped[float] = mapped_column(Float, nullable=False)
    baseline: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)  # median/mad/z, window, etc.

    message: Mapped[str | None] = mapped_column(String(512), nullable=True)

    __table_args__ = (
        Index("ix_alerts_day_org_team_type", "day", "org_id", "team_id", "alert_type"),
    )