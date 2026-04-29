"""Single opportunity table — merge published_opportunities into opportunities with status field.

Adds status/slug to opportunities, feed_type/auto_publish to sources,
remaps FKs from published_opportunities → opportunities, drops old tables.

Revision ID: 20260428_0011
Revises: 20260501_0010
Create Date: 2026-04-28
"""

from alembic import op

revision = "20260428_0011"
down_revision = "20260501_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add status and slug to opportunities
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS slug VARCHAR(600)")

    # 2. Backfill: rows that were approved get status='published'
    op.execute("""
        UPDATE opportunities o
        SET status = 'published',
            slug = po.slug,
            published_at = COALESCE(o.published_at, po.published_at),
            title_bn = COALESCE(o.title_bn, po.title_bn),
            summary_bn = COALESCE(o.summary_bn, po.summary_bn)
        FROM published_opportunities po
        WHERE po.draft_id = o.id
          AND po.is_active = TRUE
    """)

    # 3. Remap saved_opportunities FK: published_opportunities.id → opportunities.id
    # Support both historical schemas:
    # - saved_opportunities.opportunity_id -> published_opportunities.id
    # - saved_opportunities.published_opportunity_id -> published_opportunities.id
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'saved_opportunities'
                  AND column_name = 'published_opportunity_id'
            ) THEN
                UPDATE saved_opportunities s
                SET opportunity_id = po.draft_id
                FROM published_opportunities po
                WHERE s.published_opportunity_id = po.id;
            END IF;
        END $$;
    """)
    op.execute("""
        UPDATE saved_opportunities s
        SET opportunity_id = po.draft_id
        FROM published_opportunities po
        WHERE s.opportunity_id = po.id
    """)
    op.execute("ALTER TABLE saved_opportunities DROP CONSTRAINT IF EXISTS saved_opportunities_opportunity_id_fkey")
    op.execute("ALTER TABLE saved_opportunities DROP CONSTRAINT IF EXISTS saved_opportunities_published_opportunity_id_fkey")
    op.execute("""
        ALTER TABLE saved_opportunities
          ADD CONSTRAINT saved_opportunities_opportunity_id_fkey
          FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    """)
    op.execute("ALTER TABLE saved_opportunities DROP COLUMN IF EXISTS published_opportunity_id")

    # 4. Remap alert_events FK
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'alert_events'
                  AND column_name = 'published_opportunity_id'
            ) THEN
                UPDATE alert_events ae
                SET opportunity_id = po.draft_id
                FROM published_opportunities po
                WHERE ae.published_opportunity_id = po.id;
            END IF;
        END $$;
    """)
    op.execute("""
        UPDATE alert_events ae
        SET opportunity_id = po.draft_id
        FROM published_opportunities po
        WHERE ae.opportunity_id = po.id
    """)
    op.execute("ALTER TABLE alert_events DROP CONSTRAINT IF EXISTS alert_events_opportunity_id_fkey")
    op.execute("ALTER TABLE alert_events DROP CONSTRAINT IF EXISTS alert_events_published_opportunity_id_fkey")
    op.execute("""
        ALTER TABLE alert_events
          ADD CONSTRAINT alert_events_opportunity_id_fkey
          FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    """)
    op.execute("ALTER TABLE alert_events DROP COLUMN IF EXISTS published_opportunity_id")

    # 5. Remap feedback FK
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'feedback'
                  AND column_name = 'published_opportunity_id'
            ) THEN
                UPDATE feedback f
                SET opportunity_id = po.draft_id
                FROM published_opportunities po
                WHERE f.published_opportunity_id = po.id;
            END IF;
        END $$;
    """)
    op.execute("""
        UPDATE feedback f
        SET opportunity_id = po.draft_id
        FROM published_opportunities po
        WHERE f.opportunity_id = po.id
    """)
    op.execute("ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_opportunity_id_fkey")
    op.execute("ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_published_opportunity_id_fkey")
    op.execute("""
        ALTER TABLE feedback
          ADD CONSTRAINT feedback_opportunity_id_fkey
          FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    """)
    op.execute("ALTER TABLE feedback DROP COLUMN IF EXISTS published_opportunity_id")

    # 6. Migrate published embeddings → opportunity_embeddings
    op.execute("""
        INSERT INTO opportunity_embeddings (opportunity_id, embedding, embedding_model, embedded_at)
        SELECT po.draft_id, poe.embedding, poe.embedding_model, poe.embedded_at
        FROM published_opportunity_embeddings poe
        JOIN published_opportunities po ON po.id = poe.published_opportunity_id
        ON CONFLICT (opportunity_id) DO NOTHING
    """)

    # 7. Drop old tables (order matters: embeddings first, then opportunities)
    op.execute("DROP TABLE IF EXISTS published_opportunity_embeddings")
    op.execute("DROP TABLE IF EXISTS published_opportunities")

    # 8. Indexes on new status column
    op.execute("CREATE INDEX IF NOT EXISTS ix_opportunities_status ON opportunities(status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_opp_status_type ON opportunities(status, opportunity_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_opp_status_country ON opportunities(status, country)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_opp_status_deadline ON opportunities(status, deadline)")

    # 9. Add feed_type + auto_publish to sources
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS feed_type VARCHAR(20)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN NOT NULL DEFAULT FALSE")

    # 10. Backfill feed_type from ingestion_mode
    op.execute("""
        UPDATE sources SET feed_type = CASE
            WHEN ingestion_mode IN ('rss') THEN 'rss'
            WHEN ingestion_mode IN ('api', 'open_data') THEN 'api'
            WHEN ingestion_mode IN ('pdf', 'html_with_pdf') THEN 'pdf'
            ELSE 'html'
        END
        WHERE feed_type IS NULL
    """)

    # 11. Auto-publish official government sources
    op.execute("""
        UPDATE sources SET auto_publish = TRUE
        WHERE trust_level = 'government_official'
           OR connector_key IN ('boesl_brms', 'boesl_reports_pdf', 'bmet_connector', 'oep_connector')
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_opportunities_status")
    op.execute("DROP INDEX IF EXISTS ix_opp_status_type")
    op.execute("DROP INDEX IF EXISTS ix_opp_status_country")
    op.execute("DROP INDEX IF EXISTS ix_opp_status_deadline")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS status")
    op.execute("ALTER TABLE opportunities DROP COLUMN IF EXISTS slug")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS feed_type")
    op.execute("ALTER TABLE sources DROP COLUMN IF EXISTS auto_publish")
