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
    CrawlStatus,
    FeedbackType,
    OpportunityLevel,
    RecordType,
    SourceClass,
    TrustTier,
)


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    base_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    country: Mapped[str | None] = mapped_column(String(120))
    source_class: Mapped[SourceClass] = mapped_column(Enum(SourceClass), nullable=False)
    trust_tier: Mapped[TrustTier] = mapped_column(Enum(TrustTier), nullable=False)
    access_method: Mapped[AccessMethod] = mapped_column(Enum(AccessMethod), nullable=False)
    crawl_frequency_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=1440)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    parser_key: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


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


class Opportunity(Base):
    __tablename__ = "opportunities"
    __table_args__ = (
        Index("ix_opportunity_record_type", "record_type"),
        Index("ix_opportunity_country_city", "country", "city"),
        Index("ix_opportunity_deadline", "deadline"),
        Index("ix_opportunity_active", "is_active"),
        Index("ix_opportunity_rank", "overall_rank_score"),
        Index("ix_opportunity_search_tsv", "search_tsv", postgresql_using="gin"),
        UniqueConstraint("source_id", "source_url", name="uq_opportunity_source_url"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    record_type: Mapped[RecordType] = mapped_column(Enum(RecordType), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(String(120))
    city: Mapped[str | None] = mapped_column(String(120))
    employer: Mapped[str | None] = mapped_column(String(255))
    organization: Mapped[str | None] = mapped_column(String(255))
    sector: Mapped[str | None] = mapped_column(String(120))
    opportunity_level: Mapped[OpportunityLevel | None] = mapped_column(Enum(OpportunityLevel))
    skill_level: Mapped[str | None] = mapped_column(String(120))
    degree_level: Mapped[str | None] = mapped_column(String(120))
    contract_type: Mapped[str | None] = mapped_column(String(120))
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(10))
    funding_type: Mapped[str | None] = mapped_column(String(120))
    duration_text: Mapped[str | None] = mapped_column(String(255))
    deadline: Mapped[Date | None] = mapped_column(Date)
    application_url: Mapped[str | None] = mapped_column(String(2048))
    eligibility_text: Mapped[str | None] = mapped_column(Text)
    visa_support: Mapped[bool | None] = mapped_column(Boolean)
    language_requirements_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    requirements_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    benefits_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    source_id: Mapped[int] = mapped_column(ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    raw_document_id: Mapped[int | None] = mapped_column(ForeignKey("raw_documents.id", ondelete="SET NULL"))
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    trust_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    freshness_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    actionability_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_rank_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    search_tsv: Mapped[str | None] = mapped_column(TSVECTOR)

    source: Mapped[Source] = relationship()
    raw_document: Mapped[RawDocument | None] = relationship()


class OpportunityEmbedding(Base):
    __tablename__ = "opportunity_embeddings"
    __table_args__ = (
        UniqueConstraint("opportunity_id", name="uq_opportunity_embedding_opp"),
        Index("ix_opportunity_embedding_vector", "embedding", postgresql_using="hnsw"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(120), nullable=False)
    embedded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    preferred_language: Mapped[str] = mapped_column(String(20), nullable=False, default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferred_countries_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    preferred_sectors_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    target_opportunity_types_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    education_level: Mapped[str | None] = mapped_column(String(120))
    years_of_experience: Mapped[int | None] = mapped_column(Integer)
    languages_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    salary_expectation: Mapped[float | None] = mapped_column(Numeric(12, 2))
    saved_search_preferences_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class SavedOpportunity(Base):
    __tablename__ = "saved_opportunities"
    __table_args__ = (UniqueConstraint("user_id", "opportunity_id", name="uq_saved_once"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
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
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(80), nullable=False, default="pending")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    opportunity_id: Mapped[int] = mapped_column(ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
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
