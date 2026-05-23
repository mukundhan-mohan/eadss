"""add inference reviews

Revision ID: e7f8a9b0c1d2
Revises: d4e5f6a7b8c9
Create Date: 2026-05-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inference_reviews",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("document_inference_id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("reviewer_name", sa.String(length=255), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("edited_sentiment", sa.String(length=32), nullable=True),
        sa.Column("edited_emotion_labels", sa.JSON(), nullable=True),
        sa.Column("edited_confidence", sa.Float(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_inference_id"], ["document_inference.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_inference_id", name="uq_inference_reviews_document_inference"),
    )
    op.create_index(op.f("ix_inference_reviews_document_id"), "inference_reviews", ["document_id"], unique=False)
    op.create_index(
        op.f("ix_inference_reviews_document_inference_id"),
        "inference_reviews",
        ["document_inference_id"],
        unique=False,
    )
    op.create_index(op.f("ix_inference_reviews_org_id"), "inference_reviews", ["org_id"], unique=False)
    op.create_index(op.f("ix_inference_reviews_status"), "inference_reviews", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_inference_reviews_status"), table_name="inference_reviews")
    op.drop_index(op.f("ix_inference_reviews_org_id"), table_name="inference_reviews")
    op.drop_index(op.f("ix_inference_reviews_document_inference_id"), table_name="inference_reviews")
    op.drop_index(op.f("ix_inference_reviews_document_id"), table_name="inference_reviews")
    op.drop_table("inference_reviews")
