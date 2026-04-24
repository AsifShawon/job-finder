"""initial schema

Revision ID: 20260424_0001
Revises: None
Create Date: 2026-04-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "20260424_0001"
down_revision = None
branch_labels = None
depends_on = None


source_class_enum = sa.Enum("bd_migration", "foreign_jobs", "scholarship", "news_policy", name="sourceclass")
trust_tier_enum = sa.Enum("official_gov", "official_partner", "established_portal", "news_only", name="trusttier")
access_method_enum = sa.Enum("api", "rss", "static_html", "dynamic_html", "pdf", name="accessmethod")
crawl_status_enum = sa.Enum("pending", "running", "success", "failed", name="crawlstatus")
record_type_enum = sa.Enum("job", "scholarship", "policy_update", name="recordtype")
opp_level_enum = sa.Enum("entry", "mid", "senior", "unknown", name="opportunitylevel")
feedback_type_enum = sa.Enum("useful", "inaccurate", "outdated", "other", name="feedbacktype")


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("base_url", sa.String(length=1024), nullable=False),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("source_class", source_class_enum, nullable=False),
        sa.Column("trust_tier", trust_tier_enum, nullable=False),
        sa.Column("access_method", access_method_enum, nullable=False),
        sa.Column("crawl_frequency_minutes", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("parser_key", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("preferred_language", sa.String(length=20), nullable=False, server_default=sa.text("'en'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "crawl_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", crawl_status_enum, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("pages_fetched", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("records_extracted", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )

    op.create_table(
        "raw_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("canonical_url", sa.String(length=2048), nullable=True),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("raw_html_path", sa.String(length=2048), nullable=True),
        sa.Column("metadata_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("content_hash", sa.String(length=128), nullable=False),
        sa.UniqueConstraint("source_id", "source_url", name="uq_raw_doc_source_url"),
    )
    op.create_index("ix_raw_documents_hash", "raw_documents", ["content_hash"])

    op.create_table(
        "opportunities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("record_type", record_type_enum, nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("country", sa.String(length=120), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("employer", sa.String(length=255), nullable=True),
        sa.Column("organization", sa.String(length=255), nullable=True),
        sa.Column("sector", sa.String(length=120), nullable=True),
        sa.Column("opportunity_level", opp_level_enum, nullable=True),
        sa.Column("skill_level", sa.String(length=120), nullable=True),
        sa.Column("degree_level", sa.String(length=120), nullable=True),
        sa.Column("contract_type", sa.String(length=120), nullable=True),
        sa.Column("salary_min", sa.Numeric(12, 2), nullable=True),
        sa.Column("salary_max", sa.Numeric(12, 2), nullable=True),
        sa.Column("salary_currency", sa.String(length=10), nullable=True),
        sa.Column("funding_type", sa.String(length=120), nullable=True),
        sa.Column("duration_text", sa.String(length=255), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("application_url", sa.String(length=2048), nullable=True),
        sa.Column("eligibility_text", sa.Text(), nullable=True),
        sa.Column("visa_support", sa.Boolean(), nullable=True),
        sa.Column("language_requirements_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("requirements_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("benefits_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("source_id", sa.Integer(), sa.ForeignKey("sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_document_id", sa.Integer(), sa.ForeignKey("raw_documents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("trust_score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("freshness_score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("actionability_score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("extraction_confidence", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("overall_rank_score", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("search_tsv", postgresql.TSVECTOR(), nullable=True),
        sa.UniqueConstraint("source_id", "source_url", name="uq_opportunity_source_url"),
    )
    op.create_index("ix_opportunity_record_type", "opportunities", ["record_type"])
    op.create_index("ix_opportunity_country_city", "opportunities", ["country", "city"])
    op.create_index("ix_opportunity_deadline", "opportunities", ["deadline"])
    op.create_index("ix_opportunity_active", "opportunities", ["is_active"])
    op.create_index("ix_opportunity_rank", "opportunities", ["overall_rank_score"])
    op.create_index("ix_opportunity_search_tsv", "opportunities", ["search_tsv"], postgresql_using="gin")

    op.create_table(
        "opportunity_embeddings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", Vector(1024), nullable=False),
        sa.Column("embedding_model", sa.String(length=120), nullable=False),
        sa.Column("embedded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("opportunity_id", name="uq_opportunity_embedding_opp"),
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_opportunity_embedding_vector "
        "ON opportunity_embeddings USING hnsw (embedding vector_cosine_ops)"
    )

    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("preferred_countries_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("preferred_sectors_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("target_opportunity_types_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("education_level", sa.String(length=120), nullable=True),
        sa.Column("years_of_experience", sa.Integer(), nullable=True),
        sa.Column("languages_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("salary_expectation", sa.Numeric(12, 2), nullable=True),
        sa.Column("saved_search_preferences_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")),
    )

    op.create_table(
        "saved_opportunities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "opportunity_id", name="uq_saved_once"),
    )

    op.create_table(
        "alert_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("filter_json", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "alert_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("alert_rule_id", sa.Integer(), sa.ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=80), nullable=False, server_default=sa.text("'pending'")),
        sa.UniqueConstraint("alert_rule_id", "opportunity_id", name="uq_alert_event_once"),
    )

    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opportunity_id", sa.Integer(), sa.ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feedback_type", feedback_type_enum, nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_refresh_token_hash"),
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("feedback")
    op.drop_table("alert_events")
    op.drop_table("alert_rules")
    op.drop_table("saved_opportunities")
    op.drop_table("user_profiles")
    op.drop_table("opportunity_embeddings")
    op.drop_index("ix_opportunity_search_tsv", table_name="opportunities")
    op.drop_index("ix_opportunity_rank", table_name="opportunities")
    op.drop_index("ix_opportunity_active", table_name="opportunities")
    op.drop_index("ix_opportunity_deadline", table_name="opportunities")
    op.drop_index("ix_opportunity_country_city", table_name="opportunities")
    op.drop_index("ix_opportunity_record_type", table_name="opportunities")
    op.drop_table("opportunities")
    op.drop_index("ix_raw_documents_hash", table_name="raw_documents")
    op.drop_table("raw_documents")
    op.drop_table("crawl_jobs")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_table("sources")

    feedback_type_enum.drop(op.get_bind(), checkfirst=True)
    opp_level_enum.drop(op.get_bind(), checkfirst=True)
    record_type_enum.drop(op.get_bind(), checkfirst=True)
    crawl_status_enum.drop(op.get_bind(), checkfirst=True)
    access_method_enum.drop(op.get_bind(), checkfirst=True)
    trust_tier_enum.drop(op.get_bind(), checkfirst=True)
    source_class_enum.drop(op.get_bind(), checkfirst=True)
