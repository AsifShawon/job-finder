from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class FetchedPage(BaseModel):
    url: str
    canonical_url: str | None = None
    title: str | None = None
    raw_html: str | None = None
    raw_text: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    extracted_links: list[str] = Field(default_factory=list)
    fetched_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractionBase(BaseModel):
    record_type: Literal["job", "scholarship", "policy_update", "unknown"]
    title: str | None = None
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
    duration_text: str | None = None
    deadline_text: str | None = None
    application_url: str | None = None
    eligibility_text: str | None = None
    visa_support: bool | None = None
    requirements: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    language_requirements: list[str] = Field(default_factory=list)
    extraction_confidence: float = Field(ge=0, le=1, default=0.0)
    evidence_snippets: list[str] = Field(default_factory=list)


class JobOpportunityExtraction(ExtractionBase):
    record_type: Literal["job"] = "job"


class ScholarshipExtraction(ExtractionBase):
    record_type: Literal["scholarship"] = "scholarship"


class PolicyUpdateExtraction(ExtractionBase):
    record_type: Literal["policy_update"] = "policy_update"


class UnknownExtraction(ExtractionBase):
    record_type: Literal["unknown"] = "unknown"
