"""Bilingual (Bangla ↔ English) translation for opportunity records.

Used by:
- Pipeline (background Celery task after a draft is saved)
- Admin endpoints (manual per-draft translate, per-field translate, batch backfill)
- Manual entry form (per-field translate buttons)

Design:
- One LLM call per record per target language. Returns a flat JSON dict whose
  keys mirror the bilingual fields on Opportunity. Cheaper than per-field calls.
- Idempotent: only requests translations for fields that don't already have
  the target-language value.
- Source language detected via Bangla unicode range (0x0980-0x09FF).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Iterable

import httpx
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.entities import Opportunity
from app.services.runtime_settings_service import (
    get_ai_api_key,
    get_ai_model,
    get_ai_provider,
)


logger = logging.getLogger(__name__)


# ── Field inventory ───────────────────────────────────────────────────────────
# (canonical_field, bn_field, en_field, is_list)
# canonical_field is the source-language column; bn/en are the bilingual
# variants. is_list flags JSON list columns (journey_steps, documents_needed)
# which are translated as arrays of strings.

BILINGUAL_FIELDS: list[tuple[str, str, str, bool]] = [
    ("title",                    "title_bn",                    "title_en",                    False),
    ("summary",                  "summary_bn",                  "summary_en",                  False),
    ("job_title",                "job_title_bn",                "job_title_en",                False),
    ("salary_text",              "salary_text_bn",              "salary_text_en",              False),
    ("location_text",            "location_text_bn",            "location_text_en",            False),
    ("eligibility_text",         "eligibility_text_bn",         "eligibility_text_en",         False),
    ("required_documents",       "required_documents_bn",       "required_documents_en",       False),
    ("application_process",      "application_process_bn",      "application_process_en",      False),
    ("education_requirement",    "education_requirement_bn",    "education_requirement_en",    False),
    ("experience_requirement",   "experience_requirement_bn",   "experience_requirement_en",   False),
    ("language_requirement",     "language_requirement_bn",     "language_requirement_en",     False),
    ("visa_or_work_permit_info", "visa_or_work_permit_info_bn", "visa_or_work_permit_info_en", False),
    ("journey_steps",            "journey_steps_bn",            "journey_steps_en",            True),
    ("documents_needed",         "documents_needed_bn",         "documents_needed_en",         True),
]


# ── Language detection ────────────────────────────────────────────────────────

def _detect_lang(text: str | None) -> str:
    """Return 'bn' if text is mostly Bangla, 'en' if mostly Latin, 'mixed' otherwise."""
    if not text:
        return "en"
    bangla = sum(1 for ch in text if "ঀ" <= ch <= "৿")
    latin = sum(1 for ch in text if ("A" <= ch <= "Z") or ("a" <= ch <= "z"))
    total = bangla + latin
    if total == 0:
        return "en"
    bn_ratio = bangla / total
    if bn_ratio >= 0.6:
        return "bn"
    if bn_ratio <= 0.1:
        return "en"
    return "mixed"


def detect_record_language(opp: Opportunity) -> str:
    """Detect dominant language of an opportunity's source content."""
    samples = [opp.title or "", opp.summary or opp.summary_en or opp.summary_bn or ""]
    return _detect_lang(" ".join(samples))


# ── LLM payload schema ────────────────────────────────────────────────────────

class TranslationOutput(BaseModel):
    """Flat JSON the LLM returns. All fields optional — only requested ones come back."""
    title: str | None = None
    summary: str | None = None
    job_title: str | None = None
    salary_text: str | None = None
    location_text: str | None = None
    eligibility_text: str | None = None
    required_documents: str | None = None
    application_process: str | None = None
    education_requirement: str | None = None
    experience_requirement: str | None = None
    language_requirement: str | None = None
    visa_or_work_permit_info: str | None = None
    journey_steps: list[str] = Field(default_factory=list)
    documents_needed: list[str] = Field(default_factory=list)


class OfficialBilingualOutput(BaseModel):
    title_bn: str | None = None
    title_en: str | None = None
    summary_bn: str | None = None
    summary_en: str | None = None
    job_title_bn: str | None = None
    job_title_en: str | None = None
    salary_text_bn: str | None = None
    salary_text_en: str | None = None
    location_text_bn: str | None = None
    location_text_en: str | None = None
    eligibility_text_bn: str | None = None
    eligibility_text_en: str | None = None
    required_documents_bn: str | None = None
    required_documents_en: str | None = None
    application_process_bn: str | None = None
    application_process_en: str | None = None
    education_requirement_bn: str | None = None
    education_requirement_en: str | None = None
    experience_requirement_bn: str | None = None
    experience_requirement_en: str | None = None
    language_requirement_bn: str | None = None
    language_requirement_en: str | None = None
    visa_or_work_permit_info_bn: str | None = None
    visa_or_work_permit_info_en: str | None = None
    journey_steps_bn: list[str] = Field(default_factory=list)
    journey_steps_en: list[str] = Field(default_factory=list)
    documents_needed_bn: list[str] = Field(default_factory=list)
    documents_needed_en: list[str] = Field(default_factory=list)


