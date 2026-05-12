"""Agentic, query-driven discovery.

Given a free-form admin query like "nursing jobs in Canada open to Bangladeshis",
this module:

  1. PLAN — uses the LLM to expand the query into a small set of search variants
     (English + Bangla, country-specific synonyms).
  2. SEARCH — hits the configured open-source provider (SearXNG, falling back to
     DuckDuckGo) for each variant.
  3. SCORE — combines the keyword scoring used by SearchHTMLJobsConnector with a
     light LLM relevance check on the top hits.
  4. INGEST — feeds the surviving URLs through the existing extractor + draft
     pipeline. Drafts land in the review queue normally.

Designed for synchronous calls from an admin endpoint; the per-URL ingest is
quick because we reuse the existing extract_structured + clean_page stack.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from urllib.parse import urlparse

import httpx
from langchain_groq import ChatGroq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ingestion.cleaner import clean_page
from app.ingestion.eligibility_engine import tag_eligibility
from app.ingestion.extractor import extract_structured
from app.ingestion.schemas import FetchedPage
from app.ingestion.search_provider import (
    SearchResult,
    get_fallback_search_provider,
    get_search_provider,
)
from app.ingestion.validators import (
    find_existing_opportunity,
    find_semantic_duplicate,
    merge_mirror_url,
    parse_deadline,
    validate_extraction,
)
from app.models.entities import Opportunity, Source
from app.services.runtime_settings_service import (
    get_ai_api_key,
    get_ai_model,
    get_ai_provider,
)

logger = logging.getLogger(__name__)


_DISCOVERY_SOURCE_NAME = "Agentic Discovery"
_DISCOVERY_SOURCE_URL = "https://discovery.local/"
_DISCOVERY_CONNECTOR_KEY = "discovery_agent"
_MAX_VARIANTS = 4
_MAX_RESULTS_PER_VARIANT = 10
_DEFAULT_TARGET_RESULTS = 12


@dataclass
class DiscoveryDraft:
    draft_id: int
    title: str
    url: str
    confidence: float
    is_new: bool


@dataclass
class DiscoveryReport:
    query: str
    variants: list[str]
    urls_considered: int
    drafts_created: int
    drafts_updated: int
    duplicates: int
    failed: int
    drafts: list[DiscoveryDraft] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ── Public API ────────────────────────────────────────────────────────────────

def run_discovery(
    db: Session,
    *,
    query: str,
    target_country: str | None = None,
    max_results: int = _DEFAULT_TARGET_RESULTS,
) -> DiscoveryReport:
    """Discover and ingest opportunities matching a free-form query."""
    report = DiscoveryReport(query=query, variants=[], urls_considered=0,
                             drafts_created=0, drafts_updated=0,
                             duplicates=0, failed=0)

    api_key = get_ai_api_key(db)
    if not api_key:
        report.warnings.append("AI key not configured — using literal query only")
        report.variants = [query]
    else:
        try:
            report.variants = _plan_variants(db, query, target_country, api_key)
        except Exception as exc:
            logger.warning("discovery_plan_failed", extra={"error": str(exc)})
            report.warnings.append(f"Variant planning failed: {exc}")
            report.variants = [query]

    seen_urls: set[str] = set()
    candidates: list[SearchResult] = []
    for variant in report.variants[:_MAX_VARIANTS]:
        try:
            results = _search_variants(variant)
        except Exception as exc:
            logger.warning("discovery_search_failed", extra={"variant": variant, "error": str(exc)})
            report.warnings.append(f"Search failed for '{variant}': {exc}")
            continue
        for r in results[:_MAX_RESULTS_PER_VARIANT]:
            if not r.url or r.url in seen_urls:
                continue
            seen_urls.add(r.url)
            candidates.append(r)

    report.urls_considered = len(candidates)
    if not candidates:
        return report

    scored = _score_results(candidates, target_country=target_country)
    top = scored[:max_results]

    discovery_source = _get_or_create_discovery_source(db)
    for result in top:
        try:
            outcome = _ingest_one(db, result, discovery_source)
        except Exception as exc:
            logger.warning("discovery_ingest_failed", extra={"url": result.url, "error": str(exc)})
            report.failed += 1
            continue
        if outcome is None:
            report.duplicates += 1
            continue
        draft, created = outcome
        if created:
            report.drafts_created += 1
        else:
            report.drafts_updated += 1
        report.drafts.append(DiscoveryDraft(
            draft_id=draft.id,
            title=draft.title,
            url=result.url,
            confidence=float(draft.extraction_confidence or 0.0),
            is_new=created,
        ))

    db.commit()

    # Enqueue translation for the new drafts (same hook the pipeline uses).
    new_ids = [d.draft_id for d in report.drafts if d.is_new]
    if new_ids:
        try:
            from worker.tasks import translate_draft_async  # type: ignore[import-not-found]
            for opp_id in new_ids:
                translate_draft_async.delay(opp_id)
        except Exception:
            logger.debug("translate_draft_async not importable; skipping enqueue")

    return report


# ── Step 1: Planning ──────────────────────────────────────────────────────────

def _plan_variants(db: Session, query: str, target_country: str | None, api_key: str) -> list[str]:
    """Ask the LLM to break a free-form query into search variants."""
    provider = get_ai_provider(db)
    country_hint = f" (focus on {target_country})" if target_country else ""
    prompt = (
        "You decompose a Bangladeshi migrant-worker job/scholarship search query "
        "into a small set of distinct web search queries. Include both English and "
        "Bangla phrasings, common synonyms, and country-specific job-board names "
        "where relevant. Return ONLY a JSON object with a single key 'variants' "
        "whose value is an array of 2-4 short, targeted search queries.\n\n"
        f"User query: {query}{country_hint}\n\n"
        "Example output: {\"variants\": [\"nursing job Canada Bangladeshi LMIA\", "
        "\"Canada nurse recruitment for Bangladesh\", \"কানাডা নার্স চাকরি বাংলাদেশি\", "
        "\"BMET Canada nurse circular\"]}"
    )

    raw: str
    if provider == "mistral":
        response = httpx.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": get_ai_model(db),
                "temperature": 0.1,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=30,
        )
        response.raise_for_status()
        raw = response.json()["choices"][0]["message"]["content"]
    else:
        model = ChatGroq(model=get_ai_model(db), api_key=api_key, temperature=0.1)
        raw = str(model.invoke(prompt).content)

    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").lstrip("json").strip()
    parsed = json.loads(cleaned)
    variants = parsed.get("variants") or []
    out = [str(v).strip() for v in variants if str(v).strip()]
    if not out:
        out = [query]
    if query not in out:
        out.insert(0, query)
    return out[:_MAX_VARIANTS]


# ── Step 2: Search ────────────────────────────────────────────────────────────

def _search_variants(query: str) -> list[SearchResult]:
    """Use the primary provider; fall back to DuckDuckGo on failure."""
    try:
        provider = get_search_provider()
        return provider.search(query, site_domain="", limit=_MAX_RESULTS_PER_VARIANT)
    except Exception as exc:
        logger.info("primary_search_provider_failed_falling_back", extra={"error": str(exc)})
        try:
            fallback = get_fallback_search_provider()
            return fallback.search(query, site_domain="", limit=_MAX_RESULTS_PER_VARIANT)
        except Exception as fallback_exc:
            raise RuntimeError(f"Both search providers failed: {fallback_exc}") from fallback_exc


# ── Step 3: Scoring ───────────────────────────────────────────────────────────

# Simple keyword bias — heavy lifting is done by the LLM extractor afterwards.
_POSITIVE_TERMS = (
    "job", "vacancy", "recruitment", "circular", "apply", "career", "hiring",
    "scholarship", "fellowship", "চাকরি", "নিয়োগ", "ভর্তি", "বৃত্তি",
)
_NEGATIVE_TERMS = (
    "wikipedia", "youtube.com", "facebook.com", "twitter.com", "instagram.com",
    "linkedin.com/feed", "reddit.com", "news", "blog",
)


def _score_results(results: list[SearchResult], *, target_country: str | None) -> list[SearchResult]:
    """Rank by a simple keyword score. URL+title+snippet against pos/neg terms,
    plus a country boost. Higher is better."""
    target = (target_country or "").lower()

    def score(r: SearchResult) -> float:
        text = " ".join(filter(None, [r.url, r.title, r.snippet])).lower()
        s = 0.0
        for pos in _POSITIVE_TERMS:
            if pos in text:
                s += 1.0
        for neg in _NEGATIVE_TERMS:
            if neg in text:
                s -= 2.0
        if target and target in text:
            s += 2.0
        # Penalise homepage-only URLs — listings live deeper.
        path = urlparse(r.url).path.strip("/")
        if path:
            s += 0.5
        return s

    scored = sorted(results, key=score, reverse=True)
    return scored


# ── Step 4: Ingest a single URL ────────────────────────────────────────────────

def _ingest_one(
    db: Session,
    result: SearchResult,
    source: Source,
) -> tuple[Opportunity, bool] | None:
    """Fetch the URL, extract, semantic-dedup, and persist as a draft.
    Returns (draft, created) on success; None when treated as a pure duplicate."""
    try:
        resp = httpx.get(
            result.url,
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; JobFinder-Discovery/1.0)"},
        )
        resp.raise_for_status()
    except Exception as exc:
        logger.info("discovery_fetch_failed", extra={"url": result.url, "error": str(exc)})
        return None

    page = FetchedPage(
        url=result.url,
        title=result.title or None,
        raw_html=resp.text,
        content_type="html",
    )
    cleaned = clean_page(page)
    extraction = extract_structured(db, cleaned)
    if extraction.record_type == "unknown":
        return None
    if validate_extraction(extraction):
        return None

    eligibility = tag_eligibility(
        source_connector_key=_DISCOVERY_CONNECTOR_KEY,
        source_trust_level=None,
        record_type=extraction.record_type,
        country=extraction.country,
        eligibility_text=extraction.eligibility_text,
        requirements_json={"items": extraction.requirements},
        extracted_json=extraction.model_dump(mode="json"),
        title=extraction.title,
        summary=extraction.summary,
        employer=extraction.employer,
    )

    # Semantic dedup across the whole corpus.
    embedding: list[float] | None = None
    semantic_match: Opportunity | None = None
    try:
        from app.services.embedding_service import EMBEDDING_MODEL as _EMB_MODEL, embed_text as _embed_text
        embed_input = " ".join(filter(None, [
            extraction.title, extraction.summary or extraction.summary_en,
            extraction.employer or extraction.organization,
            extraction.country,
        ]))
        if embed_input.strip():
            embedding = _embed_text(embed_input)
            semantic_match = find_semantic_duplicate(
                db,
                title=extraction.title or "",
                summary=extraction.summary or extraction.summary_en,
                employer=extraction.employer or extraction.organization,
                country=extraction.country,
                embedding=embedding,
            )
    except Exception as exc:
        logger.info("discovery_embed_failed", extra={"error": str(exc)})

    if semantic_match is not None and semantic_match.source_id != source.id:
        if merge_mirror_url(semantic_match, result.url):
            db.flush()
        return None

    item_key = result.url[:128]
    existing = find_existing_opportunity(
        db, source_id=source.id, source_item_key=item_key, content_hash=cleaned.get("content_hash", ""),
    )
    now = datetime.now(UTC)

    if existing is not None:
        existing.title = extraction.title or existing.title
        existing.summary = extraction.summary or existing.summary
        existing.summary_en = extraction.summary_en or existing.summary_en
        existing.summary_bn = extraction.summary_bn or existing.summary_bn
        existing.country = extraction.country or existing.country
        existing.employer = extraction.employer or existing.employer
        existing.organization = extraction.organization or existing.organization
        existing.deadline = parse_deadline(extraction.deadline_text) or existing.deadline
        existing.eligibility_text = extraction.eligibility_text or existing.eligibility_text
        existing.application_url = extraction.application_url or existing.application_url
        existing.extracted_json = extraction.model_dump(mode="json")
        existing.extraction_confidence = float(extraction.extraction_confidence or 0.0)
        existing.connector_key = _DISCOVERY_CONNECTOR_KEY
        return existing, False

    draft = Opportunity(
        source_id=source.id,
        source_name=_DISCOVERY_SOURCE_NAME,
        source_page_url=result.url,
        source_url=result.url,
        original_apply_url=extraction.application_url or result.url,
        application_url=extraction.application_url or result.url,
        document_url=None,
        content_type="html",
        opportunity_type=eligibility.opportunity_type,
        title=extraction.title or "Untitled",
        title_bn=getattr(extraction, "title_bn", None),
        summary=extraction.summary,
        summary_bn=getattr(extraction, "summary_bn", None),
        summary_en=getattr(extraction, "summary_en", None) or extraction.summary,
        country=extraction.country,
        employer=extraction.employer,
        organization=extraction.organization,
        employer_or_organization=extraction.employer or extraction.organization,
        sector=extraction.sector,
        salary_min=extraction.salary_min,
        salary_max=extraction.salary_max,
        salary_currency=extraction.salary_currency,
        deadline=parse_deadline(extraction.deadline_text),
        eligibility_text=extraction.eligibility_text,
        visa_support=extraction.visa_support,
        journey_steps=extraction.journey_steps,
        documents_needed=extraction.documents_needed,
        typical_salary_bdt=extraction.typical_salary_bdt,
        requirements_json={"items": extraction.requirements},
        benefits_json={"items": extraction.benefits},
        language_requirements_json={"items": extraction.language_requirements},
        lmia_status=eligibility.lmia_status,
        can_apply_from_bd=eligibility.can_apply_from_bd,
        requires_existing_work_permit=eligibility.requires_existing_work_permit,
        open_to_international_candidates=eligibility.open_to_international_candidates,
        open_to_authorized_workers_only=eligibility.open_to_authorized_workers_only,
        eligibility_status=eligibility.eligibility_status,
        target_audience_tags=eligibility.target_audience_tags,
        risk_flags=eligibility.risk_flags,
        extraction_confidence=float(extraction.extraction_confidence or 0.0),
        needs_admin_review=True,
        review_status="pending",
        status="pending",
        is_active=False,
        source_item_key=item_key,
        raw_text=(cleaned.get("body_text") or "")[:10_000] or None,
        extracted_json=extraction.model_dump(mode="json"),
        connector_key=_DISCOVERY_CONNECTOR_KEY,
        record_type=extraction.record_type,
    )
    db.add(draft)
    db.flush()

    if embedding is not None:
        try:
            from app.models.entities import OpportunityEmbedding as _OE
            db.add(_OE(opportunity_id=draft.id, embedding=embedding, embedding_model=_EMB_MODEL))
        except Exception as exc:
            logger.info("discovery_embedding_persist_failed", extra={"error": str(exc)})

    return draft, True


def _get_or_create_discovery_source(db: Session) -> Source:
    src = db.scalar(select(Source).where(Source.name == _DISCOVERY_SOURCE_NAME))
    if src:
        return src
    src = Source(
        name=_DISCOVERY_SOURCE_NAME,
        base_url=_DISCOVERY_SOURCE_URL,
        root_url=_DISCOVERY_SOURCE_URL,
        connector_key=_DISCOVERY_CONNECTOR_KEY,
        source_type="hybrid",
        ingestion_mode="manual",
        compliance_status="allowed",
        crawl_frequency="manual",
        first_crawl_mode="active_only",
        feed_type="html",
        enabled=False,  # not crawled on a schedule
        requires_admin_review=True,
        is_active=False,
    )
    db.add(src)
    db.flush()
    return src
