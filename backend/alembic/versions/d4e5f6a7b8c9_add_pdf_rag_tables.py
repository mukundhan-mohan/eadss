"""add pdf rag tables

Revision ID: d4e5f6a7b8c9
Revises: a1c4d2e9b6f1
Create Date: 2026-05-21 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.pgvector import PGVector


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "a1c4d2e9b6f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "pdf_documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("storage_path", sa.String(length=1024), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("embedding_model", sa.String(length=255), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("chunk_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_pdf_documents_org_id"), "pdf_documents", ["org_id"], unique=False)
    op.create_index(op.f("ix_pdf_documents_status"), "pdf_documents", ["status"], unique=False)

    op.create_table(
        "pdf_chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.String(length=128), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", PGVector(384), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["pdf_documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_pdf_chunks_document_chunk_index"),
    )
    op.create_index(op.f("ix_pdf_chunks_document_id"), "pdf_chunks", ["document_id"], unique=False)
    op.create_index(op.f("ix_pdf_chunks_org_id"), "pdf_chunks", ["org_id"], unique=False)
    op.create_index(op.f("ix_pdf_chunks_page_number"), "pdf_chunks", ["page_number"], unique=False)
    op.create_index("ix_pdf_chunks_document_page", "pdf_chunks", ["document_id", "page_number"], unique=False)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pdf_chunks_embedding_cosine "
        "ON pdf_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_pdf_chunks_embedding_cosine")
    op.drop_index("ix_pdf_chunks_document_page", table_name="pdf_chunks")
    op.drop_index(op.f("ix_pdf_chunks_page_number"), table_name="pdf_chunks")
    op.drop_index(op.f("ix_pdf_chunks_org_id"), table_name="pdf_chunks")
    op.drop_index(op.f("ix_pdf_chunks_document_id"), table_name="pdf_chunks")
    op.drop_table("pdf_chunks")

    op.drop_index(op.f("ix_pdf_documents_status"), table_name="pdf_documents")
    op.drop_index(op.f("ix_pdf_documents_org_id"), table_name="pdf_documents")
    op.drop_table("pdf_documents")
