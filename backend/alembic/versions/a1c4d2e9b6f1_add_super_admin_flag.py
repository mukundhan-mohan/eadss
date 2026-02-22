"""add super admin flag

Revision ID: a1c4d2e9b6f1
Revises: 94e08d346919
Create Date: 2026-02-22 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1c4d2e9b6f1"
down_revision: Union[str, Sequence[str], None] = "94e08d346919"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "admin_users",
        sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE admin_users SET is_super_admin = false WHERE is_super_admin IS NULL")
    op.alter_column("admin_users", "is_super_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("admin_users", "is_super_admin")
