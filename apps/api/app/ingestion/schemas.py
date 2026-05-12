from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class FetchedPage(BaseModel):
    """Raw content returned by a connector's discover_items()."""
    url: str
    canonical_url: str | None = None
    title: str | None = None
    raw_html: str | None = None
    raw_text: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    extracted_links: list[str] = Field(default_factory=list)
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    content_type: str = "html"           # html | pdf | html_with_pdf | image_pdf | rss | api | linkout_only | unknown
    document_url: str | None = None      # URL of an attached PDF
    source_page_url: str | None = None   # HTML page that linked to this PDF
    original_apply_url: str | None = None
    ocr_used: bool = False


class ParsedItem(BaseModel):
    """Structured item after connector.parse_item()."""
    title: str | None = None
    body_text: str = ""
    source_page_url: str = ""
    document_url: str | None = None
    original_apply_url: str | None = None
    content_type: str = "html"
    metadata: dict[str, Any] = Field(default_factory=dict)
    extra: dict[str, Any] = Field(default_factory=dict)


class OpportunityDraftPayload(BaseModel):
    """
    Normalized draft payload produced by connector.normalize() or the LLM extractor.
    This is what goes into the Opportunity (draft) table.
    """
    source_page_url: str
    document_url: str | None = None
    original_apply_url: str | None = None
    content_type: str = "html"
    opportunity_type: str | None = None

    title: str
    title_bn: str | None = None
    summary_bn: str | None = None
    summary_en: str | None = None

    country: str | None = None
    destination_country: str | None = None
    employer_or_organization: str | None = None
    job_title: str | None = None
    sector: str | None = None
    skill_level: str | None = None

    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str | None = None
    salary_text: str | None = None
    location_text: str | None = None

    deadline: str | None = None
    posted_date: str | None = None

    eligibility_text: str | None = None
    required_documents: str | None = None
    application_process: str | None = None
    education_requirement: str | None = None
    experience_requirement: str | None = None
    language_requirement: str | None = None
    age_requirement: str | None = None
    gender_requirement: str | None = None
    visa_or_work_permit_info: str | None = None

    risk_flags: list[str] = Field(default_factory=list)
    extraction_confidence: float = Field(ge=0, le=1, default=0.0)

    raw_text: str | None = None
    extracted_json: dict[str, Any] | None = None


# ── Legacy extraction schemas (kept for extractor.py compat) ─────────────────

class ExtractionBase(BaseModel):
    record_type: Literal["job", "scholarship", "policy_update", "unknown"]
    title: str | None = None
    title_bn: str | None = None
    summary: str | None = None
    summary_bn: str | None = None
    summary_en: str | None = None
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
    duration_text: str | None = None
    deadline_text: str | None = None
    application_url: str | None = None
    eligibility_text: str | None = None
    visa_support: bool | None = None
    can_apply_from_bd: bool | None = None
    requirements: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    language_requirements: list[str] = Field(default_factory=list)
    journey_steps: list[str] = Field(default_factory=list)
    documents_needed: list[str] = Field(default_factory=list)
    typical_salary_bdt: int | None = None
    extraction_confidence: float = Field(ge=0, le=1, default=0.0)
    evidence_snippets: list[str] = Field(default_factory=list)
    # Per-field confidence scores in [0, 1] computed by the multi-step extractor.
    # Surfaced in the admin review UI so reviewers can spot weak fields.
    field_confidences: dict[str, float] | None = None


class JobOpportunityExtraction(ExtractionBase):
    record_type: Literal["job"] = "job"


class ScholarshipExtraction(ExtractionBase):
    record_type: Literal["scholarship"] = "scholarship"


class PolicyUpdateExtraction(ExtractionBase):
    record_type: Literal["policy_update"] = "policy_update"


class UnknownExtraction(ExtractionBase):
    record_type: Literal["unknown"] = "unknown"


class PageJobsExtraction(BaseModel):
    jobs: list[JobOpportunityExtraction] = Field(default_factory=list)