# ── Prompt ────────────────────────────────────────────────────────────────────

_PROMPT = (
    "You are a bilingual translator for a Bangladeshi overseas-opportunity "
    "platform. Translate the following fields from {source_lang_name} to "
    "{target_lang_name}.\n\n"
    "Audience: rural Bangladeshi migrant workers and job seekers. Use simple, "
    "respectful, plain language. Keep proper nouns (country names, employer "
    "names, currencies, document names like 'passport') intact.\n\n"
    "Lists (journey_steps, documents_needed) must be returned as arrays of "
    "strings, one translated entry per source entry, preserving order.\n\n"
    "INPUT (JSON):\n{payload}\n\n"
    "Respond with ONLY a JSON object whose keys match the input keys and "
    "whose values are the {target_lang_name} translations. Omit any key whose "
    "input is empty or null."
)

_LANG_NAMES = {"bn": "Bengali (Bangla)", "en": "English"}

_OFFICIAL_BILINGUAL_PROMPT = (
    "You are enriching an overseas job record for a Bangladeshi worker platform.\n"
    "Use the source JSON below and return bilingual field pairs in Bangla and English.\n\n"
    "Rules:\n"
    "- Use Bangla script for all *_bn fields.\n"
    "- Use clear English for all *_en fields.\n"
    "- Keep proper nouns, employer names, locations, and currency codes accurate.\n"
    "- Do not invent facts that are not supported by the source JSON.\n"
    "- For list fields, return arrays of short strings.\n"
    "- Omit any field that cannot be filled reliably.\n\n"
    "SOURCE JSON:\n{payload}\n\n"
    "Return ONLY valid JSON."
)


# ── Field-level translate (used by manual entry buttons) ──────────────────────

def translate_text(
    db: Session,
    *,
    text: str,
    source_lang: str,
    target_lang: str,
    field_hint: str | None = None,
) -> str:
    """Translate a single string. Used by the per-field translate button."""
    if not text or not text.strip():
        return ""
    if source_lang == target_lang:
        return text

    api_key = get_ai_api_key(db)
    if not api_key:
        raise RuntimeError("AI API key not configured")

    field_part = f" The text is for the field '{field_hint}'." if field_hint else ""
    prompt = (
        f"Translate the following text from {_LANG_NAMES.get(source_lang, source_lang)} "
        f"to {_LANG_NAMES.get(target_lang, target_lang)}.{field_part} "
        "Audience: rural Bangladeshi migrant workers. Keep proper nouns intact. "
        "Respond with ONLY the translation, no quotes, no commentary.\n\n"
        f"TEXT:\n{text}"
    )
    return _invoke_llm_text(db, api_key, prompt).strip()


# ── Record-level translate ────────────────────────────────────────────────────

def translate_record(
    db: Session,
    opp: Opportunity,
    *,
    target_langs: Iterable[str] = ("bn", "en"),
    overwrite: bool = False,
) -> dict[str, Any]:
    """Fill missing _bn/_en fields on an Opportunity. Mutates and returns dict of changes.

    Idempotent: by default, fields that already have a value in the target
    language are skipped. Pass overwrite=True to force re-translation.
    """
    api_key = get_ai_api_key(db)
    if not api_key:
        raise RuntimeError("AI API key not configured")

    source_lang = detect_record_language(opp)
    # 'mixed' falls back to English source — the LLM will handle code-switched input
    src = "bn" if source_lang == "bn" else "en"

    # Seed: copy canonical fields into the matching source-language slot.
    changes: dict[str, Any] = {}
    for canonical, bn_field, en_field, _ in BILINGUAL_FIELDS:
        canonical_val = getattr(opp, canonical, None)
        if not canonical_val:
            continue
        same_lang_field = bn_field if src == "bn" else en_field
        if overwrite or not getattr(opp, same_lang_field, None):
            setattr(opp, same_lang_field, canonical_val)
            changes[same_lang_field] = canonical_val

    # Translate to each non-source target.
    for target in target_langs:
        if target == src:
            continue
        translated = _translate_to(db, opp, api_key, src, target, overwrite=overwrite)
        for field, value in translated.items():
            setattr(opp, field, value)
            changes[field] = value

    return changes


