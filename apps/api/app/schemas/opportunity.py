from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import RecordType, SourceClass, TrustTier
from app.schemas.common import Page


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    record_type: RecordType
    title: str
    summary: str | None
    country: str | None
    city: str | None
    employer: str | None
    organization: str | None
    sector: str | None
    degree_level: str | None
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    funding_type: str | None
    deadline: date | None
    application_url: str | None
    visa_support: bool | None
    source_url: str
    trust_score: float
    freshness_score: float
    actionability_score: float
    extraction_confidence: float
    overall_rank_score: float
    is_active: bool
    published_at: datetime | None
    last_verified_at: datetime | None
    created_at: datetime
    updated_at: datetime


class OpportunityCard(BaseModel):
    id: int
    title: str
    summary: str | None
    record_type: RecordType
    organization: str | None
    employer: str | None
    country: str | None
    city: str | None
    deadline: date | None
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    funding_type: str | None
    trust_score: float
    source_class: SourceClass
    trust_tier: TrustTier
    source_url: str
    why_this_matches: str
    is_saved: bool


class OpportunitySearchResponse(Page[OpportunityCard]):
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


class OpportunitySourceResponse(BaseModel):
    source_id: int
    source_name: str
    source_url: str
    trust_tier: TrustTier
    source_class: SourceClass
    fetched_at: datetime | None


class SimilarOpportunityResponse(BaseModel):
    items: list[OpportunityCard]


class ReindexResponse(BaseModel):
    message: str
    opportunity_id: int
    embedding_model: str


class RawDocumentOut(BaseModel):
    id: int
    source_url: str
    canonical_url: str | None
    content_type: str | None
    raw_text: str | None
    raw_html_path: str | None
    metadata_json: dict[str, Any]
    fetched_at: datetime
