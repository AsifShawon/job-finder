import json
import re
from typing import Any

from langchain_groq import ChatGroq
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ingestion.official_job_sections import OfficialJobParsedPayload
from app.ingestion.schemas import (
    ExtractionBase,
    JobOpportunityExtraction,
    PageJobsExtraction,
    PolicyUpdateExtraction,
    ScholarshipExtraction,
    UnknownExtraction,
)
from app.services.mistral_client import mistral_chat
from app.services.runtime_settings_service import get_ai_api_key, get_ai_model, get_ai_provider


class ExtractionEnvelope(BaseModel):
    data: JobOpportunityExtraction | ScholarshipExtraction | PolicyUpdateExtraction | UnknownExtraction


_RAW_METADATA_SIGNALS = (
    "Official listing metadata:",
    "Job detail page content:",
    "Source job ID:",
    "Apply URL:",
    "Career Details",
    "Login View profile",
    "Start apply with LinkedIn",
    "Please wait",
)


def is_raw_metadata_summary(text: str | None) -> bool:
    if not text:
        return False
    head = text[:500]
    return any(signal in head for signal in _RAW_METADATA_SIGNALS)


def _fallback_extract(cleaned: dict[str, Any]) -> ExtractionBase:
    """
    Fallback extractor used when LLM is not configured.
    Rejects news articles and only extracts genuine opportunity pages.
    """
    import re as _re

    title = cleaned.get("title") or "Untitled"
    body = (cleaned.get("body_text") or "")[:3000]
    text = f"{title} {body}".lower()

    # Patterns that strongly indicate a news article about employment statistics
    news_patterns = [
        r"\d+-month (low|high)",
        r"(drops?|fell|declined|decreased)\s+(by\s+)?\d+\s*%",
        r"(rose|increased|grew)\s+(by\s+)?\d+\s*%",
        r"year.on.year",
        r"month.on.month",
        r"according to (data|bbs|statistics|survey)",
        r"workers? (sent|deployed) abroad in [a-z]+",
        r"remittance (inflow|outflow|earning)",
        r"(research unit|rmmru|analysts?|experts?) (say|said|found|report)",
        r"\d+,\d+ workers? (were )?(sent|deployed|went)",
        r"(highest|lowest) (since|in) \d+ (months?|years?)",
    ]

    # Count how many news patterns match
    news_signal_count = sum(
        1 for pattern in news_patterns
        if _re.search(pattern, text)
    )

    # If 2 or more news patterns match, reject as news article
    if news_signal_count >= 2:
        return ExtractionBase(
            record_type="unknown",
            title=title,
            extraction_confidence=0.1,
            extraction_method="fallback_extract",
            evidence_snippets=[
                f"Detected as news article (matched {news_signal_count} news patterns). "
                "No actionable opportunity found."
            ],
        )

    # Signals that indicate an actual opportunity listing
    opportunity_signals = [
        "apply", "application", "deadline", "last date", "apply before",
        "vacancy", "circular", "recruitment notice", "job circular",
        "requirement", "requirements", "eligibility", "eligible",
        "salary", "wage", "remuneration",
        "passport", "visa", "work permit",
        "position", "post", "opening",
        "employer", "company", "organization",
    ]

    opportunity_signal_count = sum(1 for s in opportunity_signals if s in text)

    # Need at least 3 opportunity signals to proceed
    if opportunity_signal_count < 3:
        return ExtractionBase(
            record_type="unknown",
            title=title,
            extraction_confidence=0.1,
            extraction_method="fallback_extract",
            evidence_snippets=[
                f"Only {opportunity_signal_count} opportunity signals found (need 3+). "
                "Page does not appear to contain an actionable opportunity."
            ],
        )

    # Determine record type
    if any(w in text for w in [
        "scholarship", "fellowship", "bursary", "stipend",
        "study abroad", "fully funded", "tuition waiver",
    ]):
        record_type = "scholarship"
    elif any(w in text for w in [
        "visa rule change", "new policy", "circular issued", "government notification",
        "work permit process", "new regulation", "ministry announced",
    ]):
        record_type = "policy_update"
    else:
        record_type = "job"

    return ExtractionBase(
        record_type=record_type,
        title=title,
        summary=body[:400],
        application_url=cleaned.get("apply_link"),
        extraction_confidence=0.45,
        extraction_method="fallback_extract",
        evidence_snippets=[title, body[:200]],
    )


def extract_official_job_fallback(
    cleaned: dict[str, Any], page_metadata: dict[str, Any]
) -> JobOpportunityExtraction:
    """Heuristic extraction for official job pages when AI is unavailable or fails.

    Parses the content that appears AFTER the 'Job detail page content:' marker so the
    'Official listing metadata:' header is never used as summary text.
    """
    import re as _re

    body_text = cleaned.get("body_text") or ""
    # Strip our own injected header so it never leaks into user-visible fields.
    marker = "Job detail page content:"
    if marker in body_text:
        body_text = body_text[body_text.index(marker) + len(marker):].strip()

    title = cleaned.get("title") or page_metadata.get("title") or "Untitled"
    employer = (
        page_metadata.get("company")
        or cleaned.get("company")
        or cleaned.get("employer")
        or ""
    )
    location_raw = (
        page_metadata.get("location_raw")
        or cleaned.get("location_raw")
        or ""
    )
    country = page_metadata.get("country_hint") or ""
    city = ""
    if "," in location_raw:
        parts = [p.strip() for p in location_raw.split(",")]
        city = parts[0]
        if not country:
            country = parts[-1]
    elif location_raw:
        city = location_raw

    # Extract bullet-style requirements/responsibilities from body
    bullet_lines: list[str] = []
    for line in body_text.splitlines():
        stripped = line.strip()
        if stripped.startswith(("-", "•", "*", "·")) and len(stripped) > 3:
            bullet_lines.append(stripped.lstrip("-•*· ").strip())
        elif _re.match(r"^\d+[\.\)]\s+\S", stripped):
            bullet_lines.append(_re.sub(r"^\d+[\.\)]\s+", "", stripped))

    requirements = bullet_lines[:20] if bullet_lines else []

    # Build a minimal but correct summary_en — never copy raw header text
    location_phrase = f" in {location_raw}" if location_raw else ""
    if employer:
        summary_en = f"{employer} is hiring a {title}{location_phrase}."
    else:
        summary_en = f"{title} position available{location_phrase}."

    application_url = (
        page_metadata.get("apply_url")
        or cleaned.get("apply_url")
        or cleaned.get("apply_link")
        or cleaned.get("application_url")
        or None
    )

    return JobOpportunityExtraction(
        record_type="job",
        title=title,
        summary=summary_en,
        summary_en=summary_en,
        summary_bn=None,
        country=country or None,
        city=city or None,
        employer=employer or None,
        requirements=requirements,
        application_url=application_url,
        extraction_confidence=0.45,
        extraction_method="heuristic_official_fallback",
        evidence_snippets=[title, body_text[:200]],
    )


