import json
from typing import Any

import httpx
from langchain_groq import ChatGroq
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ingestion.schemas import (
    ExtractionBase,
    JobOpportunityExtraction,
    PageJobsExtraction,
    PolicyUpdateExtraction,
    ScholarshipExtraction,
    UnknownExtraction,
)
from app.services.runtime_settings_service import get_ai_api_key, get_ai_model, get_ai_provider


class ExtractionEnvelope(BaseModel):
    data: JobOpportunityExtraction | ScholarshipExtraction | PolicyUpdateExtraction | UnknownExtraction


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
        evidence_snippets=[title, body[:200]],
    )


def _ensure_fields(extraction: ExtractionBase) -> ExtractionBase:
    """Coerce None list fields to [] and strip empty-string sentinels from Groq output."""
    for field in (
        "requirements",
        "benefits",
        "language_requirements",
        "journey_steps",
        "documents_needed",
        "evidence_snippets",
    ):
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


def _invoke_mistral_jobs(model: str, api_key: str, prompt: str) -> PageJobsExtraction:
    response = httpx.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.0,
            "messages": [
                {"role": "system", "content": "Return only valid JSON matching the requested jobs schema."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return PageJobsExtraction.model_validate(json.loads(_strip_code_fences(content)))


def _invoke_mistral_job(model: str, api_key: str, prompt: str) -> JobOpportunityExtraction:
    response = httpx.post(
        "https://api.mistral.ai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.0,
            "messages": [
                {"role": "system", "content": "Return only valid JSON matching the requested job schema."},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=60,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    return JobOpportunityExtraction.model_validate(json.loads(_strip_code_fences(content)))


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
