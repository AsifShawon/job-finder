from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import RecordType, SourceClass, TrustTier
from app.schemas.common import Page


# ── Published opportunity (public-facing) ──────────────────────────────────────

class PublishedOpportunityCard(BaseModel):
    """Card shown in search results — maps to PublishedOpportunity."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    title_bn: str | None = None
    title_en: str | None = None
    opportunity_type: str | None = None
    country: str | None = None
    destination_country: str | None = None
    employer_or_organization: str | None = None
    sector: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    salary_text: str | None = None
    salary_text_bn: str | None = None
    salary_text_en: str | None = None
    deadline: date | None = None
    source_page_url: str = ""
    document_url: str | None = None
    original_apply_url: str | None = None
    content_type: str | None = None
    source_name: str | None = None
    source_trust_badge: str | None = None
    can_apply_from_bd: bool | None = None
    requires_existing_work_permit: bool | None = None
    open_to_international_candidates: bool | None = None
    open_to_authorized_workers_only: bool | None = None
    lmia_status: str | None = None
    eligibility_status: str | None = None
    target_audience_tags: list[str] = []
    risk_flags: list[str] = []
    trust_score: float = 0.0
    overall_rank_score: float = 0.0
    published_at: datetime | None = None
    is_saved: bool = False
    why_this_matches: str = ""
    # Legacy compat
    summary: str | None = None
    summary_bn: str | None = None
    source_url: str = ""
    is_active: bool = True


class PublishedOpportunityDetail(PublishedOpportunityCard):
    """Full detail page — maps to PublishedOpportunity with all fields."""
    summary_en: str | None = None
    job_title: str | None = None
    job_title_bn: str | None = None
    job_title_en: str | None = None
    skill_level: str | None = None
    location_text: str | None = None
    location_text_bn: str | None = None
    location_text_en: str | None = None
    posted_date: date | None = None
    eligibility_text: str | None = None
    eligibility_text_bn: str | None = None
    eligibility_text_en: str | None = None
    required_documents: str | None = None
    required_documents_bn: str | None = None
    required_documents_en: str | None = None
    application_process: str | None = None
    application_process_bn: str | None = None
    application_process_en: str | None = None
    education_requirement: str | None = None
    education_requirement_bn: str | None = None
    education_requirement_en: str | None = None
    experience_requirement: str | None = None
    experience_requirement_bn: str | None = None
    experience_requirement_en: str | None = None
    language_requirement: str | None = None
    language_requirement_bn: str | None = None
    language_requirement_en: str | None = None
    age_requirement: str | None = None
    gender_requirement: str | None = None
    visa_or_work_permit_info: str | None = None
    visa_or_work_permit_info_bn: str | None = None
    visa_or_work_permit_info_en: str | None = None
    journey_steps: list[str] = []
    journey_steps_bn: list[str] = []
    journey_steps_en: list[str] = []
    documents_needed: list[str] = []
    documents_needed_bn: list[str] = []
    documents_needed_en: list[str] = []
    typical_salary_bdt: int | None = None
    extraction_confidence: float = 0.0
    connector_key: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    draft_id: int | None = None
    source_id: int | None = None
    employer: str | None = None
    organization: str | None = None
    city: str | None = None
    application_url: str | None = None
    funding_type: str | None = None
    visa_support: bool | None = None
    record_type: RecordType | None = None
    trust_tier: TrustTier | None = None
    requirements_json: dict[str, Any] | None = None
    benefits_json: dict[str, Any] | None = None
    language_requirements_json: dict[str, Any] | None = None
    mirror_urls: list[str] = []


class PublishedSearchResponse(Page[PublishedOpportunityCard]):
    pass


# ── Search query ──────────────────────────────────────────────────────────────

class PublishedSearchQuery(BaseModel):
    q: str | None = None
    opportunity_type: str | None = None
    country: str | None = None
    destination_country: str | None = None
    can_apply_from_bd: bool | None = None
    open_to_international_candidates: bool | None = None
    requires_existing_work_permit: bool | None = None
    lmia_status: str | None = None
    official_sources_only: bool = False
    source_type: str | None = None
    sector: str | None = None
    skill_level: str | None = None
    deadline_from: date | None = None
    deadline_to: date | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    fresh_days: int | None = None
    saved_only: bool = False
    sort: str = "relevance"
    page: int = 1
    page_size: int = 20


# ── Legacy schemas (kept so existing code that imports these doesn't break) ───

class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    record_type: RecordType | None = None
    title: str
    summary: str | None = None
    country: str | None = None
    city: str | None = None
    employer: str | None = None
    organization: str | None = None
    sector: str | None = None
    degree_level: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    funding_type: str | None = None
    deadline: date | None = None
    application_url: str | None = None
    visa_support: bool | None = None
    source_url: str | None = None
    document_url: str | None = None
    content_type: str | None = None
    trust_score: float = 0.0
    trust_tier: TrustTier | None = None
    freshness_score: float = 0.0
    actionability_score: float = 0.0
    extraction_confidence: float = 0.0
    overall_rank_score: float = 0.0
    is_active: bool = False
    published_at: datetime | None = None
    last_verified_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    opportunity_type: str | None = None
    lmia_status: str | None = None
    can_apply_from_bd: bool | None = None
    requires_existing_work_permit: bool | None = None
    open_to_international_candidates: bool | None = None
    open_to_authorized_workers_only: bool | None = None
    target_audience_tags: list[str] = []
    connector_key: str | None = None
    needs_admin_review: bool = True
    review_status: str | None = None


class OpportunityCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    summary: str | None = None
    record_type: RecordType | None = None
    organization: str | None = None
    employer: str | None = None
    country: str | None = None
    city: str | None = None
    deadline: date | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    funding_type: str | None = None
    trust_score: float = 0.0
    source_class: SourceClass = SourceClass.news_policy
    trust_tier: TrustTier = TrustTier.news_only
    source_url: str = ""
    document_url: str | None = None
    content_type: str | None = None
    why_this_matches: str = ""
    is_saved: bool = False
    created_at: datetime | None = None
    opportunity_type: str | None = None
    lmia_status: str | None = None
    can_apply_from_bd: bool | None = None
    requires_existing_work_permit: bool | None = None
    open_to_international_candidates: bool | None = None
    target_audience_tags: list[str] = []
    application_url: str | None = None


class OpportunitySearchResponse(Page[OpportunityCard]):
    pass


class RecommendationCard(OpportunityCard):
    match_score: float | None = None
    isc_match_key: str | None = None


class RecommendationResponse(Page[RecommendationCard]):
    pass


class OpportunitySearchQuery(BaseModel):
    q: str | None = None
    semantic_q: str | None = None
    record_type: RecordType | None = None
    country: str | None = None
    city: str | None = None
    sector: str | None = None
    source_class: SourceClass | None = None
    trust_tier: TrustTier | None = None
    deadline_from: date | None = None
    deadline_to: date | None = None
    visa_support: bool | None = None
    degree_level: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    fresh_days: int | None = None
    active_only: bool = True
    saved_only: bool = False
    sort: str = "relevance"
    page: int = 1
    page_size: int = 20
    opportunity_type: str | None = None
    can_apply_from_bd: bool | None = None
    open_to_international_candidates: bool | None = None
    requires_existing_work_permit: bool | None = None
    lmia_status: str | None = None
    official_sources_only: bool = False
    source_type: str | None = None


class OpportunitySourceResponse(BaseModel):
    source_id: int
    source_name: str
    source_url: str | None = None
    trust_tier: TrustTier | None = None
    source_class: SourceClass | None = None
    fetched_at: datetime | None = None


class SimilarOpportunityResponse(BaseModel):
    items: list[PublishedOpportunityCard]


class ReindexResponse(BaseModel):
    message: str
    opportunity_id: int
    embedding_model: str


class RawDocumentOut(BaseModel):
    id: int
    source_url: str
    canonical_url: str | None = None
    content_type: str | None = None
    raw_text: str | None = None
    raw_html_path: str | None = None
    metadata_json: dict[str, Any] = {}
    fetched_at: datetime | None = None
