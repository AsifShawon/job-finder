from __future__ import annotations

from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    AccessMethod,
    ComplianceStatus,
    ConnectorKey,
    CrawlFrequency,
    CrawlRunStatus,
    CrawlStatus,
    FeedbackType,
    FirstCrawlMode,
    IngestionMode,
    LMIAStatus,
    OpportunityLevel,
    OpportunityType,
    RecordType,
    ReviewStatus,
    SourceClass,
    SourceType,
    TrustLevel,
    TrustTier,
)


# ── Source ─────────────────────────────────────────────────────────────────────

class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    # root_url is the canonical field; base_url kept as alias column for migration compat
    root_url: Mapped[str | None] = mapped_column(String(1024))
    base_url: Mapped[str] = mapped_column(String(1024), nullable=False)

    country: Mapped[str | None] = mapped_column(String(120))
    country_scope: Mapped[str | None] = mapped_column(String(255))

    source_type: Mapped[str | None] = mapped_column(String(40))
    ingestion_mode: Mapped[str | None] = mapped_column(String(40))
    connector_key: Mapped[str | None] = mapped_column(String(60))

    trust_level: Mapped[str | None] = mapped_column(String(40))
    compliance_status: Mapped[str | None] = mapped_column(String(40), default="unknown")
    crawl_frequency: Mapped[str | None] = mapped_column(String(20), default="daily")
    first_crawl_mode: Mapped[str | None] = mapped_column(String(30), default="active_only")

    target_audience: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    search_keywords: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    requires_admin_review: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    last_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Legacy fields kept for DB backward compat — not used in new pipeline
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_class: Mapped[SourceClass] = mapped_column(
        Enum(SourceClass), nullable=False, default=SourceClass.news_policy
    )
    trust_tier: Mapped[TrustTier] = mapped_column(
        Enum(TrustTier), nullable=False, default=TrustTier.news_only
    )
    access_method: Mapped[AccessMethod] = mapped_column(
        Enum(AccessMethod), nullable=False, default=AccessMethod.static_html
    )
    crawl_frequency_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=1440)
    parser_key: Mapped[str] = mapped_column(String(120), nullable=False, default="default")
    search_queries: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")

    @property
    def effective_root_url(self) -> str:
        return self.root_url or self.base_url


# ── AppSetting ─────────────────────────────────────────────────────────────────

class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ── CrawlRun (new, richer than CrawlJob) ──────────────────────────────────────

class CrawlRun(Base):
    __tablename__ = "crawl_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    connector_key: Mapped[str | None] = mapped_column(String(60))
    source_type: Mapped[str | None] = mapped_column(String(40))
    ingestion_mode: Mapped[str | None] = mapped_column(String(40))
    crawl_mode: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[CrawlRunStatus] = mapped_column(
        Enum(CrawlRunStatus), nullable=False, default=CrawlRunStatus.queued
    )
    discovered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    parsed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    draft_created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    draft_updated_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    manual_review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    logs: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    source: Mapped[Source] = relationship()


# ── CrawlJob (legacy, kept so old Celery tasks and admin pages don't break) ───

class CrawlJob(Base):
    __tablename__ = "crawl_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[CrawlStatus] = mapped_column(Enum(CrawlStatus), nullable=False, default=CrawlStatus.pending)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    pages_fetched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_extracted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    source: Mapped[Source] = relationship()


# ── RawDocument ───────────────────────────────────────────────────────────────