def build_official_job_ai_input_payload(parsed_payload: OfficialJobParsedPayload) -> dict[str, Any]:
    return {
        "title": parsed_payload.title or "",
        "company": parsed_payload.company or "",
        "country": parsed_payload.country or "",
        "city": parsed_payload.city or "",
        "department": parsed_payload.department or "",
        "apply_url": parsed_payload.apply_url or "",
        "posted_date": parsed_payload.posted_date_text or "",
        "job_purpose": parsed_payload.job_purpose or "",
        "responsibilities": parsed_payload.responsibilities,
        "key_accountabilities": parsed_payload.key_accountabilities,
        "role_accountabilities": parsed_payload.role_accountabilities,
        "qualifications": parsed_payload.qualifications,
        "technical_skills": parsed_payload.technical_skills,
        "competencies": parsed_payload.competencies,
        "work_experience": parsed_payload.work_experience or "",
        "education": parsed_payload.education or "",
        "work_permit_or_iqama": parsed_payload.work_permit_or_iqama or "",
        "benefits": parsed_payload.benefits,
        "deadline_text": parsed_payload.deadline_text or "",
        "salary_text": parsed_payload.salary_text or "",
        "source_sections": [
            {"title": section.heading, "items": section.items}
            for section in parsed_payload.raw_sections
            if section.items
        ],
    }


def build_official_job_ai_prompt(parsed_payload: OfficialJobParsedPayload) -> str:
    payload = build_official_job_ai_input_payload(parsed_payload)
    prompt = {
        "task": (
            "You are converting verified official job details into structured JSON for a "
            "Bangladeshi overseas job platform. Use only the provided parsed facts. "
            "Do not invent salary, deadline, visa support, or Bangladesh eligibility. "
            "Write worker-friendly Bangla and English summaries. Keep all requirements as "
            "separate list items. Return valid JSON only."
        ),
        "rules": [
            "If salary is not provided, keep salary fields null.",
            "If deadline is not provided, keep deadline_text null.",
            "If the page says transferable iqama, do not say Bangladeshi applicants can clearly apply from Bangladesh.",
            "If the page is for Saudi Arabia and requires transferable iqama, set can_apply_from_bd to null or false based on wording.",
            "Never include cookie, login, apply button, or navigation text in requirements.",
            "summary_bn must be natural Bangla.",
            "summary_en must be concise and professional.",
            "requirements must contain applicant requirements only.",
            "responsibilities must contain duties only.",
            "source_sections must preserve original important sections.",
        ],
        "output_schema": {
            "record_type": "job",
            "title": "",
            "title_bn": "",
            "summary_en": "",
            "summary_bn": "",
            "country": "",
            "city": "",
            "employer": "",
            "organization": "",
            "sector": "",
            "degree_level": "",
            "salary_min": None,
            "salary_max": None,
            "salary_currency": None,
            "deadline_text": None,
            "application_url": "",
            "eligibility_text": "",
            "visa_support": None,
            "can_apply_from_bd": None,
            "requirements": [],
            "benefits": [],
            "language_requirements": [],
            "job_purpose": "",
            "responsibilities": [],
            "key_accountabilities": [],
            "role_accountabilities": [],
            "qualifications": [],
            "skills": [],
            "work_conditions": [],
            "source_sections": [],
            "journey_steps": [],
            "documents_needed": [],
            "typical_salary_bdt": None,
            "extraction_confidence": 0.0,
            "evidence_snippets": [],
        },
        "input_facts": payload,
    }
    return json.dumps(prompt, ensure_ascii=False)


def official_parsed_payload_to_fallback_extraction(
    parsed_payload: OfficialJobParsedPayload,
) -> JobOpportunityExtraction:
    title = parsed_payload.title or "Official job opening"
    employer = parsed_payload.company or "The employer"
    country = parsed_payload.country or "Saudi Arabia"
    city = parsed_payload.city
    location_phrase = ", ".join([item for item in [city, country] if item])
    education = parsed_payload.education or _first_list_item(parsed_payload.qualifications)
    experience = parsed_payload.work_experience or _first_matching_item(parsed_payload.qualifications, ("experience", "year", "years"))
    responsibilities = list(parsed_payload.responsibilities)
    key_accountabilities = list(parsed_payload.key_accountabilities)
    role_accountabilities = list(parsed_payload.role_accountabilities)
    qualifications = _unique_items(
        parsed_payload.qualifications
        + ([parsed_payload.education] if parsed_payload.education else [])
        + ([parsed_payload.work_experience] if parsed_payload.work_experience else [])
    )
    requirements = _unique_items(
        qualifications
        + parsed_payload.technical_skills
        + parsed_payload.competencies
        + ([parsed_payload.work_permit_or_iqama] if parsed_payload.work_permit_or_iqama else [])
    )
    summary_en_parts = [
        f"{employer} is hiring {title}",
        f"in {location_phrase}" if location_phrase else "",
        ".",
    ]
    role_bits = []
    if parsed_payload.job_purpose:
        role_bits.append(parsed_payload.job_purpose)
    if responsibilities:
        role_bits.append("The role includes " + "; ".join(responsibilities[:4]))
    if education or experience:
        quals = " and ".join([item for item in [education, experience] if item])
        role_bits.append(f"The page mentions {quals}.")
    summary_en = " ".join(part for part in summary_en_parts if part).replace(" .", ".").strip()
    if role_bits:
        summary_en = f"{summary_en} {' '.join(role_bits)}".strip()

    summary_bn_parts = []
    if location_phrase:
        summary_bn_parts.append(f"{employer} {location_phrase} এ {title} পদে নিয়োগ দিচ্ছে।")
    else:
        summary_bn_parts.append(f"{employer} {title} পদে নিয়োগ দিচ্ছে।")
    bn_duties = []
    if parsed_payload.job_purpose:
        bn_duties.append(parsed_payload.job_purpose)
    if responsibilities:
        bn_duties.append("এই পদের কাজের মধ্যে রয়েছে " + ", ".join(responsibilities[:4]) + "।")
    if education or experience:
        quals = " এবং ".join([item for item in [education, experience] if item])
        bn_duties.append(f"পেজে {quals} উল্লেখ আছে।")
    summary_bn = " ".join(summary_bn_parts + bn_duties).strip()

    can_apply_from_bd: bool | None = None
    if parsed_payload.work_permit_or_iqama:
        lowered = parsed_payload.work_permit_or_iqama.lower()
        if "transferable iqama" in lowered:
            can_apply_from_bd = False
        elif any(term in lowered for term in ("work permit", "authorization", "resident", "residency")):
            can_apply_from_bd = False

    visa_support: bool | None = None
    if parsed_payload.work_permit_or_iqama and re.search(r"\b(sponsorship provided|visa provided)\b", parsed_payload.work_permit_or_iqama, re.I):
        visa_support = True

    extraction = JobOpportunityExtraction(
        record_type="job",
        title=title,
        title_bn=title,
        summary=summary_en,
        summary_en=summary_en,
        summary_bn=summary_bn,
        country=parsed_payload.country,
        city=parsed_payload.city,
        employer=parsed_payload.company,
        organization=parsed_payload.department,
        sector=parsed_payload.department,
        degree_level=_derive_degree_level(parsed_payload.education or "\n".join(parsed_payload.qualifications)),
        deadline_text=parsed_payload.deadline_text,
        application_url=parsed_payload.apply_url or parsed_payload.final_url,
        eligibility_text=parsed_payload.work_permit_or_iqama or _join_non_empty(requirements[:4], separator="\n"),
        visa_support=visa_support,
        can_apply_from_bd=can_apply_from_bd,
        requirements=requirements,
        benefits=list(parsed_payload.benefits),
        language_requirements=[],
        job_purpose=parsed_payload.job_purpose,
        responsibilities=responsibilities,
        key_accountabilities=key_accountabilities,
        role_accountabilities=role_accountabilities,
        qualifications=qualifications,
        skills=_unique_items(parsed_payload.technical_skills + parsed_payload.competencies),
        work_conditions=[],
        source_sections=[
            {"title": section.heading, "items": list(section.items)}
            for section in parsed_payload.raw_sections
            if section.items
        ],
        journey_steps=["মূল জব ডিটেইলস পড়ুন", "প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন", "অফিশিয়াল লিংকে আবেদন করুন"],
        documents_needed=["পাসপোর্ট", "সিভি", "শিক্ষাগত সনদ", "অভিজ্ঞতার সনদ"],
        typical_salary_bdt=None,
        extraction_confidence=max(float(parsed_payload.parser_confidence), 0.62),
        evidence_snippets=_build_evidence_snippets(parsed_payload),
        extraction_method="official_parsed_fallback",
    )
    return _hydrate_official_extraction_from_parsed_payload(extraction, parsed_payload, use_fallback_summary=True)


