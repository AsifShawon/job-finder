"""Add raw_text to opportunities

Revision ID: 20260501_0010
Revises: 20260428_0009
Create Date: 2026-05-01
"""

from alembic import op

revision = "20260501_0010"
down_revision = "20260428_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nullable raw_text column to opportunity drafts created by the crawler
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS raw_text TEXT")
    # Backfill from raw_documents when available
    op.execute("""
        UPDATE opportunities o
        SET raw_text = rd.raw_text
        FROM raw_documents rd
        WHERE o.raw_document_id = rd.id AND o.raw_text IS NULL
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS raw_text")
