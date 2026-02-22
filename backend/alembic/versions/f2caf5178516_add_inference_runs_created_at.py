"""add inference_runs created_at

Revision ID: f2caf5178516
Revises: 2b2a39af36dc
Create Date: 2026-02-22 00:35:31.784339

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2caf5178516'
down_revision: Union[str, Sequence[str], None] = '2b2a39af36dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add as nullable first
    op.add_column(
        "inference_runs",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 2) Backfill existing rows
    op.execute("UPDATE inference_runs SET created_at = COALESCE(started_at, NOW()) WHERE created_at IS NULL")

    # 3) Make NOT NULL
    op.alter_column("inference_runs", "created_at", nullable=False)

    # 4) Index (safe even if run after)
    op.create_index(
        "ix_inference_runs_created_at",
        "inference_runs",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_inference_runs_created_at", table_name="inference_runs")
    op.drop_column("inference_runs", "created_at")