def run_official_job_ai_extraction(
    db: Session,
    parsed_payload: OfficialJobParsedPayload,
) -> tuple[JobOpportunityExtraction, dict[str, Any]]:
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db)
    input_payload = build_official_job_ai_input_payload(parsed_payload)
    diagnostics: dict[str, Any] = {
        "provider": provider,
        "model": get_ai_model(db),
        "prompt_version": "official_job_compact_v1",
        "input_payload": input_payload,
        "raw_output": None,
        "validated_output": None,
        "validation_errors": [],
        "repair_attempted": False,
        "repair_success": False,
        "fallback_used": False,
    }
    if not api_key:
        fallback = official_parsed_payload_to_fallback_extraction(parsed_payload)
        fallback.fallback_reason = "no_ai_api_key"
        diagnostics["validated_output"] = fallback.model_dump(mode="json")
        diagnostics["fallback_used"] = True
        return fallback, diagnostics

    prompt = build_official_job_ai_prompt(parsed_payload)
    try:
        raw_output = _invoke_official_job_text(db, provider, api_key, prompt)
        diagnostics["raw_output"] = raw_output
        extraction = _parse_official_job_json(raw_output)
    except Exception as exc:
        diagnostics["validation_errors"] = [f"initial_parse_failed:{type(exc).__name__}:{exc}"]
        diagnostics["repair_attempted"] = True
        try:
            repaired_raw = _invoke_official_job_repair(db, provider, api_key, parsed_payload, diagnostics["raw_output"])
            diagnostics["raw_output"] = repaired_raw
            extraction = _parse_official_job_json(repaired_raw)
            diagnostics["repair_success"] = True
        except Exception as repair_exc:
            diagnostics["validation_errors"].append(f"repair_failed:{type(repair_exc).__name__}:{repair_exc}")
            fallback = official_parsed_payload_to_fallback_extraction(parsed_payload)
            fallback.fallback_reason = f"official_repair_failed:{type(repair_exc).__name__}"
            diagnostics["validated_output"] = fallback.model_dump(mode="json")
            diagnostics["fallback_used"] = True
            return fallback, diagnostics

    extraction = _hydrate_official_extraction_from_parsed_payload(extraction, parsed_payload)
    diagnostics["validated_output"] = extraction.model_dump(mode="json")
    return extraction, diagnostics


def extract_official_job_from_parsed_payload(
    db: Session,
    parsed_payload: OfficialJobParsedPayload,
) -> JobOpportunityExtraction:
    extraction, _diagnostics = run_official_job_ai_extraction(db, parsed_payload)
    return extraction


def _ensure_fields(extraction: ExtractionBase) -> ExtractionBase:
    """Coerce None list fields to [] and strip empty-string sentinels from Groq output."""
    for field in (
        "requirements",
        "benefits",
        "language_requirements",
        "responsibilities",
        "key_accountabilities",
        "role_accountabilities",
        "qualifications",
        "skills",
        "work_conditions",
        "journey_steps",
        "documents_needed",
        "evidence_snippets",
    ):
        val = getattr(extraction, field)
        if val is None:
            setattr(extraction, field, [])
        elif isinstance(val, list):
            setattr(extraction, field, [v for v in val if v and str(v).strip()])
    if extraction.source_sections is None:
        extraction.source_sections = []
    elif isinstance(extraction.source_sections, list):
        cleaned_sections: list[dict[str, Any]] = []
        for section in extraction.source_sections:
            if not isinstance(section, dict):
                continue
            title = str(section.get("title") or "").strip()
            items = section.get("items") or []
            if isinstance(items, str):
                items = [items]
            clean_items = [str(item).strip() for item in items if str(item).strip()]
            if title and clean_items:
                cleaned_sections.append({"title": title, "items": clean_items})
        extraction.source_sections = cleaned_sections
    if extraction.summary and not extraction.summary.strip():
        extraction.summary = None
    if extraction.application_url and not extraction.application_url.strip():
        extraction.application_url = None
    return extraction


def _ensure_job_fields(extraction: JobOpportunityExtraction) -> JobOpportunityExtraction:
    return JobOpportunityExtraction.model_validate(_ensure_fields(extraction).model_dump())


def _ensure_job_list(extractions: list[JobOpportunityExtraction], *, max_jobs: int) -> list[JobOpportunityExtraction]:
    cleaned: list[JobOpportunityExtraction] = []
    for extraction in extractions[:max_jobs]:
        cleaned.append(_ensure_job_fields(extraction))
    return cleaned


_VALID_SECTORS = (
    "IT", "Healthcare", "Construction", "Education", "Hospitality", "Manufacturing",
    "Agriculture", "Fishing", "Transport", "Finance", "Retail", "Engineering",
    "Domestic Work", "Security", "Garments", "Cleaning", "Other",
)