class RawDocument(Base):
    __tablename__ = "raw_documents"
    __table_args__ = (
        UniqueConstraint("source_id", "source_url", name="uq_raw_doc_source_url"),
        Index("ix_raw_documents_hash", "content_hash"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    canonical_url: Mapped[str | None] = mapped_column(String(2048))
    content_type: Mapped[str | None] = mapped_column(String(120))
    raw_text: Mapped[str | None] = mapped_column(Text)
    raw_html_path: Mapped[str | None] = mapped_column(String(2048))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(128), nullable=False)

    source: Mapped[Source] = relationship()


# ── Opportunity (draft / ingested, not yet published) ─────────────────────────
#
# Every item the crawler creates lands here as review_status='pending'.
# NOTHING is shown publicly until admin approves and a PublishedOpportunity row
# is created. The `is_active` flag on this model is NOT used for public search.

class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        Index("ix_opportunity_record_type", "record_type"),
        Index("ix_opportunity_country", "country"),
        Index("ix_opportunity_deadline", "deadline"),
        Index("ix_opportunity_review_status", "review_status"),
        Index("ix_opportunity_needs_review", "needs_admin_review"),
        Index("ix_opportunity_search_tsv", "search_tsv", postgresql_using="gin"),
        UniqueConstraint("source_id", "source_url", name="uq_opportunity_source_url"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(255))
    source_page_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    document_url: Mapped[str | None] = mapped_column(String(2048))
    original_apply_url: Mapped[str | None] = mapped_column(String(2048))

    content_type: Mapped[str | None] = mapped_column(String(20), default="html")
    opportunity_type: Mapped[str | None] = mapped_column(String(40))

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    title_bn: Mapped[str | None] = mapped_column(String(500))
    summary_bn: Mapped[str | None] = mapped_column(Text)
    summary_en: Mapped[str | None] = mapped_column(Text)

    country: Mapped[str | None] = mapped_column(String(120))
    destination_country: Mapped[str | None] = mapped_column(String(120))
    employer_or_organization: Mapped[str | None] = mapped_column(String(255))
    job_title: Mapped[str | None] = mapped_column(String(255))
    sector: Mapped[str | None] = mapped_column(String(120))
    skill_level: Mapped[str | None] = mapped_column(String(120))

    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(10))
    salary_text: Mapped[str | None] = mapped_column(String(255))
    location_text: Mapped[str | None] = mapped_column(String(255))

    deadline: Mapped[Date | None] = mapped_column(Date)
    posted_date: Mapped[Date | None] = mapped_column(Date)

    eligibility_text: Mapped[str | None] = mapped_column(Text)
    required_documents: Mapped[str | None] = mapped_column(Text)
    application_process: Mapped[str | None] = mapped_column(Text)
    education_requirement: Mapped[str | None] = mapped_column(Text)
    experience_requirement: Mapped[str | None] = mapped_column(Text)
    language_requirement: Mapped[str | None] = mapped_column(String(255))
    age_requirement: Mapped[str | None] = mapped_column(String(120))
    gender_requirement: Mapped[str | None] = mapped_column(String(120))
    visa_or_work_permit_info: Mapped[str | None] = mapped_column(Text)

    lmia_status: Mapped[str | None] = mapped_column(String(20))
    can_apply_from_bd: Mapped[bool | None] = mapped_column(Boolean)
    requires_existing_work_permit: Mapped[bool | None] = mapped_column(Boolean)
    open_to_international_candidates: Mapped[bool | None] = mapped_column(Boolean)
    open_to_authorized_workers_only: Mapped[bool | None] = mapped_column(Boolean)
    eligibility_status: Mapped[str | None] = mapped_column(String(30))

    target_audience_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    risk_flags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    source_trust_badge: Mapped[str | None] = mapped_column(String(120))
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    needs_admin_review: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    review_status: Mapped[str | None] = mapped_column(String(20), default="pending")
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    content_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    raw_text: Mapped[str | None] = mapped_column(Text)
    raw_html: Mapped[str | None] = mapped_column(Text)
    extracted_json: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    connector_key: Mapped[str | None] = mapped_column(String(60))

    raw_document_id: Mapped[int | None] = mapped_column(ForeignKey("raw_documents.id", ondelete="SET NULL"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    search_tsv: Mapped[str | None] = mapped_column(TSVECTOR)

    # ── Legacy fields kept for backward compat ──────────────────────────────
    record_type: Mapped[RecordType | None] = mapped_column(Enum(RecordType))
    summary: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120))
    employer: Mapped[str | None] = mapped_column(String(255))
    organization: Mapped[str | None] = mapped_column(String(255))
    degree_level: Mapped[str | None] = mapped_column(String(120))
    funding_type: Mapped[str | None] = mapped_column(String(120))
    application_url: Mapped[str | None] = mapped_column(String(2048))
    visa_support: Mapped[bool | None] = mapped_column(Boolean)
    language_requirements_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False, server_default="{}")
    requirements_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False, server_default="{}")
    benefits_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False, server_default="{}")
    trust_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    freshness_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actionability_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_rank_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    extracted_text: Mapped[str | None] = mapped_column(Text)
    # source_url kept as legacy alias for source_page_url
    source_url: Mapped[str | None] = mapped_column(String(2048))

    source: Mapped[Source] = relationship()
    raw_document: Mapped[RawDocument | None] = relationship()


# ── PublishedOpportunity (what public users see) ──────────────────────────────
#
# Created by admin approval. All public search/detail queries use this table.

