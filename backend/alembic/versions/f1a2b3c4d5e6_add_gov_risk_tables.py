"""add gov risk tables

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-06-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e7f8a9b0c1d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gov_risk_historical_records",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("sector", sa.String(length=128), nullable=False),
        sa.Column("department", sa.String(length=128), nullable=True),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("event_date", sa.Date(), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gov_risk_historical_records_org_id"), "gov_risk_historical_records", ["org_id"], unique=False)
    op.create_index(op.f("ix_gov_risk_historical_records_sector"), "gov_risk_historical_records", ["sector"], unique=False)
    op.create_index(op.f("ix_gov_risk_historical_records_department"), "gov_risk_historical_records", ["department"], unique=False)
    op.create_index(op.f("ix_gov_risk_historical_records_severity"), "gov_risk_historical_records", ["severity"], unique=False)
    op.create_index(op.f("ix_gov_risk_historical_records_location"), "gov_risk_historical_records", ["location"], unique=False)
    op.create_index(op.f("ix_gov_risk_historical_records_event_date"), "gov_risk_historical_records", ["event_date"], unique=False)

    op.create_table(
        "gov_risk_incidents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("incident_text", sa.Text(), nullable=False),
        sa.Column("sector", sa.String(length=128), nullable=False),
        sa.Column("department", sa.String(length=128), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("incident_date", sa.Date(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gov_risk_incidents_org_id"), "gov_risk_incidents", ["org_id"], unique=False)
    op.create_index(op.f("ix_gov_risk_incidents_sector"), "gov_risk_incidents", ["sector"], unique=False)
    op.create_index(op.f("ix_gov_risk_incidents_department"), "gov_risk_incidents", ["department"], unique=False)
    op.create_index(op.f("ix_gov_risk_incidents_severity"), "gov_risk_incidents", ["severity"], unique=False)
    op.create_index(op.f("ix_gov_risk_incidents_location"), "gov_risk_incidents", ["location"], unique=False)
    op.create_index(op.f("ix_gov_risk_incidents_incident_date"), "gov_risk_incidents", ["incident_date"], unique=False)
    op.create_index(op.f("ix_gov_risk_incidents_status"), "gov_risk_incidents", ["status"], unique=False)

    op.create_table(
        "gov_risk_assessments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("incident_id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("risk_level", sa.String(length=32), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("recommended_action", sa.Text(), nullable=False),
        sa.Column("policy_match", sa.String(length=255), nullable=True),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("matched_record_count", sa.Integer(), nullable=False),
        sa.Column("human_status", sa.String(length=32), nullable=False),
        sa.Column("reviewer_name", sa.String(length=255), nullable=True),
        sa.Column("reviewer_feedback", sa.Text(), nullable=True),
        sa.Column("approved_risk_level", sa.String(length=32), nullable=True),
        sa.Column("approved_risk_score", sa.Float(), nullable=True),
        sa.Column("approved_recommended_action", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["incident_id"], ["gov_risk_incidents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_gov_risk_assessments_incident_id"), "gov_risk_assessments", ["incident_id"], unique=False)
    op.create_index(op.f("ix_gov_risk_assessments_org_id"), "gov_risk_assessments", ["org_id"], unique=False)
    op.create_index(op.f("ix_gov_risk_assessments_status"), "gov_risk_assessments", ["status"], unique=False)
    op.create_index(op.f("ix_gov_risk_assessments_risk_level"), "gov_risk_assessments", ["risk_level"], unique=False)
    op.create_index(op.f("ix_gov_risk_assessments_human_status"), "gov_risk_assessments", ["human_status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_gov_risk_assessments_human_status"), table_name="gov_risk_assessments")
    op.drop_index(op.f("ix_gov_risk_assessments_risk_level"), table_name="gov_risk_assessments")
    op.drop_index(op.f("ix_gov_risk_assessments_status"), table_name="gov_risk_assessments")
    op.drop_index(op.f("ix_gov_risk_assessments_org_id"), table_name="gov_risk_assessments")
    op.drop_index(op.f("ix_gov_risk_assessments_incident_id"), table_name="gov_risk_assessments")
    op.drop_table("gov_risk_assessments")

    op.drop_index(op.f("ix_gov_risk_incidents_status"), table_name="gov_risk_incidents")
    op.drop_index(op.f("ix_gov_risk_incidents_incident_date"), table_name="gov_risk_incidents")
    op.drop_index(op.f("ix_gov_risk_incidents_location"), table_name="gov_risk_incidents")
    op.drop_index(op.f("ix_gov_risk_incidents_severity"), table_name="gov_risk_incidents")
    op.drop_index(op.f("ix_gov_risk_incidents_department"), table_name="gov_risk_incidents")
    op.drop_index(op.f("ix_gov_risk_incidents_sector"), table_name="gov_risk_incidents")
    op.drop_index(op.f("ix_gov_risk_incidents_org_id"), table_name="gov_risk_incidents")
    op.drop_table("gov_risk_incidents")

    op.drop_index(op.f("ix_gov_risk_historical_records_event_date"), table_name="gov_risk_historical_records")
    op.drop_index(op.f("ix_gov_risk_historical_records_location"), table_name="gov_risk_historical_records")
    op.drop_index(op.f("ix_gov_risk_historical_records_severity"), table_name="gov_risk_historical_records")
    op.drop_index(op.f("ix_gov_risk_historical_records_department"), table_name="gov_risk_historical_records")
    op.drop_index(op.f("ix_gov_risk_historical_records_sector"), table_name="gov_risk_historical_records")
    op.drop_index(op.f("ix_gov_risk_historical_records_org_id"), table_name="gov_risk_historical_records")
    op.drop_table("gov_risk_historical_records")