_PROMPT_TEMPLATE = (
    "You are a strict opportunity extractor for a Bangladeshi migrant worker platform.\n"
    "Your job is to determine if a web page contains an ACTIONABLE OPPORTUNITY and extract structured data.\n\n"
    "## STEP 1 - CLASSIFY THE PAGE\n\n"
    "### Set record_type = 'unknown' and STOP if the page is any of these:\n"
    "- A news article reporting employment STATISTICS or TRENDS\n"
    "  (signals: '43-month low', 'drops 64%', 'declined by', 'year-on-year', 'according to data',\n"
    "   'remittance', 'BBS data', 'research unit', 'analysts say', 'survey shows')\n"
    "- An opinion piece, editorial, interview, or commentary about migration\n"
    "- A general report about labor market conditions with no specific vacancy\n"
    "- A page that has NO employer name, NO application process, NO deadline, NO requirements list\n"
    "- A page where the main content is about numbers/percentages of workers deployed\n\n"
    "### Set record_type = 'job' ONLY when the page has ALL THREE of these:\n"
    "1. A specific employer name OR government recruitment agency (e.g. BOESL, manpower agency)\n"
    "2. A destination country or city where the job is located\n"
    "3. At least TWO of: job title, salary, deadline, requirements list, application URL\n\n"
    "### Set record_type = 'scholarship' ONLY when the page has ALL THREE of these:\n"
    "1. A specific university, government body, or organization offering the funding\n"
    "2. An application deadline OR clear eligibility criteria\n"
    "3. The destination country for study\n\n"
    "### Set record_type = 'policy_update' ONLY when ALL THREE are true:\n"
    "1. A SPECIFIC CHANGE to visa rules, work permit process, or government circular\n"
    "2. A date when the change takes effect OR was officially announced\n"
    "3. It directly changes what a Bangladeshi worker must DO or CAN DO\n"
    "NOTE: News articles reporting that worker numbers went up or down are NOT policy updates.\n\n"
    "## STEP 2 - EXTRACT STRUCTURED DATA (only when record_type is NOT unknown)\n\n"
    "BILINGUAL FIELDS (required when extracting):\n"
    "- title: Original title from the page\n"
    "- title_bn: Bengali translation of the title. Write in proper Bangla script.\n"
    "- summary_en: 2-3 sentences in plain English. Answer: what is the opportunity, "
    "where is it, who can apply, how to apply.\n"
    "- summary_bn: Same 2-3 sentences in plain Bangla. Write for a non-technical "
    "migrant worker who may have only finished SSC.\n\n"
    "LOCATION:\n"
    "- country: The DESTINATION country where the job/study is. Not Bangladesh unless it is a local job.\n\n"
    "DEADLINE:\n"
    "- deadline_text: Application deadline in YYYY-MM-DD format only.\n"
    "  Return null if not explicitly stated. NEVER guess or infer a date.\n\n"
    "SALARY:\n"
    "- salary_min: Numeric value only, null if not stated\n"
    "- salary_max: Numeric value only, null if not stated\n"
    "- salary_currency: 3-letter currency code (BDT, USD, SAR, MYR, CAD, EUR, GBP, KRW, JPY)\n"
    "  All three salary fields must be null together if salary is not explicitly mentioned.\n\n"
    "REQUIREMENTS:\n"
    "- requirements: A JSON array of strings. Each string is ONE single requirement.\n"
    "  Write each requirement as a short clear sentence.\n"
    "  Good example: ['Age 22 to 40 years', 'Minimum SSC passed', 'Valid passport required',\n"
    "  'No criminal record', 'Physically fit']\n"
    "  Bad example: ['Age 22-40, SSC passed, valid passport, no criminal record, physically fit']\n"
    "  Return empty array [] if no requirements are stated.\n\n"
    "ELIGIBILITY:\n"
    "- eligibility_text: Plain text paragraph listing who can apply. Include age range,\n"
    "  education level, gender requirements, nationality requirements if stated.\n"
    "- visa_support: true ONLY if the page explicitly says visa/air ticket/accommodation\n"
    "  is provided by the employer. false if not mentioned. Never guess.\n\n"
    "APPLICATION:\n"
    "- application_url: The direct link to apply or the official circular PDF URL.\n"
    "  Must be a complete URL starting with http. Return null if not found.\n"
    "  NEVER invent or guess a URL.\n\n"
    "BANGLADESH APPLICABILITY:\n"
    "- can_apply_from_bd: true when the job appears open to Bangladeshi applicants or overseas applicants in general.\n"
    "  false when the page clearly requires an existing local work permit, citizenship, or local residency.\n"
    "  null only when the page is too sparse to estimate.\n"
    "- For Bangladesh-context jobs, estimate whether visa/recruitment-agency processing is likely needed and reflect that clearly in journey_steps.\n\n"
    "PRACTICAL JOURNEY SUPPORT:\n"
    "- journey_steps: A JSON array of 3 to 6 short Bangla steps explaining what the worker should do next.\n"
    "  Example: ['পাসপোর্ট করুন', 'প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন', 'ভিসা আবেদন করুন']\n"
    "- documents_needed: A JSON array of short Bangla document names or phrases.\n"
    "  Example: ['পাসপোর্ট', 'জাতীয় পরিচয়পত্র', 'শিক্ষা সনদ']\n"
    "- typical_salary_bdt: integer only. If salary is stated in a foreign currency, convert it to an approximate BDT amount.\n"
    "  Return null when salary is not stated.\n\n"
    "CONFIDENCE SCORING:\n"
    "Rate extraction_confidence from 0.0 to 1.0 based on how much structured data was found:\n"
    "- 0.85 to 1.0: Has employer + country + deadline + requirements + salary + application URL\n"
    "- 0.70 to 0.84: Has employer + country + requirements, missing deadline or salary\n"
    "- 0.50 to 0.69: Has job title and country but missing most structured fields\n"
    "- 0.30 to 0.49: Very sparse, only title and partial info extractable\n"
    "- 0.10 to 0.29: Almost nothing extractable, borderline unknown\n\n"
    "EVIDENCE:\n"
    "- evidence_snippets: 1 to 3 direct quotes from the page that support your classification.\n"
    "  For unknown pages, quote the part that shows it is a news article not a job listing.\n\n"
    "## INPUT\n"
    "Title: {title}\n\n"
    "Body:\n{body}\n\n"
    "## OUTPUT FORMAT\n"
    "Return ONLY a single valid JSON object. No markdown, no code fences, no explanation.\n\n"
    "If record_type is 'unknown', return exactly this structure:\n"
    '{{"record_type": "unknown", "title": "<original title>", '
    '"extraction_confidence": 0.1, '
    '"evidence_snippets": ["<quote from page showing why it is not actionable>"]}}\n\n'
    "If record_type is 'job', 'scholarship', or 'policy_update', return the full schema "
    "with every field present (use null for missing optional fields, [] for empty arrays).\n"
)

_PAGE_JOBS_PROMPT_TEMPLATE = (
    "You extract actionable overseas job opportunities from a single web page.\n"
    "The page may contain zero, one, or many jobs.\n"
    "Return ONLY jobs. Ignore scholarship, policy, news, commentary, statistics, pagination, filters, and boilerplate.\n\n"
    "RULES:\n"
    "- Return a JSON object with a single field: jobs\n"
    '- jobs must be an array of job objects. If there are no actionable jobs, return {"jobs": []}\n'
    "- Each job must be uniquely identifiable from the page and must represent a real opening or recruitment notice.\n"
    "- Do not invent missing values. Use null for unknown optional fields and [] for empty lists.\n"
    "- Keep each requirement as a separate short sentence.\n"
    "- country is the destination country.\n"
    "- application_url must be an absolute http/https URL when present.\n"
    "- deadline_text must be YYYY-MM-DD when explicitly stated; otherwise null.\n"
    "- title_bn and summary_bn must use Bangla script.\n"
    "- summary_en and summary_bn should each explain what the role is, where it is, who can apply, and how to apply.\n\n"
    "- can_apply_from_bd should be an estimated boolean using the snippet/page context.\n"
    "- journey_steps must be a Bangla array of short practical steps.\n"
    "- documents_needed must be a Bangla array.\n"
    "- typical_salary_bdt should be an approximate integer BDT conversion when salary is present.\n\n"
    "JOB SCHEMA:\n"
    "- record_type must always be 'job'\n"
    "- title, title_bn, summary, summary_en, summary_bn, country, employer, salary_min, salary_max, salary_currency,\n"
    "  deadline_text, application_url, eligibility_text, visa_support, requirements, benefits,\n"
    "  language_requirements, can_apply_from_bd, journey_steps, documents_needed,\n"
    "  typical_salary_bdt, extraction_confidence, evidence_snippets\n\n"
    "INPUT\n"
    "Title: {title}\n\n"
    "Body:\n{body}\n\n"
    "OUTPUT\n"
    "Return only valid JSON with this shape:\n"
    '{"jobs": [{...job schema...}]}\n'
)

