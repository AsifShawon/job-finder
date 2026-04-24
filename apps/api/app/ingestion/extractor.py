from typing import Any

from langchain_groq import ChatGroq
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ingestion.schemas import (
    ExtractionBase,
    JobOpportunityExtraction,
    PolicyUpdateExtraction,
    ScholarshipExtraction,
    UnknownExtraction,
)
from app.services.runtime_settings_service import get_groq_api_key, get_groq_model


class ExtractionEnvelope(BaseModel):
    data: JobOpportunityExtraction | ScholarshipExtraction | PolicyUpdateExtraction | UnknownExtraction


def _fallback_extract(cleaned: dict[str, Any]) -> ExtractionBase:
    title = cleaned.get("title") or "Untitled"
    body = (cleaned.get("body_text") or "")[:3000]
    text = f"{title} {body}".lower()
    bd_relevant = any(term in text for term in ["bangladesh", "bangladeshi", "migrant worker", "bd worker"])
    opportunity_relevant = any(
        term in text
        for term in [
            "job",
            "jobs",
            "recruitment",
            "visa",
            "work permit",
            "migration",
            "migrant",
            "worker",
            "policy",
            "requirement",
            "salary",
        ]
    )
    if not (bd_relevant and opportunity_relevant):
        return ExtractionBase(
            record_type="unknown",
            title=title,
            summary=body[:400],
            extraction_confidence=0.2,
            evidence_snippets=["No clear Bangladesh job or migration policy relevance found without AI."],
        )
    record_type = "policy_update" if "policy" in text or "visa" in text or "permit" in text else "job"
    return ExtractionBase(
        record_type=record_type,
        title=title,
        summary=body[:400],
        application_url=cleaned.get("apply_link"),
        extraction_confidence=0.55,
        evidence_snippets=[title, body[:200]],
    )


def extract_structured(db: Session, cleaned: dict[str, Any]) -> ExtractionBase:
    groq_api_key = get_groq_api_key(db)
    if not groq_api_key:
        return _fallback_extract(cleaned)

    model = ChatGroq(model=get_groq_model(db), api_key=groq_api_key, temperature=0.0)
    structured = model.with_structured_output(ExtractionEnvelope)
    prompt = (
        "Extract structured overseas opportunity intelligence from the provided content.\n"
        "The platform is for Bangladeshi users and Bangladeshi migrant workers.\n"
        "Return record_type as job, scholarship, policy_update, or unknown.\n"
        "Keep job records only when the content describes a real job opportunity, recruitment notice, application path, "
        "or work-related eligibility/requirement for Bangladeshi people or migrant workers.\n"
        "Keep policy_update records only when the content changes or explains migration, visa, recruitment, work permit, "
        "salary, quota, eligibility, or worker requirement rules that may affect Bangladeshi people.\n"
        "Classify generic news, unrelated business news, entertainment, sports, opinions, and pages without an actionable "
        "Bangladesh or migrant-worker connection as unknown.\n"
        "Never guess salary, visa support, eligibility, deadline, employer, organization, or requirements. Use null or empty lists for unknown fields.\n"
        "Return evidence_snippets as a JSON array of short strings, not an object. "
        "For unknown records, evidence_snippets can explain why the page is not relevant.\n"
        f"Input title: {cleaned.get('title')}\n"
        f"Input body: {cleaned.get('body_text')}\n"
    )
    result: ExtractionEnvelope = structured.invoke(prompt)
    return result.data
