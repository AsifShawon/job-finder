"""add search_queries to sources and resize embeddings to 384 dims

Revision ID: 20260426_0004
Revises: 20260426_0003
Create Date: 2026-04-26
"""

from alembic import op

revision = "20260426_0004"
down_revision = "20260426_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Per-source admin-configurable crawl keywords
    op.execute("ALTER TABLE sources ADD COLUMN search_queries JSONB NOT NULL DEFAULT '[]'")

    # Clear stale hash-based embeddings and resize to 384 dims for fastembed multilingual-e5-small
    op.execute("TRUNCATE TABLE opportunity_embeddings")
    op.execute("DROP INDEX IF EXISTS ix_opportunity_embedding_vector")
    op.execute("ALTER TABLE opportunity_embeddings DROP COLUMN embedding")
    op.execute("ALTER TABLE opportunity_embeddings ADD COLUMN embedding vector(384)")
    op.execute("ALTER TABLE opportunity_embeddings ALTER COLUMN embedding SET NOT NULL")
    op.execute(
        "CREATE INDEX ix_opportunity_embedding_vector "
        "ON opportunity_embeddings USING hnsw (embedding vector_cosine_ops) "
        "WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE sources DROP COLUMN search_queries")
    op.execute("TRUNCATE TABLE opportunity_embeddings")
    op.execute("DROP INDEX IF EXISTS ix_opportunity_embedding_vector")
    op.execute("ALTER TABLE opportunity_embeddings DROP COLUMN embedding")
    op.execute("ALTER TABLE opportunity_embeddings ADD COLUMN embedding vector(1024)")
    op.execute("ALTER TABLE opportunity_embeddings ALTER COLUMN embedding SET NOT NULL")
    op.execute(
        "CREATE INDEX ix_opportunity_embedding_vector "
        "ON opportunity_embeddings USING hnsw (embedding vector_cosine_ops)"
    )
