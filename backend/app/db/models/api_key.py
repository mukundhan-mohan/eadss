import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # store only a hash (never store plaintext keys)
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)

    org_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # optional: ["read:documents","read:tickets","write:ingest","read:alerts"]
    scopes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_api_keys_org_active", "org_id", "is_active"),
    )