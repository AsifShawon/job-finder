"""search-driven jobs connector storage changes

Revision ID: 20260502_0013
Revises: 20260501_0012, 20260501_0010
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa

revision = "20260502_0013"
down_revision = ("20260501_0012", "20260501_0010")
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sources", sa.Column("search_results_limit", sa.Integer(), nullable=False, server_default="10"))
    op.add_column("sources", sa.Column("child_page_limit", sa.Integer(), nullable=False, server_default="10"))
    op.add_column("sources", sa.Column("page_ai_limit", sa.Integer(), nullable=False, server_default="25"))
    op.add_column("sources", sa.Column("max_jobs_per_page", sa.Integer(), nullable=False, server_default="10"))

    op.add_column("raw_documents", sa.Column("crawl_run_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_raw_documents_crawl_run_id",
        "raw_documents",
        "crawl_runs",
        ["crawl_run_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute("ALTER TABLE raw_documents DROP CONSTRAINT IF EXISTS uq_raw_doc_source_url")
    op.create_index(
        "ix_raw_documents_source_canonical",
        "raw_documents",
        ["source_id", "canonical_url", "fetched_at"],
        unique=False,
    )

    op.add_column("opportunities", sa.Column("source_item_key", sa.String(length=128), nullable=True))
    op.create_index("ix_opportunities_source_item_key", "opportunities", ["source_item_key"], unique=False)
    op.execute("ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS uq_opportunity_source_url")
    op.create_unique_constraint(
        "uq_opportunity_source_item_key",
        "opportunities",
        ["source_id", "source_item_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_opportunity_source_item_key", "opportunities", type_="unique")
    op.drop_index("ix_opportunities_source_item_key", table_name="opportunities")
    op.drop_column("opportunities", "source_item_key")

    op.drop_index("ix_raw_documents_source_canonical", table_name="raw_documents")
    op.drop_constraint("fk_raw_documents_crawl_run_id", "raw_documents", type_="foreignkey")
    op.drop_column("raw_documents", "crawl_run_id")
    op.create_unique_constraint("uq_raw_doc_source_url", "raw_documents", ["source_id", "source_url"])

    op.drop_column("sources", "max_jobs_per_page")
    op.drop_column("sources", "page_ai_limit")
    op.drop_column("sources", "child_page_limit")
    op.drop_column("sources", "search_results_limit")
    op.create_unique_constraint("uq_opportunity_source_url", "opportunities", ["source_id", "source_url"])
