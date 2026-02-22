import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Integer, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # A "topic run" groups one clustering execution (e.g. per org/team/time window)
    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    org_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)

    # BERTopic topic id (e.g. 0..N, -1 for outliers)
    topic_key: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    top_words: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    doc_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    documents = relationship("DocumentTopic", back_populates="topic", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("run_id", "topic_key", name="uq_topics_run_topic_key"),
    )