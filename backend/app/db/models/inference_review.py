import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InferenceReview(Base):
    __tablename__ = "inference_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_inference_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_inference.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    org_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    reviewer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    edited_sentiment: Mapped[str | None] = mapped_column(String(32), nullable=True)
    edited_emotion_labels: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    edited_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    document = relationship("Document")
    document_inference = relationship("DocumentInference", back_populates="review")

    __table_args__ = (
        UniqueConstraint("document_inference_id", name="uq_inference_reviews_document_inference"),
    )