_OFFICIAL_JOB_PROMPT_TEMPLATE = (
    "You extract a FULL official job detail page for a Bangladeshi overseas job platform.\n"
    "This is not a snippet. Preserve all meaningful job detail sections from the source page.\n\n"
    "CLASSIFICATION:\n"
    "- Return record_type='job' when this is a real job opening from an official careers page.\n"
    "- Return record_type='unknown' only if there is no job opening.\n\n"
    "QUALITY RULES:\n"
    "- Remove boilerplate such as cookies, navigation, profile menu, legal footer, and login text.\n"
    "- Do not invent salary, deadline, visa support, documents, benefits, or Bangladesh applicability.\n"
    "- If a fact is not explicitly stated, use null or an empty list.\n"
    "- Preserve technical role details. Do not compress responsibilities into one sentence.\n"
    "- summary_en and summary_bn must be useful worker-facing summaries, not metadata dumps.\n"
    "- summary_bn must be natural Bangla script for Bangladeshi users; keep employer names and technical terms accurate.\n\n"
    "RICH SOURCE SECTIONS:\n"
    "- job_purpose: exact practical meaning of the source Job Purpose section, if present.\n"
    "- responsibilities: duties from source sections like Responsibilities, Duties, Tasks.\n"
    "- key_accountabilities: items from Key Accountability Areas.\n"
    "- role_accountabilities: items from Role Accountability.\n"
    "- qualifications: education, certification, experience, or eligibility requirements.\n"
    "- skills: tools, technologies, soft skills, language skills, and role skills.\n"
    "- work_conditions: worksite, schedule, travel, physical, or environment conditions.\n"
    "- source_sections: an array preserving every important source heading and its bullet/list items.\n"
    "  Use this shape: [{\"title\":\"Job Purpose\",\"items\":[\"...\"]}]\n\n"
    "BACKWARD COMPATIBILITY FIELDS:\n"
    "- requirements must include the applicant-facing qualifications/requirements as short separate strings.\n"
    "- benefits must include only benefits/support explicitly stated by the page.\n"
    "- eligibility_text should summarize who can apply, including uncertainty when nationality/work authorization is unclear.\n"
    "- journey_steps must be simple Bangla practical next steps for applying safely.\n"
    "- documents_needed must be Bangla document names only when supported or generally necessary for an online job application.\n\n"
    "OUTPUT SCHEMA:\n"
    "Return only valid JSON matching the JobOpportunityExtraction schema. No markdown, no wrapping object.\n"
    "Include every known field where possible:\n"
    "record_type, title, title_bn, summary, summary_bn, summary_en, country, city, employer, organization, sector,\n"
    "degree_level, salary_min, salary_max, salary_currency, deadline_text, application_url, eligibility_text,\n"
    "visa_support, can_apply_from_bd, requirements, benefits, language_requirements, job_purpose, responsibilities,\n"
    "key_accountabilities, role_accountabilities, qualifications, skills, work_conditions, source_sections,\n"
    "journey_steps, documents_needed, typical_salary_bdt, extraction_confidence, evidence_snippets.\n\n"
    "CONFIDENCE:\n"
    "- Missing salary or deadline should not force low confidence if the official page has title, employer, country, apply URL, and rich role details.\n"
    "- 0.80-0.95: official job page with rich role details and apply URL, even if salary/deadline is not stated.\n"
    "- 0.65-0.79: real job page but sparse role details or unclear eligibility.\n"
    "- below 0.65: very sparse or ambiguous.\n\n"
    "INPUT\n"
    "Title: {title}\n\n"
    "Body:\n{body}\n\n"
    "Return only valid JSON. No markdown."
)

_LINKOUT_JOB_PROMPT_TEMPLATE = (
    "You create a conservative draft from a search-result snippet for a Bangladeshi overseas job platform.\n"
    "The source page could not be scraped, so use ONLY the title, snippet, and URL below.\n"
    "Treat this as a likely job lead, not a verified full listing.\n\n"
    "Return ONLY valid JSON for one job object with these fields:\n"
    "- record_type='job'\n"
    "- title, title_bn, summary, summary_en, summary_bn\n"
    "- country, employer, salary_min, salary_max, salary_currency, typical_salary_bdt\n"
    "- deadline_text, application_url, eligibility_text, visa_support, can_apply_from_bd\n"
    "- requirements, benefits, language_requirements, journey_steps, documents_needed\n"
    "- extraction_confidence, evidence_snippets\n\n"
    "Rules:\n"
    "- Set application_url to the provided URL.\n"
    "- Do not invent specific salary, deadline, or employer facts that are not supported by the snippet.\n"
    "- journey_steps and documents_needed must be practical Bangla arrays for low-literacy Bangladeshi users.\n"
    "- summary_bn must clearly say that full details are on the original site.\n"
    "- Keep extraction_confidence between 0.25 and 0.55 because this is snippet-only.\n\n"
    "INPUT\n"
    "Title: {title}\n"
    "Snippet: {snippet}\n"
    "URL: {url}\n"
)


