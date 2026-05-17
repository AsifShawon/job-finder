from __future__ import annotations

from pydantic import BaseModel, Field


class OfficialJobFieldEvidence(BaseModel):
    field_name: str
    section_heading: str
    evidence_line: str


class OfficialJobSection(BaseModel):
    heading: str
    normalized_heading: str
    items: list[str] = Field(default_factory=list)
    raw_text: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class OfficialJobParsedPayload(BaseModel):
    source_url: str
    final_url: str
    connector_key: str
    company: str | None = None
    title: str | None = None
    requisition_id: str | None = None
    country: str | None = None
    city: str | None = None
    department: str | None = None
    posted_date_text: str | None = None
    apply_url: str | None = None
    job_purpose: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    key_accountabilities: list[str] = Field(default_factory=list)
    role_accountabilities: list[str] = Field(default_factory=list)
    qualifications: list[str] = Field(default_factory=list)
    technical_skills: list[str] = Field(default_factory=list)
    competencies: list[str] = Field(default_factory=list)
    work_experience: str | None = None
    education: str | None = None
    work_permit_or_iqama: str | None = None
    salary_text: str | None = None
    deadline_text: str | None = None
    benefits: list[str] = Field(default_factory=list)
    raw_sections: list[OfficialJobSection] = Field(default_factory=list)
    ignored_noise_lines: list[str] = Field(default_factory=list)
    parser_warnings: list[str] = Field(default_factory=list)
    parser_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    field_sources: dict[str, list[OfficialJobFieldEvidence]] = Field(default_factory=dict)