class PublishedOpportunity(Base):
    __tablename__ = "published_opportunities"
    __table_args__ = (
        Index("ix_pub_opp_type", "opportunity_type"),
        Index("ix_pub_opp_country", "country"),
        Index("ix_pub_opp_destination_country", "destination_country"),
        Index("ix_pub_opp_deadline", "deadline"),
        Index("ix_pub_opp_can_apply_bd", "can_apply_from_bd"),
        Index("ix_pub_opp_trust_badge", "source_trust_badge"),
        Index("ix_pub_opp_active", "is_active"),
        Index("ix_pub_opp_search_tsv", "search_tsv", postgresql_using="gin"),
        UniqueConstraint("draft_id", name="uq_published_draft"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    source_name: Mapped[str | None] = mapped_column(String(255))
    source_page_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    document_url: Mapped[str | None] = mapped_column(String(2048))
    original_apply_url: Mapped[str | None] = mapped_column(String(2048))

    content_type: Mapped[str | None] = mapped_column(String(20))
    opportunity_type: Mapped[str | None] = mapped_column(String(40))

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    title_bn: Mapped[str | None] = mapped_column(String(500))
    summary_bn: Mapped[str | None] = mapped_column(Text)
    summary_en: Mapped[str | None] = mapped_column(Text)

    country: Mapped[str | None] = mapped_column(String(120))
    destination_country: Mapped[str | None] = mapped_column(String(120))
    employer_or_organization: Mapped[str | None] = mapped_column(String(255))
    job_title: Mapped[str | None] = mapped_column(String(255))
    sector: Mapped[str | None] = mapped_column(String(120))
    skill_level: Mapped[str | None] = mapped_column(String(120))

    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(10))
    salary_text: Mapped[str | None] = mapped_column(String(255))
    location_text: Mapped[str | None] = mapped_column(String(255))

    deadline: Mapped[Date | None] = mapped_column(Date)
    posted_date: Mapped[Date | None] = mapped_column(Date)

    eligibility_text: Mapped[str | None] = mapped_column(Text)
    required_documents: Mapped[str | None] = mapped_column(Text)
    application_process: Mapped[str | None] = mapped_column(Text)
    education_requirement: Mapped[str | None] = mapped_column(Text)
    experience_requirement: Mapped[str | None] = mapped_column(Text)
    language_requirement: Mapped[str | None] = mapped_column(String(255))
    age_requirement: Mapped[str | None] = mapped_column(String(120))
    gender_requirement: Mapped[str | None] = mapped_column(String(120))
    visa_or_work_permit_info: Mapped[str | None] = mapped_column(Text)

    lmia_status: Mapped[str | None] = mapped_column(String(20))
    can_apply_from_bd: Mapped[bool | None] = mapped_column(Boolean)
    requires_existing_work_permit: Mapped[bool | None] = mapped_column(Boolean)
    open_to_international_candidates: Mapped[bool | None] = mapped_column(Boolean)
    open_to_authorized_workers_only: Mapped[bool | None] = mapped_column(Boolean)
    eligibility_status: Mapped[str | None] = mapped_column(String(30))

    target_audience_tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    risk_flags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    source_trust_badge: Mapped[str | None] = mapped_column(String(120))
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    connector_key: Mapped[str | None] = mapped_column(String(60))

    trust_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    freshness_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actionability_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_rank_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    slug: Mapped[str | None] = mapped_column(String(600), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    search_tsv: Mapped[str | None] = mapped_column(TSVECTOR)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    draft: Mapped[Opportunity] = relationship()
    source: Mapped[Source] = relationship()


# ── OpportunityEmbedding ──────────────────────────────────────────────────────

class OpportunityEmbedding(Base):
    __tablename__ = "opportunity_embeddings"
    __table_args__ = (
        UniqueConstraint("opportunity_id", name="uq_opportunity_embedding_opp"),
        Index("ix_opportunity_embedding_vector", "embedding", postgresql_using="hnsw"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(120), nullable=False)
    embedded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PublishedOpportunityEmbedding(Base):
    __tablename__ = "published_opportunity_embeddings"
    __table_args__ = (
        UniqueConstraint("published_opportunity_id", name="uq_pub_opp_embedding"),
        Index("ix_pub_opp_embedding_vector", "embedding", postgresql_using="hnsw"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    published_opportunity_id: Mapped[int] = mapped_column(
        ForeignKey("published_opportunities.id", ondelete="CASCADE"), nullable=False
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(120), nullable=False)
    embedded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# ── User / Auth ───────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preferred_language: Mapped[str] = mapped_column(String(20), nullable=False, default="bn")
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferred_countries_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    preferred_sectors_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    target_opportunity_types_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    current_status: Mapped[str | None] = mapped_column(String(80))
    education_level: Mapped[str | None] = mapped_column(String(120))
    years_of_experience: Mapped[int | None] = mapped_column(Integer)
    languages_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    salary_expectation: Mapped[float | None] = mapped_column(Numeric(12, 2))
    saved_search_preferences_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


# ── Saved / Alerts ─────────────────────────────────────────────────────────────

class SavedOpportunity(Base):
    __tablename__ = "saved_opportunities"
    __table_args__ = (UniqueConstraint("user_id", "opportunity_id", name="uq_saved_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Points to PublishedOpportunity; legacy column name kept for compat
    opportunity_id: Mapped[int] = mapped_column(
        ForeignKey("published_opportunities.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    filter_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class AlertEvent(Base):
    __tablename__ = "alert_events"
    __table_args__ = (UniqueConstraint("alert_rule_id", "opportunity_id", name="uq_alert_event_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_rule_id: Mapped[int] = mapped_column(ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False)
    opportunity_id: Mapped[int] = mapped_column(
        ForeignKey("published_opportunities.id", ondelete="CASCADE"), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(80), nullable=False, default="pending")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    opportunity_id: Mapped[int] = mapped_column(
        ForeignKey("published_opportunities.id", ondelete="CASCADE"), nullable=False
    )
    feedback_type: Mapped[FeedbackType] = mapped_column(Enum(FeedbackType), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (UniqueConstraint("token_hash", name="uq_refresh_token_hash"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