def _strip_code_fences(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    return cleaned


def _invoke_official_job_text(db: Session, provider: str, api_key: str, prompt: str) -> str:
    if provider == "mistral":
        return mistral_chat(
            api_key,
            get_ai_model(db),
            [
                {"role": "system", "content": "Return only valid JSON matching the requested job schema."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            json_mode=True,
        )
    model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
    return str(model.invoke(prompt).content or "")


def _invoke_official_job_repair(
    db: Session,
    provider: str,
    api_key: str,
    parsed_payload: OfficialJobParsedPayload,
    raw_output: str | None,
) -> str:
    repair_prompt = (
        "Repair the following model output into valid JSON that matches the requested job schema. "
        "Use only these parsed facts and do not invent missing values.\n\n"
        f"Parsed facts:\n{json.dumps(build_official_job_ai_input_payload(parsed_payload), ensure_ascii=False)}\n\n"
        f"Invalid output:\n{raw_output or ''}"
    )
    return _invoke_official_job_text(db, provider, api_key, repair_prompt)


def _parse_official_job_json(raw_output: str) -> JobOpportunityExtraction:
    cleaned = _strip_code_fences(raw_output)
    payload = json.loads(cleaned)
    if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
        payload = payload["data"]
    extraction = JobOpportunityExtraction.model_validate(payload)
    return _ensure_job_fields(extraction)


def _hydrate_official_extraction_from_parsed_payload(
    extraction: JobOpportunityExtraction,
    parsed_payload: OfficialJobParsedPayload,
    *,
    use_fallback_summary: bool = False,
) -> JobOpportunityExtraction:
    extraction.title = extraction.title or parsed_payload.title
    extraction.title_bn = extraction.title_bn or extraction.title or parsed_payload.title
    extraction.country = extraction.country or parsed_payload.country
    extraction.city = extraction.city or parsed_payload.city
    extraction.employer = extraction.employer or parsed_payload.company
    extraction.organization = extraction.organization or parsed_payload.department
    extraction.sector = extraction.sector or parsed_payload.department
    extraction.application_url = extraction.application_url or parsed_payload.apply_url or parsed_payload.final_url
    extraction.deadline_text = extraction.deadline_text or parsed_payload.deadline_text
    extraction.job_purpose = extraction.job_purpose or parsed_payload.job_purpose
    extraction.key_accountabilities = _unique_items(extraction.key_accountabilities + parsed_payload.key_accountabilities)
    extraction.role_accountabilities = _unique_items(extraction.role_accountabilities + parsed_payload.role_accountabilities)
    extraction.responsibilities = _unique_items(extraction.responsibilities + parsed_payload.responsibilities)
    extraction.qualifications = _unique_items(
        extraction.qualifications
        + parsed_payload.qualifications
        + ([parsed_payload.education] if parsed_payload.education else [])
        + ([parsed_payload.work_experience] if parsed_payload.work_experience else [])
    )
    extraction.skills = _unique_items(extraction.skills + parsed_payload.technical_skills + parsed_payload.competencies)
    extraction.benefits = _unique_items(extraction.benefits + parsed_payload.benefits)
    extraction.source_sections = extraction.source_sections or [
        {"title": section.heading, "items": list(section.items)}
        for section in parsed_payload.raw_sections
        if section.items
    ]
    extraction.evidence_snippets = extraction.evidence_snippets or _build_evidence_snippets(parsed_payload)
    extraction.degree_level = extraction.degree_level or _derive_degree_level(parsed_payload.education or "\n".join(parsed_payload.qualifications))
    extraction.eligibility_text = extraction.eligibility_text or parsed_payload.work_permit_or_iqama
    if extraction.can_apply_from_bd is None and parsed_payload.work_permit_or_iqama:
        lowered = parsed_payload.work_permit_or_iqama.lower()
        if "transferable iqama" in lowered:
            extraction.can_apply_from_bd = False
        elif any(term in lowered for term in ("work permit", "authorization", "resident")):
            extraction.can_apply_from_bd = False
    if extraction.visa_support is None and parsed_payload.work_permit_or_iqama:
        if re.search(r"\b(sponsorship provided|visa provided)\b", parsed_payload.work_permit_or_iqama, re.I):
            extraction.visa_support = True
    if not extraction.requirements:
        extraction.requirements = _unique_items(
            parsed_payload.qualifications
            + ([parsed_payload.education] if parsed_payload.education else [])
            + ([parsed_payload.work_experience] if parsed_payload.work_experience else [])
            + parsed_payload.technical_skills
            + parsed_payload.competencies
        )
    if not extraction.summary_en or is_raw_metadata_summary(extraction.summary_en):
        extraction.summary_en = official_parsed_payload_to_fallback_extraction(parsed_payload).summary_en
        extraction.extraction_method = extraction.extraction_method or "official_job_compact_ai"
    if not extraction.summary_bn or is_raw_metadata_summary(extraction.summary_bn):
        extraction.summary_bn = official_parsed_payload_to_fallback_extraction(parsed_payload).summary_bn
    if not extraction.summary or is_raw_metadata_summary(extraction.summary):
        extraction.summary = extraction.summary_en
    if any(is_raw_metadata_summary(value) for value in (extraction.summary, extraction.summary_bn, extraction.summary_en)):
        fallback = official_parsed_payload_to_fallback_extraction(parsed_payload)
        extraction.summary = fallback.summary
        extraction.summary_en = fallback.summary_en
        extraction.summary_bn = fallback.summary_bn
        if "recovered_bad_summary" not in extraction.evidence_snippets:
            extraction.evidence_snippets.append("recovered_bad_summary")
    field_scores = _score_extraction_fields(extraction)
    extraction.field_confidences = {key: round(value, 3) for key, value in field_scores.items()}
    extraction.extraction_confidence = max(float(parsed_payload.parser_confidence), _rollup_confidence(extraction, field_scores))
    extraction.extraction_method = extraction.extraction_method or ("official_parsed_fallback" if use_fallback_summary else "official_job_compact_ai")
    return _ensure_job_fields(extraction)


def _build_evidence_snippets(parsed_payload: OfficialJobParsedPayload) -> list[str]:
    snippets: list[str] = []
    for evidence in parsed_payload.field_sources.values():
        for item in evidence:
            if item.evidence_line and item.evidence_line not in snippets:
                snippets.append(item.evidence_line)
            if len(snippets) >= 3:
                return snippets
    return snippets


def _derive_degree_level(text: str | None) -> str | None:
    lowered = (text or "").lower()
    for level in ("phd", "master", "bachelor", "diploma", "high school", "secondary"):
        if level in lowered:
            return level
    return None


def _first_list_item(values: list[str]) -> str | None:
    for value in values:
        if value and value.strip():
            return value.strip()
    return None


def _first_matching_item(values: list[str], terms: tuple[str, ...]) -> str | None:
    for value in values:
        lowered = value.lower()
        if any(term in lowered for term in terms):
            return value
    return None


def _unique_items(values: list[str]) -> list[str]:
    items: list[str] = []
    for value in values:
        cleaned = str(value or "").strip()
        if cleaned and cleaned not in items:
            items.append(cleaned)
    return items


def _join_non_empty(values: list[str], *, separator: str = ", ") -> str | None:
    cleaned = [value.strip() for value in values if value and value.strip()]
    return separator.join(cleaned) if cleaned else None


def _invoke_mistral(model: str, api_key: str, prompt: str) -> ExtractionEnvelope:
    from app.services.mistral_client import mistral_chat_json
    return mistral_chat_json(
        api_key,
        model,
        [
            {"role": "system", "content": "Return only valid JSON that matches the requested schema."},
            {"role": "user", "content": prompt},
        ],
        ExtractionEnvelope,
    )


def _invoke_mistral_jobs(model: str, api_key: str, prompt: str) -> PageJobsExtraction:
    from app.services.mistral_client import mistral_chat_json
    return mistral_chat_json(
        api_key,
        model,
        [
            {"role": "system", "content": "Return only valid JSON matching the requested jobs schema."},
            {"role": "user", "content": prompt},
        ],
        PageJobsExtraction,
    )


def _invoke_mistral_job(model: str, api_key: str, prompt: str) -> JobOpportunityExtraction:
    from app.services.mistral_client import mistral_chat_json
    return mistral_chat_json(
        api_key,
        model,
        [
            {"role": "system", "content": "Return only valid JSON matching the requested job schema."},
            {"role": "user", "content": prompt},
        ],
        JobOpportunityExtraction,
    )


def extract_structured(db: Session, cleaned: dict[str, Any]) -> ExtractionBase:
    """Two-pass structured extraction with self-correction.

    1. Single-shot LLM call (existing prompt) → parsed extraction.
    2. Field-level validation in Python → per-field confidence scores.
    3. If required fields are missing/low-confidence AND we have body text, send a
       *targeted* re-prompt asking only for those fields, and merge the results.
    4. Final extraction_confidence is the mean of field confidences (capped by
       the original LLM-reported confidence so we don't inflate weak extractions).
    5. The per-field map is saved to extracted_json["field_confidences"] so the
       review UI can colour-code each field.

    Falls through to the regex fallback whenever no AI key is configured or the
    LLM call raises — same safety net as before.
    """
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db)
    if not api_key:
        fallback = _fallback_extract(cleaned)
        fallback.fallback_reason = "no_ai_api_key"
        return _ensure_fields(fallback)

    body_text = (cleaned.get("body_text") or "")[:6000]
    prompt = _PROMPT_TEMPLATE.format(title=cleaned.get("title") or "", body=body_text)
    try:
        result = _invoke_for_extraction(db, provider, api_key, prompt)
        extraction = _ensure_fields(result.data)
        extraction.extraction_method = "llm_structured"
    except Exception as exc:
        fallback = _fallback_extract(cleaned)
        fallback.fallback_reason = f"llm_error:{type(exc).__name__}"
        return _ensure_fields(fallback)

    if extraction.record_type == "unknown":
        # Don't bother self-correcting unknowns; the classifier said no.
        field_scores = _score_extraction_fields(extraction)
        extraction.extraction_confidence = _rollup_confidence(extraction, field_scores)
        _annotate_field_confidence(extraction, field_scores)
        return extraction

    field_scores = _score_extraction_fields(extraction)
    weak_fields = _select_weak_required_fields(extraction, field_scores)
    self_corrected = False

    if weak_fields and body_text.strip():
        try:
            patch = _self_correct(db, provider, api_key, body_text, extraction, weak_fields)
            if patch:
                _apply_self_correction(extraction, patch, weak_fields)
                # Re-score after the patch.
                field_scores = _score_extraction_fields(extraction)
                self_corrected = True
        except Exception:
            # Self-correction is best-effort; original extraction stands.
            pass

    if self_corrected:
        extraction.extraction_method = "llm_structured_self_corrected"
    extraction.extraction_confidence = _rollup_confidence(extraction, field_scores)

    _annotate_field_confidence(extraction, field_scores)
    return extraction


def extract_official_job_structured(db: Session, cleaned: dict[str, Any]) -> ExtractionBase:
    """Rich full-detail extraction for strict official job sources."""
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db)
    if not api_key:
        fallback = extract_official_job_fallback(cleaned, {})
        fallback.fallback_reason = "no_ai_api_key"
        return _ensure_fields(fallback)

    body_text = (cleaned.get("body_text") or "")[:14000]
    prompt = _OFFICIAL_JOB_PROMPT_TEMPLATE.format(title=cleaned.get("title") or "", body=body_text)
    try:
        result = _invoke_for_official_extraction(db, provider, api_key, prompt)
        extraction = _ensure_fields(result)
        extraction.extraction_method = "llm_official_rich"
    except Exception as exc:
        fallback = extract_official_job_fallback(cleaned, {})
        fallback.fallback_reason = f"official_llm_error:{type(exc).__name__}"
        return _ensure_fields(fallback)

    field_scores = _score_extraction_fields(extraction)
    if extraction.record_type == "job":
        rich_score = max(
            field_scores.get("responsibilities", 0.0),
            field_scores.get("key_accountabilities", 0.0),
            field_scores.get("role_accountabilities", 0.0),
            field_scores.get("qualifications", 0.0),
            field_scores.get("source_sections", 0.0),
        )
        if rich_score > 0:
            field_scores["official_rich_details"] = rich_score
    extraction.extraction_confidence = _rollup_confidence(extraction, field_scores)
    _annotate_field_confidence(extraction, field_scores)
    return extraction


def _invoke_for_extraction(db: Session, provider: str, api_key: str, prompt: str) -> ExtractionEnvelope:
    if provider == "mistral":
        return _invoke_mistral(get_ai_model(db), api_key, prompt)
    model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
    structured = model.with_structured_output(ExtractionEnvelope)
    return structured.invoke(prompt)  # type: ignore[return-value]


def _invoke_for_official_extraction(db: Session, provider: str, api_key: str, prompt: str) -> JobOpportunityExtraction:
    """Invoke LLM for official job extraction, expecting JobOpportunityExtraction directly (no envelope wrapper)."""
    if provider == "mistral":
        return _invoke_mistral_job(get_ai_model(db), api_key, prompt)
    model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
    structured = model.with_structured_output(JobOpportunityExtraction)
    return structured.invoke(prompt)  # type: ignore[return-value]


# ── Field-level scoring ────────────────────────────────────────────────────────

# Required fields per record type. Used to decide what counts as a "weak"
# extraction worth re-prompting for.
_REQUIRED_FIELDS_BY_TYPE: dict[str, tuple[str, ...]] = {
    "job": ("title", "country", "employer", "application_url"),
    "scholarship": ("title", "country", "deadline_text", "application_url"),
    "policy_update": ("title", "summary"),
    "unknown": (),
}


def _score_extraction_fields(extraction: ExtractionBase) -> dict[str, float]:
    """Per-field confidence in [0, 1]. 1.0 = present and well-formed,
    0.0 = absent. Used both to compute the rolled-up extraction_confidence and
    to surface a colour-coded view in the review UI."""
    import re as _re
    from datetime import date as _date

    scores: dict[str, float] = {}

    def text_score(value: str | None, *, min_len: int = 3) -> float:
        if not value or not str(value).strip():
            return 0.0
        clean = str(value).strip()
        if len(clean) < min_len:
            return 0.4
        return 1.0

    def list_score(value: list | None) -> float:
        if not value:
            return 0.0
        usable = [v for v in value if v and str(v).strip()]
        if not usable:
            return 0.0
        return min(1.0, 0.5 + 0.1 * len(usable))

    scores["title"] = text_score(extraction.title, min_len=4)
    scores["title_bn"] = text_score(extraction.title_bn, min_len=2)
    scores["summary"] = text_score(extraction.summary, min_len=20)
    scores["summary_bn"] = text_score(extraction.summary_bn, min_len=10)
    scores["summary_en"] = text_score(extraction.summary_en, min_len=10)
    scores["country"] = text_score(extraction.country, min_len=2)
    scores["employer"] = text_score(extraction.employer or extraction.organization, min_len=2)
    scores["sector"] = text_score(extraction.sector, min_len=2)

    # Deadline must be future and parseable as a date.
    deadline_score = 0.0
    if extraction.deadline_text:
        match = _re.match(r"(\d{4})-(\d{2})-(\d{2})", extraction.deadline_text.strip())
        if match:
            try:
                d = _date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                deadline_score = 1.0 if d >= _date.today() else 0.4
            except ValueError:
                deadline_score = 0.3
        else:
            deadline_score = 0.3
    scores["deadline_text"] = deadline_score

    # Salary: all-or-nothing for the trio.
    has_salary_value = extraction.salary_min is not None or extraction.salary_max is not None
    has_currency = bool(extraction.salary_currency)
    if has_salary_value and has_currency:
        scores["salary"] = 1.0
    elif has_salary_value or has_currency:
        scores["salary"] = 0.5
    else:
        scores["salary"] = 0.0

    # Application URL: must be http(s) and look like a URL.
    url_score = 0.0
    if extraction.application_url:
        u = extraction.application_url.strip()
        if u.startswith("http://") or u.startswith("https://"):
            url_score = 1.0 if "." in u else 0.4
    scores["application_url"] = url_score

    scores["eligibility_text"] = text_score(extraction.eligibility_text, min_len=15)
    scores["requirements"] = list_score(extraction.requirements)
    scores["benefits"] = list_score(extraction.benefits)
    scores["job_purpose"] = text_score(extraction.job_purpose, min_len=20)
    scores["responsibilities"] = list_score(extraction.responsibilities)
    scores["key_accountabilities"] = list_score(extraction.key_accountabilities)
    scores["role_accountabilities"] = list_score(extraction.role_accountabilities)
    scores["qualifications"] = list_score(extraction.qualifications)
    scores["skills"] = list_score(extraction.skills)
    scores["work_conditions"] = list_score(extraction.work_conditions)
    section_items: list[str] = []
    for section in extraction.source_sections:
        if isinstance(section, dict):
            section_items.extend(str(item) for item in (section.get("items") or []))
    scores["source_sections"] = list_score(section_items)
    scores["journey_steps"] = list_score(extraction.journey_steps)
    scores["documents_needed"] = list_score(extraction.documents_needed)

    return scores


def _rollup_confidence(extraction: ExtractionBase, scores: dict[str, float]) -> float:
    if not scores:
        return round(float(extraction.extraction_confidence or 0.0), 3)

    original = float(extraction.extraction_confidence or 0.0)
    if extraction.record_type == "unknown":
        return round(original or (sum(scores.values()) / len(scores)), 3)

    if extraction.record_type == "job":
        core_fields = ("title", "country", "employer", "application_url")
        support_fields = (
            "summary",
            "summary_bn",
            "summary_en",
            "requirements",
            "eligibility_text",
            "job_purpose",
            "responsibilities",
            "key_accountabilities",
            "role_accountabilities",
            "qualifications",
            "skills",
            "source_sections",
            "deadline_text",
            "salary",
            "journey_steps",
            "documents_needed",
        )
        core_values = [scores.get(name, 0.0) for name in core_fields]
        support_values = [scores.get(name, 0.0) for name in support_fields]
        core_average = sum(core_values) / len(core_values) if core_values else 0.0
        present_support = [value for value in support_values if value > 0]
        support_average = (
            sum(present_support) / len(present_support)
            if present_support
            else (sum(support_values) / len(support_values) if support_values else 0.0)
        )
        rolled = (core_average * 0.7) + (support_average * 0.3)
    else:
        rolled = sum(scores.values()) / len(scores)

    if extraction.record_type != "unknown" and scores.get("application_url", 0.0) <= 0:
        rolled = min(rolled, 0.49)

    if extraction.extraction_method == "fallback_extract":
        return round(min(rolled, original or 0.45), 3)
    blended = (rolled * 0.75) + (max(original, 0.0) * 0.25)
    return round(min(1.0, blended), 3)


def _select_weak_required_fields(extraction: ExtractionBase, scores: dict[str, float]) -> list[str]:
    """Required fields whose score is < 0.5. These get a targeted re-prompt."""
    required = _REQUIRED_FIELDS_BY_TYPE.get(extraction.record_type, ())
    return [name for name in required if scores.get(name, 0.0) < 0.5]


def _self_correct(
    db: Session,
    provider: str,
    api_key: str,
    body_text: str,
    extraction: ExtractionBase,
    weak_fields: list[str],
) -> dict[str, Any]:
    """Re-prompt the LLM asking only for the weak fields. Returns a partial dict."""
    import json as _json

    field_descriptions = "\n".join(f"- {name}" for name in weak_fields)
    known = {
        "title": extraction.title,
        "country": extraction.country,
        "employer": extraction.employer or extraction.organization,
        "record_type": extraction.record_type,
    }
    prompt = (
        "You previously extracted an opportunity from a web page but the following "
        "required fields are missing or look wrong. Re-read the page text and "
        "return ONLY a JSON object whose keys are these fields:\n\n"
        f"{field_descriptions}\n\n"
        "Use the same schema as before (deadline_text in YYYY-MM-DD, application_url "
        "must start with http, etc.). If a field truly isn't on the page, set it to "
        "null — do NOT invent values.\n\n"
        f"Already-known context (do not change these): {_json.dumps(known, ensure_ascii=False)}\n\n"
        f"Page text:\n{body_text}\n\n"
        "Respond ONLY with a JSON object containing just the requested fields."
    )

    if provider == "mistral":
        from app.services.mistral_client import mistral_chat_text
        content = mistral_chat_text(api_key, get_ai_model(db), prompt, temperature=0.0)
        return _json.loads(_strip_code_fences(content))

    model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
    raw = str(model.invoke(prompt).content)
    return _json.loads(_strip_code_fences(raw))


def _apply_self_correction(extraction: ExtractionBase, patch: dict[str, Any], allowed: list[str]) -> None:
    """Apply only the allowed keys from `patch`. Skip None and empty values
    (they don't help — keep whatever we had)."""
    for key in allowed:
        if key not in patch:
            continue
        value = patch[key]
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        if hasattr(extraction, key):
            setattr(extraction, key, value)


def _annotate_field_confidence(extraction: ExtractionBase, scores: dict[str, float]) -> None:
    """Set the per-field confidence map. The pipeline persists this as part of
    extracted_json so the review UI can colour-code fields."""
    extraction.field_confidences = {k: round(v, 3) for k, v in scores.items()}


def extract_jobs_structured(db: Session, cleaned: dict[str, Any], *, max_jobs: int = 10) -> list[JobOpportunityExtraction]:
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db)
    if not api_key:
        fallback = extract_structured(db, cleaned)
        if fallback.record_type != "job":
            return []
        return _ensure_job_list([JobOpportunityExtraction.model_validate(fallback.model_dump())], max_jobs=max_jobs)

    prompt = _PAGE_JOBS_PROMPT_TEMPLATE.format(
        title=cleaned.get("title") or "",
        body=(cleaned.get("body_text") or "")[:8000],
    )
    try:
        if provider == "mistral":
            result = _invoke_mistral_jobs(get_ai_model(db), api_key, prompt)
            return _ensure_job_list(result.jobs, max_jobs=max_jobs)

        model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
        structured = model.with_structured_output(PageJobsExtraction)
        result: PageJobsExtraction = structured.invoke(prompt)
        return _ensure_job_list(result.jobs, max_jobs=max_jobs)
    except Exception:
        fallback = extract_structured(db, cleaned)
        if fallback.record_type != "job":
            return []
        return _ensure_job_list([JobOpportunityExtraction.model_validate(fallback.model_dump())], max_jobs=max_jobs)


