"""Add PublishedOpportunity table, CrawlRun table, and clean up Source/Opportunity fields

Revision ID: 20260428_0008
Revises: 20260427_0007
Create Date: 2026-04-28
"""

from alembic import op

revision = "20260428_0008"
down_revision = "20260427_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Source: add new fields ─────────────────────────────────────────────────
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS root_url VARCHAR(1024)")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS first_crawl_mode VARCHAR(30) DEFAULT 'active_only'")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS search_keywords JSONB NOT NULL DEFAULT '[]'")
    op.execute("ALTER TABLE sources ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE")
    # Backfill root_url from base_url
    op.execute("UPDATE sources SET root_url = base_url WHERE root_url IS NULL")
    # Backfill enabled from is_active
    op.execute("UPDATE sources SET enabled = is_active")

    # ── Opportunity: add new fields ────────────────────────────────────────────
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_name VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_page_url VARCHAR(2048)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS employer_or_organization VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS job_title VARCHAR(255)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS required_documents TEXT")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS eligibility_status VARCHAR(30)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS risk_flags JSONB NOT NULL DEFAULT '[]'")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS source_trust_badge VARCHAR(120)")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ")
    op.execute("ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS raw_html TEXT")
    # Backfill source_page_url from source_url
    op.execute("UPDATE opportunities SET source_page_url = source_url WHERE source_page_url IS NULL")
    # Ensure all existing items have review_status=pending if not set
    op.execute("UPDATE opportunities SET review_status = 'pending' WHERE review_status IS NULL")
    op.execute("UPDATE opportunities SET needs_admin_review = TRUE WHERE needs_admin_review IS FALSE AND review_status = 'pending'")
    # Backfill source_name
    op.execute("""
        UPDATE opportunities o
        SET source_name = s.name
        FROM sources s
        WHERE o.source_id = s.id AND o.source_name IS NULL
    """)
    # Backfill employer_or_organization
    op.execute("""
        UPDATE opportunities
        SET employer_or_organization = COALESCE(employer, organization)
        WHERE employer_or_organization IS NULL
    """)

    # ── Opportunity: fix is_active — should be FALSE unless explicitly approved ─
    # Items that were published directly (bypassing review) are demoted back to pending
    op.execute("""
        UPDATE opportunities
        SET is_active = FALSE, review_status = 'pending', needs_admin_review = TRUE
        WHERE review_status IS NULL OR review_status = 'pending'
    """)

    # ── CrawlRun table ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS crawl_runs (
            id SERIAL PRIMARY KEY,
            source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            connector_key VARCHAR(60),
            source_type VARCHAR(40),
            ingestion_mode VARCHAR(40),
            crawl_mode VARCHAR(30),
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            discovered_count INTEGER NOT NULL DEFAULT 0,
            parsed_count INTEGER NOT NULL DEFAULT 0,
            duplicate_count INTEGER NOT NULL DEFAULT 0,
            draft_created_count INTEGER NOT NULL DEFAULT 0,
            draft_updated_count INTEGER NOT NULL DEFAULT 0,
            failed_count INTEGER NOT NULL DEFAULT 0,
            manual_review_count INTEGER NOT NULL DEFAULT 0,
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ,
            error_message TEXT,
            logs JSONB
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_crawl_runs_source_id ON crawl_runs(source_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_crawl_runs_status ON crawl_runs(status)")

    # ── PublishedOpportunity table ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS published_opportunities (
            id SERIAL PRIMARY KEY,
            draft_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
            source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
            source_name VARCHAR(255),
            source_page_url VARCHAR(2048) NOT NULL,
            document_url VARCHAR(2048),
            original_apply_url VARCHAR(2048),
            content_type VARCHAR(20),
            opportunity_type VARCHAR(40),
            title VARCHAR(500) NOT NULL,
            title_bn VARCHAR(500),
            summary_bn TEXT,
            summary_en TEXT,
            country VARCHAR(120),
            destination_country VARCHAR(120),
            employer_or_organization VARCHAR(255),
            job_title VARCHAR(255),
            sector VARCHAR(120),
            skill_level VARCHAR(120),
            salary_min NUMERIC(12,2),
            salary_max NUMERIC(12,2),
            salary_currency VARCHAR(10),
            salary_text VARCHAR(255),
            location_text VARCHAR(255),
            deadline DATE,
            posted_date DATE,
            eligibility_text TEXT,
            required_documents TEXT,
            application_process TEXT,
            education_requirement TEXT,
            experience_requirement TEXT,
            language_requirement VARCHAR(255),
            age_requirement VARCHAR(120),
            gender_requirement VARCHAR(120),
            visa_or_work_permit_info TEXT,
            lmia_status VARCHAR(20),
            can_apply_from_bd BOOLEAN,
            requires_existing_work_permit BOOLEAN,
            open_to_international_candidates BOOLEAN,
            open_to_authorized_workers_only BOOLEAN,
            eligibility_status VARCHAR(30),
            target_audience_tags JSONB NOT NULL DEFAULT '[]',
            risk_flags JSONB NOT NULL DEFAULT '[]',
            source_trust_badge VARCHAR(120),
            extraction_confidence FLOAT NOT NULL DEFAULT 0.0,
            connector_key VARCHAR(60),
            trust_score FLOAT NOT NULL DEFAULT 0.0,
            freshness_score FLOAT NOT NULL DEFAULT 0.0,
            actionability_score FLOAT NOT NULL DEFAULT 0.0,
            overall_rank_score FLOAT NOT NULL DEFAULT 0.0,
            slug VARCHAR(600),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            search_tsv TSVECTOR,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_published_draft UNIQUE (draft_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_type ON published_opportunities(opportunity_type)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_country ON published_opportunities(country)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_destination_country ON published_opportunities(destination_country)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_deadline ON published_opportunities(deadline)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_can_apply_bd ON published_opportunities(can_apply_from_bd)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_trust_badge ON published_opportunities(source_trust_badge)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_active ON published_opportunities(is_active)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_slug ON published_opportunities(slug)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_pub_opp_search_tsv ON published_opportunities USING gin(search_tsv)")

    # ── PublishedOpportunityEmbedding table ───────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS published_opportunity_embeddings (
            id SERIAL PRIMARY KEY,
            published_opportunity_id INTEGER NOT NULL
                REFERENCES published_opportunities(id) ON DELETE CASCADE,
            embedding vector(384) NOT NULL,
            embedding_model VARCHAR(120) NOT NULL,
            embedded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_pub_opp_embedding UNIQUE (published_opportunity_id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_pub_opp_embedding_vector
        ON published_opportunity_embeddings USING hnsw (embedding vector_cosine_ops)
    """)

    # ── Update saved_opportunities FK to published_opportunities ─────────────
    # First delete any saved items that reference non-existent published rows
    op.execute("""
        ALTER TABLE saved_opportunities
        DROP CONSTRAINT IF EXISTS saved_opportunities_opportunity_id_fkey
    """)
    # Add a new column for the published opportunity reference (keep old col for data)
    op.execute("""
        ALTER TABLE saved_opportunities
        ADD COLUMN IF NOT EXISTS published_opportunity_id INTEGER
            REFERENCES published_opportunities(id) ON DELETE CASCADE
    """)

    # ── Update alert_events FK ─────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE alert_events
        DROP CONSTRAINT IF EXISTS alert_events_opportunity_id_fkey
    """)
    op.execute("""
        ALTER TABLE alert_events
        ADD COLUMN IF NOT EXISTS published_opportunity_id INTEGER
            REFERENCES published_opportunities(id) ON DELETE CASCADE
    """)

    # ── feedback FK ────────────────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE feedback
        DROP CONSTRAINT IF EXISTS feedback_opportunity_id_fkey
    """)
    op.execute("""
        ALTER TABLE feedback
        ADD COLUMN IF NOT EXISTS published_opportunity_id INTEGER
            REFERENCES published_opportunities(id) ON DELETE CASCADE
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS published_opportunity_embeddings CASCADE")
    op.execute("DROP TABLE IF EXISTS published_opportunities CASCADE")
    op.execute("DROP TABLE IF EXISTS crawl_runs CASCADE")
    # Restore saved_opportunities FK
    op.execute("ALTER TABLE saved_opportunities DROP COLUMN IF EXISTS published_opportunity_id")
    op.execute("""
        ALTER TABLE saved_opportunities
        ADD CONSTRAINT saved_opportunities_opportunity_id_fkey
        FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    """)
    op.execute("ALTER TABLE alert_events DROP COLUMN IF EXISTS published_opportunity_id")
    op.execute("ALTER TABLE feedback DROP COLUMN IF EXISTS published_opportunity_id")
