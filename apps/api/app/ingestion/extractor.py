import json
from typing import Any

import httpx
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
from app.services.runtime_settings_service import get_ai_api_key, get_ai_model, get_ai_provider


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


def _ensure_fields(extraction: ExtractionBase) -> ExtractionBase:
    """Coerce None list fields to [] and strip empty-string sentinels from Groq output."""
    for field in ("requirements", "benefits", "language_requirements", "evidence_snippets"):
        val = getattr(extraction, field)
        if val is None:
            setattr(extraction, field, [])
        elif isinstance(val, list):
            setattr(extraction, field, [v for v in val if v and str(v).strip()])
    if extraction.summary and not extraction.summary.strip():
        extraction.summary = None
    if extraction.application_url and not extraction.application_url.strip():
        extraction.application_url = None
    return extraction


_VALID_SECTORS = (
    "IT", "Healthcare", "Construction", "Education", "Hospitality", "Manufacturing",
    "Agriculture", "Fishing", "Transport", "Finance", "Retail", "Engineering",
    "Domestic Work", "Security", "Garments", "Cleaning", "Other",
)

_PROMPT_TEMPLATE = (
    "You are an overseas opportunity extractor for Bangladeshi workers.\n"
    "Extract ALL fields from the content below.\n\n"
    "CRITICAL: You MUST provide BOTH Bangla and English for these fields:\n"
    "- summary_bn: 2-3 sentence summary IN BANGLA (বাংলায় লিখুন)\n"
    "- summary_en: same summary IN ENGLISH\n"
    "- title_bn: translate the title to Bangla if not already in Bangla\n"
    "- eligibility_text: list requirements clearly\n\n"
    "CLASSIFICATION:\n"
    "- job: recruitment notice or job posting for Bangladeshi overseas workers\n"
    "- scholarship: academic funding open to Bangladeshis\n"
    "- policy_update: visa/migration/work permit rule changes\n"
    "- unknown: irrelevant content\n\n"
    "EXTRACTION RULES:\n"
    "- deadline_text: ISO date YYYY-MM-DD or null. Never guess.\n"
    "- salary_min/max/currency: null unless explicitly stated\n"
    "- country: destination country for the opportunity\n"
    "- requirements: JSON array of strings, each requirement separately\n"
    "- evidence_snippets: 1-3 direct quotes supporting classification\n"
    "- extraction_confidence: 0.0-1.0\n"
    f"- sector: One of {_VALID_SECTORS} or null.\n"
    "- application_url: Full URL or null. Never invent.\n"
    "- visa_support: true only if explicitly stated.\n\n"
    "INPUT TITLE: {title}\n"
    "INPUT BODY:\n{body}\n\n"
    "Return ONLY the structured JSON. No preamble.\n"
)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def _invoke_mistral(model: str, api_key: str, prompt: str) -> ExtractionEnvelope:
    response = httpx.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.0,
            "messages": [
                {"role": "system", "content": "Return only valid JSON that matches the requested schema."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return ExtractionEnvelope.model_validate(json.loads(_strip_code_fences(content)))


def extract_structured(db: Session, cleaned: dict[str, Any]) -> ExtractionBase:
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db)
    if not api_key:
        return _ensure_fields(_fallback_extract(cleaned))

    prompt = _PROMPT_TEMPLATE.format(
        title=cleaned.get("title") or "",
        body=(cleaned.get("body_text") or "")[:6000],
    )
    try:
        if provider == "mistral":
            result = _invoke_mistral(get_ai_model(db), api_key, prompt)
            return _ensure_fields(result.data)

        model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
        structured = model.with_structured_output(ExtractionEnvelope)
        result: ExtractionEnvelope = structured.invoke(prompt)
        return _ensure_fields(result.data)
    except Exception:
        return _ensure_fields(_fallback_extract(cleaned))