def summarize_linkout_job(
    db: Session,
    *,
    title: str,
    snippet: str | None,
    url: str,
) -> JobOpportunityExtraction:
    provider = get_ai_provider(db)
    api_key = get_ai_api_key(db)
    if not api_key:
        summary_en = (snippet or title or "").strip()
        summary_bn = "মূল সাইটে বিস্তারিত দেখুন।" if summary_en else "মূল সাইটে বিস্তারিত দেখুন।"
        return _ensure_job_fields(
            JobOpportunityExtraction(
                title=title,
                title_bn=title,
                summary=summary_en or title,
                summary_en=summary_en or title,
                summary_bn=summary_bn,
                application_url=url,
                can_apply_from_bd=None,
                journey_steps=["মূল সাইট খুলুন", "আবেদনের শর্ত দেখুন", "প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন"],
                documents_needed=["পাসপোর্ট", "জাতীয় পরিচয়পত্র"],
                extraction_confidence=0.3,
                evidence_snippets=[title, snippet or ""],
            )
        )

    prompt = _LINKOUT_JOB_PROMPT_TEMPLATE.format(title=title, snippet=snippet or "", url=url)
    try:
        if provider == "mistral":
            return _ensure_job_fields(_invoke_mistral_job(get_ai_model(db), api_key, prompt))

        model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.0)
        structured = model.with_structured_output(JobOpportunityExtraction)
        result: JobOpportunityExtraction = structured.invoke(prompt)
        return _ensure_job_fields(result)
    except Exception:
        return _ensure_job_fields(
            JobOpportunityExtraction(
                title=title,
                title_bn=title,
                summary=(snippet or title or "").strip() or title,
                summary_en=(snippet or title or "").strip() or title,
                summary_bn="বিস্তারিত তথ্য মূল সাইটে দেওয়া আছে।",
                application_url=url,
                can_apply_from_bd=None,
                journey_steps=["মূল সাইট খুলুন", "যোগ্যতা যাচাই করুন", "আবেদনের কাগজপত্র প্রস্তুত করুন"],
                documents_needed=["পাসপোর্ট", "সিভি"],
                extraction_confidence=0.3,
                evidence_snippets=[title, snippet or ""],
            )
        )