def enrich_bilingual_record(
    db: Session,
    opp: Opportunity,
    *,
    overwrite: bool = False,
) -> dict[str, Any]:
    """Best-effort bilingual enrichment for strict ingestion flows."""
    api_key = get_ai_api_key(db)
    if not api_key:
        raise RuntimeError("AI API key not configured")

    payload: dict[str, Any] = {}
    desired_fields: set[str] = set()
    for canonical, bn_field, en_field, is_list in BILINGUAL_FIELDS:
        source_value = getattr(opp, canonical, None) or getattr(opp, bn_field, None) or getattr(opp, en_field, None)
        if is_list:
            if not isinstance(source_value, list) or not source_value:
                continue
        elif not source_value or not str(source_value).strip():
            continue
        payload[canonical] = source_value
        if overwrite or not getattr(opp, bn_field, None):
            desired_fields.add(bn_field)
        if overwrite or not getattr(opp, en_field, None):
            desired_fields.add(en_field)

    if not payload or not desired_fields:
        return {}

    prompt = _OFFICIAL_BILINGUAL_PROMPT.format(
        payload=json.dumps(payload, ensure_ascii=False),
    )
    try:
        result = _invoke_llm_model(db, api_key, prompt, OfficialBilingualOutput)
    except Exception as exc:
        logger.warning(
            "official_bilingual_enrichment_failed",
            extra={"opp_id": opp.id, "error": str(exc)},
        )
        return {}

    changes: dict[str, Any] = {}
    for field_name in desired_fields:
        value = getattr(result, field_name, None)
        if isinstance(value, list):
            cleaned = [str(item).strip() for item in value if str(item).strip()]
            if cleaned:
                setattr(opp, field_name, cleaned)
                changes[field_name] = cleaned
        elif isinstance(value, str) and value.strip():
            cleaned = value.strip()
            setattr(opp, field_name, cleaned)
            changes[field_name] = cleaned
    return changes


def _translate_to(
    db: Session,
    opp: Opportunity,
    api_key: str,
    src: str,
    target: str,
    *,
    overwrite: bool,
) -> dict[str, Any]:
    """Build the input payload, call the LLM, map output back to _bn/_en field names."""
    target_field_suffix = f"_{target}"

    # Build input payload: only fields that have a source value AND need translation.
    payload: dict[str, Any] = {}
    field_map: dict[str, tuple[str, bool]] = {}  # canonical_key -> (target_field, is_list)
    for canonical, bn_field, en_field, is_list in BILINGUAL_FIELDS:
        target_field = bn_field if target == "bn" else en_field
        if not overwrite and getattr(opp, target_field, None):
            continue
        # Pull the best source-language value to translate from.
        source_field = bn_field if src == "bn" else en_field
        source_val = getattr(opp, source_field, None) or getattr(opp, canonical, None)
        if not source_val:
            continue
        if is_list and not isinstance(source_val, list):
            continue
        if not is_list and isinstance(source_val, str) and not source_val.strip():
            continue
        payload[canonical] = source_val
        field_map[canonical] = (target_field, is_list)

    if not payload:
        return {}

    prompt = _PROMPT.format(
        source_lang_name=_LANG_NAMES[src],
        target_lang_name=_LANG_NAMES[target],
        payload=json.dumps(payload, ensure_ascii=False),
    )

    try:
        result = _invoke_llm_structured(db, api_key, prompt)
    except Exception as exc:
        logger.warning(
            "translation_llm_failed",
            extra={"opp_id": opp.id, "target": target, "error": str(exc)},
        )
        return {}

    out: dict[str, Any] = {}
    for canonical, (target_field, is_list) in field_map.items():
        value = getattr(result, canonical, None)
        if is_list:
            if isinstance(value, list) and value:
                out[target_field] = [str(v) for v in value if str(v).strip()]
        else:
            if isinstance(value, str) and value.strip():
                out[target_field] = value.strip()
    return out


# ── LLM invocation helpers (mirror extractor.py patterns) ─────────────────────

def _invoke_llm_model(db: Session, api_key: str, prompt: str, output_model: type[BaseModel]) -> BaseModel:
    provider = get_ai_provider(db)
    model_name = get_ai_model(db)
    if provider == "mistral":
        return _invoke_mistral_structured(model_name, api_key, prompt, output_model)
    model = ChatGroq(model=model_name, api_key=api_key, temperature=0.0)
    structured = model.with_structured_output(output_model)
    return structured.invoke(prompt)  # type: ignore[return-value]


def _invoke_llm_structured(db: Session, api_key: str, prompt: str) -> TranslationOutput:
    return TranslationOutput.model_validate(_invoke_llm_model(db, api_key, prompt, TranslationOutput).model_dump())


def _invoke_mistral_structured(
    model: str,
    api_key: str,
    prompt: str,
    output_model: type[BaseModel],
) -> BaseModel:
    response = httpx.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.0,
            "messages": [
                {"role": "system", "content": "Return only valid JSON matching the requested schema."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return output_model.model_validate(json.loads(_strip_code_fences(content)))


def _invoke_llm_text(db: Session, api_key: str, prompt: str) -> str:
    """Plain-text invocation (no structured output) — used by translate_text()."""
    provider = get_ai_provider(db)
    model_name = get_ai_model(db)
    if provider == "mistral":
        response = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model_name,
                "temperature": 0.0,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=60,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    model = ChatGroq(model=model_name, api_key=api_key, temperature=0.0)
    return str(model.invoke(prompt).content)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned
