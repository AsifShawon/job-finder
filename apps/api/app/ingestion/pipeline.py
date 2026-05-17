"""
Ingestion pipeline.

Flow:
  Source -> ComplianceGuard -> CrawlRun created
       -> SourceRouter -> Connector.discover_items()
       -> for each FetchedPage:
           -> PDF extraction (if needed)
           -> parse + clean
           -> raw snapshot versioning
           -> page-level dedup
           -> LLM extraction (single or multi-job)
           -> eligibility_engine
           -> opportunity-level dedup
           -> save/update OpportunityDraft rows (review_status='pending')
  -> CrawlRun finished

CRITICAL: Nothing in this pipeline sets review_status='approved' or creates
a PublishedOpportunity. All items MUST go through admin review first.
"""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from statistics import median

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ingestion.cleaner import clean_page
from app.ingestion.compliance_guard import ComplianceError, check_before_crawl
from app.ingestion.eligibility_engine import tag_eligibility
from app.ingestion.errors import ConnectorNotImplementedError, SourceConfigError
from app.ingestion.extractor import (
    extract_jobs_structured,
    extract_official_job_structured,
    extract_structured,
    summarize_linkout_job,
)
from app.ingestion.job_classification import (
    classify_bangladesh_suitability,
    classify_category,
    is_relevant_for_active_job,
)
from app.ingestion.parsers.registry import get_parser
from app.ingestion.pdf_extractor import download_pdf, extract_text as pdf_extract_text
from app.ingestion.schemas import JobOpportunityExtraction
from app.ingestion.source_router import get_connector
from app.ingestion.validators import (
    find_existing_opportunity,
    find_semantic_duplicate,
    is_latest_snapshot_duplicate,
    merge_mirror_url,
    parse_deadline,
    validate_extraction,
)
from app.models.entities import CrawlJob, CrawlRun, Opportunity, OpportunityEmbedding, RawDocument, Source
from app.models.enums import CrawlRunStatus, CrawlStatus
from app.services.storage_service import ObjectStorage
from app.services.translation_service import enrich_bilingual_record

logger = logging.getLogger(__name__)

_PDF_CONTENT_TYPES = {"pdf", "image_pdf"}
_NEWS_REJECT_PATTERNS = [
    r"\d+-month (low|high)",
    r"\d+-year (low|high)",
    r"(drops?|fell|declined?|decreased?)\s+(by\s+)?\d+\s*%",
    r"(rose|increased?|grew|surged?)\s+(by\s+)?\d+\s*%",
    r"year.on.year (change|growth|decline|drop|increase)",
    r"according to (bbs|data|statistics|a survey|a report)",
    r"remittance (inflow|outflow|earning)",
    r"\d+,\d+ workers? (were )?(sent|deployed|went) abroad",
    r"(highest|lowest) (monthly |)figure since",
    r"(research unit|rmmru) (says?|said|found|report)",
    r"labour market (data|analysis|report|trend)",
]
_OFFICIAL_STRICT_CONFIDENCE_THRESHOLD = 0.65


@dataclass
class PipelineResult:
    pages_fetched: int = 0
    draft_created: int = 0
    draft_updated: int = 0
    duplicates: int = 0
    unchanged: int = 0
    skipped: int = 0
    failed: int = 0
    manual_review: int = 0
    accepted: int = 0
    published: int = 0
    error: str | None = None
    skip_reasons: dict[str, int] = None  # type: ignore[assignment]
    skipped_confidences: list[float] = None  # type: ignore[assignment]
    extraction_method_counts: dict[str, int] = None  # type: ignore[assignment]
    low_confidence_review_count: int = 0
    high_confidence_published_count: int = 0
    # IDs of drafts that should be auto-translated after the pipeline commits.
    pending_translation_ids: list[int] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.skip_reasons is None:
            self.skip_reasons = {}
        if self.skipped_confidences is None:
            self.skipped_confidences = []
        if self.extraction_method_counts is None:
            self.extraction_method_counts = {}
        if self.pending_translation_ids is None:
            self.pending_translation_ids = []

    @property
    def records_extracted(self) -> int:
        return self.draft_created + self.draft_updated


def _build_confidence_summary(values: list[float]) -> dict[str, float | int]:
    cleaned = [round(float(value), 3) for value in values if value is not None]
    if not cleaned:
        return {}
    return {
        "count": len(cleaned),
        "min": min(cleaned),
        "max": max(cleaned),
        "median": round(float(median(cleaned)), 3),
    }


def _has_usable_crawl_outcome(result: PipelineResult) -> bool:
    return any((
        result.draft_created,
        result.draft_updated,
        result.duplicates,
        result.unchanged,
        result.accepted,
        result.published,
    ))


def _build_run_diagnostics(result: PipelineResult) -> dict[str, object]:
    dominant_skip_reason = None
    if result.skip_reasons:
        dominant_skip_reason = max(
            result.skip_reasons.items(),
            key=lambda item: (item[1], item[0]),
        )[0]
    return {
        "accepted_count": result.accepted,
        "published_count": result.published,
        "skipped_count": result.skipped,
        "low_confidence_review_count": result.low_confidence_review_count,
        "high_confidence_published_count": result.high_confidence_published_count,
        "dominant_skip_reason": dominant_skip_reason,
        "confidence_summary": _build_confidence_summary(result.skipped_confidences),
        "extraction_method_counts": dict(sorted(result.extraction_method_counts.items())),
        "skip_reasons": dict(sorted(result.skip_reasons.items())),
    }


def _derive_run_status(source: Source, result: PipelineResult) -> CrawlRunStatus:
    if result.pages_fetched == 0 and result.failed == 0 and result.records_extracted == 0:
        if (source.compliance_status or "").lower() == "linkout_only":
            return CrawlRunStatus.linkout_only_skipped
        return CrawlRunStatus.success_empty
    if result.failed > 0:
        return CrawlRunStatus.partial_success
    if result.skipped > 0 and not _has_usable_crawl_outcome(result):
        return CrawlRunStatus.partial_success
    return CrawlRunStatus.success


def _content_hash(
    title: str | None,
    source_id: int,
    deadline: str | None,
    source_page_url: str | None,
    document_url: str | None,
    original_apply_url: str | None,
) -> str:
    combined = "|".join([
        str(source_id),
        (title or "").lower().strip(),
        deadline or "",
        source_page_url or "",
        document_url or "",
        original_apply_url or "",
    ])
    return hashlib.sha256(combined.encode()).hexdigest()[:64]


def _source_item_key(
    *,
    source_page_url: str,
    title: str | None,
    employer: str | None,
    country: str | None,
    deadline: str | None,
    application_url: str | None,
) -> str:
    combined = "|".join([
        source_page_url,
        (title or "").strip().lower(),
        (employer or "").strip().lower(),
        (country or "").strip().lower(),
        deadline or "",
        application_url or "",
    ])
    return hashlib.sha256(combined.encode()).hexdigest()[:64]


def _trust_badge_for_source(source: Source) -> str | None:
    trust = source.trust_level or ""
    if trust == "government_official":
        return "সরকারি উৎস"
    if trust == "official_partner":
        return "অফিসিয়াল পার্টনার"
    if trust == "verified_source":
        return "যাচাইকৃত উৎস"
    return None


def run_source_ingestion(db: Session, source_id: int, *, force: bool = False) -> PipelineResult:
    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise ValueError(f"Source {source_id} not found")

    if not (source.enabled if source.enabled is not None else source.is_active):
        logger.info("pipeline_source_disabled", extra={"source_id": source_id})
        return PipelineResult(error="Source is disabled")

    running_run = db.scalar(
        select(CrawlRun).where(
            CrawlRun.source_id == source.id,
            CrawlRun.status == CrawlRunStatus.running,
        )
    )
    if running_run:
        return PipelineResult(error=f"CrawlRun #{running_run.id} already running")

    started_at = datetime.now(UTC)
    run = CrawlRun(
        source_id=source.id,
        connector_key=source.connector_key,
        source_type=source.source_type,
        ingestion_mode=source.ingestion_mode,
        crawl_mode=source.first_crawl_mode or "active_only",
        status=CrawlRunStatus.running,
        started_at=started_at,
    )
    db.add(run)
    legacy_job = CrawlJob(
        source_id=source.id,
        status=CrawlStatus.running,
        started_at=started_at,
    )
    db.add(legacy_job)
    source.last_attempted_at = started_at
    db.commit()

    result = PipelineResult()
    logs: list[str] = []
    settings = get_settings()

    try:
        compliance_warning = check_before_crawl(source, force=force)
        if compliance_warning:
            logs.append(compliance_warning)
    except ComplianceError as exc:
        _update_source_error(db, source, str(exc))
        run.status = (
            CrawlRunStatus.skipped_recently if exc.code == "recently_crawled" else CrawlRunStatus.skipped_compliance
        )
        run.finished_at = datetime.now(UTC)
        run.error_message = str(exc)
        run.logs = {"messages": logs + [f"Compliance block: {exc}"]}
        legacy_job.status = CrawlStatus.success
        legacy_job.finished_at = datetime.now(UTC)
        legacy_job.error_message = str(exc)
        db.commit()
        logger.warning("pipeline_compliance_block", extra={"source_id": source_id, "error": str(exc), "code": exc.code})
        return PipelineResult(error=str(exc))

    if settings.crawler_smoke_mode:
        run.status = CrawlRunStatus.success_empty
        run.finished_at = datetime.now(UTC)
        run.discovered_count = 0
        run.logs = {"messages": logs + ["Smoke mode enabled; no discovery executed."]}
        legacy_job.status = CrawlStatus.success
        legacy_job.finished_at = datetime.now(UTC)
        db.commit()
        return result

    try:
        storage = ObjectStorage()
        parser = get_parser(source.parser_key)
        try:
            connector = get_connector(source)
        except (SourceConfigError, ConnectorNotImplementedError) as exc:
            _update_source_error(db, source, str(exc))
            run.status = CrawlRunStatus.failed_config
            run.finished_at = datetime.now(UTC)
            run.error_message = str(exc)
            run.logs = {"messages": logs + [f"Config error: {exc}"]}
            legacy_job.status = CrawlStatus.failed
            legacy_job.finished_at = datetime.now(UTC)
            legacy_job.error_message = str(exc)
            db.commit()
            return PipelineResult(error=str(exc))

        trust_badge = _trust_badge_for_source(source)
        pages = connector.discover_items(source, crawl_mode=run.crawl_mode)
        diagnostics = connector.get_last_discovery_diagnostics()
        result.pages_fetched = len(pages)
        logs.append(f"Discovered {len(pages)} pages")
        if diagnostics:
            logs.append(f"Discovery diagnostics: {diagnostics}")

        for page in pages:
            try:
                _process_page(
                    db=db,
                    page=page,
                    source=source,
                    crawl_run=run,
                    storage=storage,
                    parser=parser,
                    trust_badge=trust_badge,
                    result=result,
                    logs=logs,
                )
            except Exception as exc:
                result.failed += 1
                logs.append(f"Failed page {page.url}: {exc}")
                logger.warning("pipeline_page_error", extra={"source_id": source_id, "url": page.url, "error": str(exc)})

        diagnostics = _build_run_diagnostics(result)
        if result.accepted or result.published or result.skip_reasons:
            logs.append(
                "Acceptance diagnostics: "
                f"accepted={result.accepted}, published={result.published}, skip_reasons={result.skip_reasons}"
            )

        run.status = _derive_run_status(source, result)
        run.finished_at = datetime.now(UTC)
        run.discovered_count = result.pages_fetched
        run.draft_created_count = result.draft_created
        run.draft_updated_count = result.draft_updated
        run.duplicate_count = result.duplicates
        run.unchanged_count = result.unchanged
        run.skipped_count = result.skipped
        run.failed_count = result.failed
        run.manual_review_count = result.manual_review
        run.logs = {"messages": logs, "diagnostics": diagnostics}

        legacy_job.status = CrawlStatus.success
        legacy_job.finished_at = datetime.now(UTC)
        legacy_job.pages_fetched = result.pages_fetched
        legacy_job.records_extracted = result.records_extracted

        if run.status in (CrawlRunStatus.success, CrawlRunStatus.partial_success, CrawlRunStatus.success_empty):
            source.last_crawled_at = datetime.now(UTC)
            source.last_success_at = datetime.now(UTC)
            source.last_error = None
            source.last_status = run.status.value if hasattr(run.status, "value") else str(run.status)
            source.discovered_item_count = run.discovered_count
            source.imported_job_count = run.draft_created_count + run.draft_updated_count
            source.skipped_item_count = run.skipped_count
            source.needs_review_count = run.manual_review_count

        _reconcile_missing_source_jobs(db, source=source, started_at=started_at, logs=logs)

        db.commit()
        logger.info(
            "pipeline_complete",
            extra={
                "source_id": source_id,
                "pages": result.pages_fetched,
                "drafts_created": result.draft_created,
                "updated": result.draft_updated,
                "dupes": result.duplicates,
                "failed": result.failed,
            },
        )
        _enqueue_translation_tasks(result.pending_translation_ids)
        return result
    except Exception as exc:
        db.rollback()
        err_msg = str(exc)[:2000]
        result.error = err_msg
        run.status = CrawlRunStatus.failed
        run.finished_at = datetime.now(UTC)
        run.error_message = err_msg
        run.logs = {
            "messages": logs + [f"Fatal error: {err_msg}"],
            "diagnostics": _build_run_diagnostics(result),
        }
        legacy_job.status = CrawlStatus.failed
        legacy_job.finished_at = datetime.now(UTC)
        legacy_job.error_message = err_msg
        _update_source_error(db, source, err_msg)
        db.commit()
        raise


def _process_page(
    db: Session,
    page,
    source: Source,
    crawl_run: CrawlRun,
    storage: ObjectStorage,
    parser,
    trust_badge: str | None,
    result: PipelineResult,
    logs: list[str],
) -> None:
    if page.content_type in _PDF_CONTENT_TYPES:
        pdf_url = page.document_url or page.url
        pdf_bytes = download_pdf(pdf_url)
        pdf_result = pdf_extract_text(pdf_bytes)
        page.raw_text = pdf_result.text
        page.content_type = pdf_result.content_type
        page.ocr_used = pdf_result.used_ocr

    parsed = parser(page)
    cleaned = clean_page(page)
    cleaned["title"] = parsed.get("title") or cleaned.get("title")
    canonical_url = cleaned.get("canonical_url") or page.canonical_url or page.url
    raw_hash = cleaned.get("content_hash", "")
    raw_path = storage.put_text(page.url, page.raw_html or page.raw_text or "")

    snapshot_duplicate = is_latest_snapshot_duplicate(
        db,
        source_id=source.id,
        canonical_url=canonical_url,
        content_hash=raw_hash,
    )

    raw = RawDocument(
        source_id=source.id,
        source_url=page.url,
        canonical_url=canonical_url,
        content_type=page.content_type,
        raw_text=cleaned.get("body_text"),
        raw_title=page.title or cleaned.get("title"),
        source_job_id=(page.metadata or {}).get("source_job_id"),
        detected_item_type=(page.metadata or {}).get("detected_item_type"),
        raw_html_snapshot=(page.raw_html or "")[:120_000] or None,
        raw_html_path=raw_path,
        metadata_json=page.metadata,
        content_hash=(page.metadata or {}).get("content_hash") or raw_hash or "unknown",
        crawl_run_id=crawl_run.id,
    )
    db.add(raw)
    db.flush()

    if snapshot_duplicate:
        _mark_seen_for_duplicate(db, source=source, page=page, raw=raw, seen_at=datetime.now(UTC))
        result.duplicates += 1
        result.unchanged += 1
        logs.append(f"Skipped unchanged page: {canonical_url}")
        return

    if _should_reject_as_news(cleaned):
        raw.skip_reason = "pre_filter_rejected_news_article"
        result.skipped += 1
        logs.append(f"Pre-filter rejected news article: '{(cleaned.get('title') or '')[:80]}'")
        return

    extractions = _extract_records_for_page(db, source, page, cleaned)
    if not extractions:
        _record_skip(result, raw, canonical_url, "no_extractable_opportunity", logs)
        if source.connector_key != "search_html_jobs":
            result.failed += 1
        return

    extracted_any = False
    for extraction in extractions:
        _track_extraction_attempt(result, extraction)
        errors = validate_extraction(extraction)
        if errors or extraction.record_type == "unknown":
            skip_reason = "; ".join(errors) if errors else "unknown_record_type"
            _append_raw_extraction_diagnostic(
                raw,
                extraction,
                skip_reason=skip_reason,
                validation_errors=errors,
            )
            _record_skip(
                result,
                raw,
                canonical_url,
                skip_reason,
                logs,
                confidence=extraction.extraction_confidence,
            )
            continue
        extracted_any = True
        _process_extraction(
            db=db,
            extraction=extraction,
            page=page,
            source=source,
            trust_badge=trust_badge,
            raw=raw,
            result=result,
            logs=logs,
        )

    if not extracted_any and source.connector_key != "search_html_jobs":
        result.failed += 1


def _extract_records_for_page(db: Session, source: Source, page, cleaned: dict) -> list:
    if _force_ai_detail_extraction(source, page):
        extraction = extract_official_job_structured(db, _official_ai_cleaned_payload(source, page, cleaned))
        if extraction.record_type == "unknown":
            return []
        _apply_extraction_fallbacks(source, page, extraction)
        return [extraction]

    if (page.metadata or {}).get("structured_job"):
        return [_structured_page_extraction(source, page, cleaned)]

    if source.connector_key == "search_html_jobs":
        if page.content_type == "linkout_only":
            title = page.title or cleaned.get("title") or page.url
            snippet = (page.metadata or {}).get("search_snippet")
            return [summarize_linkout_job(db, title=title, snippet=snippet, url=page.url)]
        max_jobs = max(1, source.max_jobs_per_page or 10)
        return extract_jobs_structured(db, cleaned, max_jobs=max_jobs)

    extraction = extract_structured(db, cleaned)
    return [extraction] if extraction.record_type != "unknown" else []


def _structured_page_extraction(source: Source, page, cleaned: dict) -> JobOpportunityExtraction:
    metadata = page.metadata or {}
    body = page.raw_text or cleaned.get("body_text") or ""
    title = page.title or cleaned.get("title") or "Untitled"
    requirements = _extract_bullets_near(body, ["requirement", "qualification", "experience", "education"])
    benefits = _extract_bullets_near(body, ["benefit", "accommodation", "transport", "food", "medical"])
    languages = _extract_language_requirements(body)
    return JobOpportunityExtraction(
        title=title,
        summary=(body[:900] or title),
        country=_country_from_location(metadata.get("location_raw")) or source.country,
        city=_city_from_location(metadata.get("location_raw")),
        employer=metadata.get("company") or source.name,
        organization=metadata.get("department"),
        sector=metadata.get("department"),
        degree_level=_extract_education(body),
        deadline_text=_extract_deadline(body),
        application_url=page.original_apply_url,
        eligibility_text=_extract_eligibility_text(body),
        requirements=requirements,
        benefits=benefits,
        language_requirements=languages,
        journey_steps=[],
        documents_needed=_extract_documents(body),
        extraction_confidence=0.72 if page.original_apply_url else 0.58,
        extraction_method="heuristic_structured",
        evidence_snippets=[snippet for snippet in [metadata.get("location_raw"), metadata.get("experience_level")] if snippet],
        field_confidences={
            "title": 0.9,
            "application_url": 0.85 if page.original_apply_url else 0.0,
            "requirements": 0.65 if requirements else 0.0,
            "deadline_text": 0.65 if _extract_deadline(body) else 0.0,
        },
    )


def _should_reject_as_news(cleaned: dict) -> bool:
    pre_title = cleaned.get("title") or ""
    pre_body = (cleaned.get("body_text") or "")[:600]
    pre_text = f"{pre_title} {pre_body}".lower()
    hits = sum(1 for pattern in _NEWS_REJECT_PATTERNS if re.search(pattern, pre_text))
    return hits >= 2


def _source_setting(source: Source, key: str, default=None):
    settings_json = getattr(source, "settings_json", None) or {}
    return settings_json.get(key, default)


def _is_strict_official_job_source(source: Source) -> bool:
    return bool(_source_setting(source, "strict_bd_job_filter", False))


def _force_ai_detail_extraction(source: Source, page) -> bool:
    return bool(_source_setting(source, "force_ai_detail_extraction", False) and (page.metadata or {}).get("structured_job"))


def _official_ai_cleaned_payload(source: Source, page, cleaned: dict) -> dict:
    metadata = page.metadata or {}
    context_lines = [
        "Official listing metadata:",
        f"Company: {metadata.get('company') or source.name}",
    ]
    for label, value in (
        ("Location", metadata.get("location_raw")),
        ("Department", metadata.get("department")),
        ("Posting date", metadata.get("posting_date_text")),
        ("Experience level", metadata.get("experience_level")),
        ("Apply URL", getattr(page, "original_apply_url", None)),
        ("Source job ID", metadata.get("source_job_id")),
    ):
        if value:
            context_lines.append(f"{label}: {value}")
    body = _official_detail_body(page) or cleaned.get("body_text") or page.raw_text or ""
    return {
        **cleaned,
        "title": page.title or cleaned.get("title"),
        "body_text": "\n".join(context_lines) + "\n\nJob detail page content:\n" + body,
    }


def _official_detail_body(page) -> str:
    html = getattr(page, "raw_html", None) or ""
    if not html:
        return _strip_official_boilerplate(getattr(page, "raw_text", None) or "")
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for node in soup.select("script, style, noscript, nav, header, footer, iframe"):
            node.decompose()
        for selector in (
            "[id*='cookie' i]",
            "[class*='cookie' i]",
            "[id*='onetrust' i]",
            "[class*='onetrust' i]",
            "[class*='profile' i]",
            "[id*='profile' i]",
            ".jobAlerts",
            ".social-share",
            ".share",
        ):
            for node in soup.select(selector):
                node.decompose()
        container = (
            soup.select_one(".jobDisplay")
            or soup.select_one(".job")
            or soup.select_one("[data-automation-id*='job' i]")
            or soup.select_one("main")
            or soup.body
        )
        if not container:
            return _strip_official_boilerplate(getattr(page, "raw_text", None) or "")
        lines: list[str] = []
        for node in container.find_all(["h1", "h2", "h3", "h4", "p", "li"], recursive=True):
            text_value = re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()
            if not text_value or _is_official_boilerplate_line(text_value):
                continue
            prefix = ""
            if node.name in {"h1", "h2", "h3", "h4"}:
                prefix = "\n## "
            elif node.name == "li":
                prefix = "- "
            lines.append(f"{prefix}{text_value}")
        return _strip_official_boilerplate("\n".join(lines))
    except Exception:
        return _strip_official_boilerplate(getattr(page, "raw_text", None) or "")


def _strip_official_boilerplate(text_value: str) -> str:
    lines = []
    seen: set[str] = set()
    for raw_line in text_value.splitlines():
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line or _is_official_boilerplate_line(line):
            continue
        lowered = line.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        lines.append(line)
    return "\n".join(lines)


def _is_official_boilerplate_line(line: str) -> bool:
    lowered = line.lower()
    noise = (
        "by continuing to use and navigate this website",
        "you are agreeing to the use of cookies",
        "cookie",
        "privacy policy",
        "my profile",
        "create alert",
        "share this job",
        "view profile",
        "search results",
        "careers home",
        "already applied",
        "login",
        "sign in",
    )
    return any(term in lowered for term in noise)


def _apply_extraction_fallbacks(source: Source, page, extraction) -> None:
    metadata = page.metadata or {}
    location_raw = metadata.get("location_raw")
    if not extraction.country:
        extraction.country = _country_from_location(location_raw) or source.country
    if not extraction.city:
        extraction.city = _city_from_location(location_raw)
    if not extraction.employer:
        extraction.employer = metadata.get("company") or source.name
    if not extraction.organization:
        extraction.organization = metadata.get("department")
    if not extraction.sector:
        extraction.sector = metadata.get("department")
    if not extraction.application_url:
        extraction.application_url = getattr(page, "original_apply_url", None) or page.document_url
    if not extraction.deadline_text:
        extraction.deadline_text = _extract_deadline(page.raw_text or "")


def _append_raw_extraction_diagnostic(
    raw: RawDocument,
    extraction,
    *,
    skip_reason: str | None = None,
    review_reason: str | None = None,
    validation_errors: list[str] | None = None,
) -> None:
    existing = raw.extraction_diagnostics_json if isinstance(raw.extraction_diagnostics_json, dict) else {}
    attempts = list(existing.get("attempts") or [])
    attempts.append({
        "record_type": extraction.record_type,
        "extraction_confidence": float(extraction.extraction_confidence or 0.0),
        "field_confidences": dict(getattr(extraction, "field_confidences", None) or {}),
        "evidence_snippets": list(getattr(extraction, "evidence_snippets", None) or []),
        "application_url": extraction.application_url,
        "employer": extraction.employer or extraction.organization,
        "country": extraction.country,
        "title": extraction.title,
        "summary": extraction.summary,
        "extraction_method": getattr(extraction, "extraction_method", None),
        "fallback_reason": getattr(extraction, "fallback_reason", None),
        "validation_errors": list(validation_errors or []),
        "skip_reason": skip_reason,
        "review_reason": review_reason,
    })
    raw.extraction_diagnostics_json = {
        **existing,
        "attempts": attempts,
    }


def _record_skip(
    result: PipelineResult,
    raw: RawDocument,
    source_page_url: str,
    reason: str,
    logs: list[str],
    *,
    confidence: float | None = None,
) -> None:
    raw.skip_reason = reason
    result.skipped += 1
    result.skip_reasons[reason] = result.skip_reasons.get(reason, 0) + 1
    if confidence is not None:
        result.skipped_confidences.append(float(confidence))
    logs.append(f"Skipped {source_page_url}: {reason}")


def _track_extraction_attempt(result: PipelineResult, extraction) -> None:
    method = getattr(extraction, "extraction_method", None) or "unspecified"
    result.extraction_method_counts[method] = result.extraction_method_counts.get(method, 0) + 1


def _strict_gate_skip_reason(source: Source, extraction, application_url: str | None, eligibility, category, suitability) -> str | None:
    if not _is_strict_official_job_source(source):
        return None
    if extraction.record_type != "job":
        return "strict_official_non_job"
    if _source_setting(source, "require_application_url", False) and not application_url:
        return "strict_missing_application_url"
    if extraction.extraction_confidence < _OFFICIAL_STRICT_CONFIDENCE_THRESHOLD:
        return "strict_low_ai_confidence"
    if _source_setting(source, "require_isc_category", False) and not category.isc_category_key:
        return "strict_missing_isc_category"
    if suitability.bangladesh_applicability not in {"high", "medium"}:
        return f"strict_bd_applicability_{suitability.bangladesh_applicability}"
    if eligibility.can_apply_from_bd is False:
        return "strict_not_open_from_bangladesh"
    if eligibility.requires_existing_work_permit is True:
        return "strict_requires_existing_work_permit"
    if eligibility.open_to_authorized_workers_only is True:
        return "strict_authorized_workers_only"
    return None


def _should_publish_strict_source(source: Source) -> bool:
    return bool(_source_setting(source, "auto_publish_on_pass", False))


def _should_route_low_confidence_to_review(source: Source, strict_skip_reason: str | None) -> bool:
    return bool(
        strict_skip_reason == "strict_low_ai_confidence"
        and _source_setting(source, "low_confidence_to_review", False)
    )


def _process_extraction(
    db: Session,
    extraction,
    page,
    source: Source,
    trust_badge: str | None,
    raw: RawDocument,
    result: PipelineResult,
    logs: list[str],
) -> None:
    source_page_url = page.source_page_url or page.url
    application_url = extraction.application_url or getattr(page, "original_apply_url", None) or page.document_url
    detected_item_type = (page.metadata or {}).get("detected_item_type")
    relevant, skip_reason = is_relevant_for_active_job(
        title=extraction.title,
        body=extraction.summary or extraction.eligibility_text or raw.raw_text,
        apply_url=application_url,
        detected_item_type=detected_item_type,
    )
    if not relevant:
        raw.detected_item_type = detected_item_type
        final_skip_reason = skip_reason or "not_relevant_for_active_job"
        _append_raw_extraction_diagnostic(raw, extraction, skip_reason=final_skip_reason)
        _record_skip(
            result,
            raw,
            source_page_url,
            final_skip_reason,
            logs,
            confidence=extraction.extraction_confidence,
        )
        return

    eligibility = tag_eligibility(
        source_connector_key=source.connector_key,
        source_trust_level=source.trust_level,
        record_type=extraction.record_type,
        country=extraction.country or source.country,
        eligibility_text=extraction.eligibility_text,
        requirements_json=_build_requirements_json(extraction),
        extracted_json=extraction.model_dump(mode="json"),
        title=extraction.title,
        summary=extraction.summary,
        employer=extraction.employer,
    )
    combined_body = " ".join(filter(None, [
        extraction.summary,
        extraction.eligibility_text,
        " ".join(extraction.requirements or []),
        raw.raw_text,
    ]))
    category = classify_category(title=extraction.title, body=combined_body, sector=extraction.sector)
    suitability = classify_bangladesh_suitability(
        title=extraction.title,
        body=combined_body,
        apply_url=application_url,
        source_trust_level=source.trust_level,
        source_connector_key=source.connector_key,
        extraction_confidence=extraction.extraction_confidence,
        detected_item_type=detected_item_type,
    )
    strict_skip_reason = _strict_gate_skip_reason(
        source,
        extraction,
        application_url,
        eligibility,
        category,
        suitability,
    )
    low_confidence_review = _should_route_low_confidence_to_review(source, strict_skip_reason)
    if strict_skip_reason and not low_confidence_review:
        _append_raw_extraction_diagnostic(raw, extraction, skip_reason=strict_skip_reason)
        _record_skip(
            result,
            raw,
            source_page_url,
            strict_skip_reason,
            logs,
            confidence=extraction.extraction_confidence,
        )
        return
    if low_confidence_review:
        _append_raw_extraction_diagnostic(
            raw,
            extraction,
            review_reason="low_confidence_official_job",
        )
    else:
        _append_raw_extraction_diagnostic(raw, extraction)

    opp_hash = _content_hash(
        title=extraction.title,
        source_id=source.id,
        deadline=extraction.deadline_text,
        source_page_url=source_page_url,
        document_url=page.document_url,
        original_apply_url=application_url,
    )
    item_key = _source_item_key(
        source_page_url=source_page_url,
        title=extraction.title,
        employer=extraction.employer or extraction.organization,
        country=extraction.country or source.country,
        deadline=extraction.deadline_text,
        application_url=application_url,
    )
    forced_item_key = (page.metadata or {}).get("source_item_key")
    if isinstance(forced_item_key, str) and forced_item_key.strip():
        item_key = forced_item_key.strip()
    elif (page.metadata or {}).get("source_job_id"):
        item_key = str((page.metadata or {}).get("source_job_id")).strip()
    elif application_url:
        item_key = hashlib.sha256(application_url.strip().lower().encode()).hexdigest()[:64]

    existing = find_existing_opportunity(
        db,
        source_id=source.id,
        source_item_key=item_key,
        content_hash=opp_hash,
    )

    extraction_embedding: list[float] | None = None
    semantic_match: Opportunity | None = None
    if existing is None:
        try:
            embed_input = " ".join(filter(None, [
                extraction.title,
                extraction.summary or extraction.summary_en,
                extraction.employer or extraction.organization,
                extraction.country or source.country,
            ]))
            if embed_input.strip():
                from app.services.embedding_service import embed_text as _embed_text
                extraction_embedding = _embed_text(embed_input)
                semantic_match = find_semantic_duplicate(
                    db,
                    title=extraction.title or "",
                    summary=extraction.summary or extraction.summary_en,
                    employer=extraction.employer or extraction.organization,
                    country=extraction.country or source.country,
                    embedding=extraction_embedding,
                )
                if semantic_match and semantic_match.source_id == source.id:
                    semantic_match = None
        except Exception as exc:
            logger.warning("semantic_dedup_failed", extra={"error": str(exc)})
            semantic_match = None

    if semantic_match is not None:
        if merge_mirror_url(semantic_match, source_page_url):
            logs.append(
                f"Semantic dedup: merged {source_page_url} into canonical opportunity #{semantic_match.id}"
            )
        result.duplicates += 1
        return

    ocr_used = getattr(page, "ocr_used", False)
    force_review = bool(ocr_used or source.requires_admin_review)
    now = datetime.now(UTC)

    if existing:
        old_source_hash = existing.source_content_hash
        _apply_extraction_to_draft(
            db=db,
            draft=existing,
            source=source,
            page=page,
            raw=raw,
            extraction=extraction,
            eligibility=eligibility,
            trust_badge=trust_badge,
            opp_hash=opp_hash,
            source_item_key=item_key,
            now=now,
            category=category,
            suitability=suitability,
            force_review=force_review,
            low_confidence_review=low_confidence_review,
        )
        if old_source_hash == raw.content_hash:
            result.unchanged += 1
        else:
            result.draft_updated += 1
        result.duplicates += 1
        result.accepted += 1
        if low_confidence_review:
            result.low_confidence_review_count += 1
        if existing.status == "published":
            result.published += 1
            if _is_strict_official_job_source(source):
                result.high_confidence_published_count += 1
        result.pending_translation_ids.append(existing.id)
        logs.append(f"Draft updated: id={existing.id} title='{(existing.title or '')[:60]}'")
        return

    strict_source = _is_strict_official_job_source(source)
    if low_confidence_review:
        admin_status = "low_confidence_official_job"
        initial_status = "pending"
    elif strict_source and _should_publish_strict_source(source):
        admin_status = "auto_approved"
        initial_status = "published"
    else:
        admin_status = "needs_review" if (force_review or suitability.needs_review or suitability.bangladesh_applicability != "high") else "auto_approved"
        initial_status = "published" if admin_status == "auto_approved" and source.auto_publish else "pending"
    draft = Opportunity(
        source_id=source.id,
        source_name=source.name,
        source_page_url=source_page_url,
        source_url=source_page_url,
        document_url=page.document_url,
        original_apply_url=getattr(page, "original_apply_url", None),
        content_type=page.content_type,
        opportunity_type=eligibility.opportunity_type,
        title=extraction.title or "Untitled",
        title_bn=getattr(extraction, "title_bn", None),
        summary=extraction.summary,
        summary_bn=getattr(extraction, "summary_bn", None),
        summary_en=getattr(extraction, "summary_en", None) or extraction.summary,
        country=extraction.country or source.country,
        destination_country=None,
        employer_or_organization=extraction.employer or extraction.organization,
        employer=extraction.employer,
        organization=extraction.organization,
        sector=extraction.sector,
        isc_category_key=category.isc_category_key,
        platform_category_bn=category.platform_category_bn,
        platform_category_en=category.platform_category_en,
        occupation_family=category.occupation_family,
        degree_level=extraction.degree_level,
        education_min=extraction.degree_level,
        salary_min=extraction.salary_min,
        salary_max=extraction.salary_max,
        salary_currency=extraction.salary_currency,
        deadline=parse_deadline(extraction.deadline_text),
        application_url=application_url,
        eligibility_text=extraction.eligibility_text,
        visa_support=extraction.visa_support,
        journey_steps=extraction.journey_steps,
        documents_needed=extraction.documents_needed,
        documents_required=extraction.documents_needed,
        application_steps=extraction.journey_steps,
        typical_salary_bdt=extraction.typical_salary_bdt,
        language_requirements_json={"items": extraction.language_requirements},
        languages_required=extraction.language_requirements,
        requirements_json=_build_requirements_json(extraction),
        benefits_json=_build_benefits_json(extraction),
        posting_date=parse_deadline((page.metadata or {}).get("posting_date_text")),
        visa_or_iqama_requirement=extraction.eligibility_text if "iqama" in combined_body.lower() else None,
        lmia_status=eligibility.lmia_status,
        can_apply_from_bd=eligibility.can_apply_from_bd,
        requires_existing_work_permit=eligibility.requires_existing_work_permit,
        open_to_international_candidates=eligibility.open_to_international_candidates,
        open_to_authorized_workers_only=eligibility.open_to_authorized_workers_only,
        eligibility_status=eligibility.eligibility_status,
        target_audience_tags=eligibility.target_audience_tags,
        risk_flags=eligibility.risk_flags,
        source_trust_badge=trust_badge,
        source_trust_tier=source.trust_level or (source.trust_tier.value if source.trust_tier else None),
        bangladesh_applicability=suitability.bangladesh_applicability,
        bangladesh_applicability_reason=suitability.bangladesh_applicability_reason,
        rural_user_fit_score=suitability.rural_user_fit_score,
        bangladesh_applicability_score=suitability.bangladesh_applicability_score,
        category_match_score=category.category_match_score,
        ai_confidence=extraction.extraction_confidence,
        extraction_warnings=suitability.warnings,
        extraction_confidence=extraction.extraction_confidence,
        needs_admin_review=admin_status != "auto_approved",
        review_status="approved" if initial_status == "published" else "pending",
        status=initial_status,
        admin_status=admin_status,
        is_active=initial_status == "published",
        published_at=now if initial_status == "published" else None,
        content_hash=opp_hash,
        source_content_hash=raw.content_hash,
        source_item_key=item_key,
        raw_text=(page.raw_text or cleaned_text(raw.raw_text))[:10_000] or None,
        raw_document_id=raw.id,
        connector_key=source.connector_key,
        record_type=extraction.record_type,
        extracted_json=extraction.model_dump(mode="json"),
        trust_score=_trust_score(source.trust_level or source.trust_tier.value if source.trust_tier else ""),
        freshness_score=_freshness_score(now),
        actionability_score=_action_score(
            has_deadline=bool(extraction.deadline_text),
            has_apply=bool(application_url),
            has_req=bool(extraction.requirements),
        ),
        first_seen_at=now,
        last_seen_at=now,
        missing_count=0,
    )
    _populate_opportunity_detail_fields(draft, extraction, page, source)
    _enrich_official_bilingual_fields(db, draft, source, logs)
    draft.actionability_score = suitability.actionability_score
    draft.overall_rank_score = _overall_score(draft)

    db.add(draft)
    db.flush()

    result.draft_created += 1
    result.accepted += 1
    if draft.status == "published":
        result.published += 1
        if strict_source:
            result.high_confidence_published_count += 1
    if draft.needs_admin_review:
        result.manual_review += 1
        if low_confidence_review:
            result.low_confidence_review_count += 1
    result.pending_translation_ids.append(draft.id)

    if extraction_embedding is not None:
        try:
            from app.services.embedding_service import EMBEDDING_MODEL as _EMB_MODEL
            db.add(OpportunityEmbedding(
                opportunity_id=draft.id,
                embedding=extraction_embedding,
                embedding_model=_EMB_MODEL,
            ))
        except Exception as exc:
            logger.warning("embedding_persist_failed", extra={"draft_id": draft.id, "error": str(exc)})

    _refresh_search_tsv(db, draft.id)
    logs.append(f"Draft created: id={draft.id} title='{draft.title[:60]}'")


def _apply_extraction_to_draft(
    *,
    db: Session,
    draft: Opportunity,
    source: Source,
    page,
    raw: RawDocument,
    extraction,
    eligibility,
    trust_badge: str | None,
    opp_hash: str,
    source_item_key: str,
    now: datetime,
    category,
    suitability,
    force_review: bool,
    low_confidence_review: bool = False,
) -> None:
    application_url = extraction.application_url or getattr(page, "original_apply_url", None) or page.document_url
    draft.source_name = source.name
    draft.source_page_url = page.source_page_url or page.url
    draft.source_url = page.source_page_url or page.url
    draft.document_url = page.document_url
    draft.original_apply_url = getattr(page, "original_apply_url", None)
    draft.content_type = page.content_type
    draft.opportunity_type = eligibility.opportunity_type
    draft.title = extraction.title or draft.title
    draft.title_bn = getattr(extraction, "title_bn", None) or draft.title_bn
    draft.summary = extraction.summary
    draft.summary_bn = getattr(extraction, "summary_bn", None)
    draft.summary_en = getattr(extraction, "summary_en", None) or extraction.summary
    draft.country = extraction.country or source.country
    draft.employer_or_organization = extraction.employer or extraction.organization
    draft.employer = extraction.employer
    draft.organization = extraction.organization
    draft.sector = extraction.sector
    draft.isc_category_key = category.isc_category_key
    draft.platform_category_bn = category.platform_category_bn
    draft.platform_category_en = category.platform_category_en
    draft.occupation_family = category.occupation_family
    draft.degree_level = extraction.degree_level
    draft.education_min = extraction.degree_level
    draft.salary_min = extraction.salary_min
    draft.salary_max = extraction.salary_max
    draft.salary_currency = extraction.salary_currency
    draft.deadline = parse_deadline(extraction.deadline_text)
    draft.application_url = application_url
    draft.eligibility_text = extraction.eligibility_text
    draft.visa_support = extraction.visa_support
    draft.journey_steps = extraction.journey_steps
    draft.documents_needed = extraction.documents_needed
    draft.documents_required = extraction.documents_needed
    draft.application_steps = extraction.journey_steps
    draft.typical_salary_bdt = extraction.typical_salary_bdt
    draft.language_requirements_json = {"items": extraction.language_requirements}
    draft.languages_required = extraction.language_requirements
    draft.requirements_json = _build_requirements_json(extraction)
    draft.benefits_json = _build_benefits_json(extraction)
    draft.posting_date = parse_deadline((page.metadata or {}).get("posting_date_text"))
    combined_body = " ".join(filter(None, [
        extraction.summary,
        extraction.eligibility_text,
        " ".join(extraction.requirements or []),
        raw.raw_text,
    ]))
    draft.visa_or_iqama_requirement = extraction.eligibility_text if "iqama" in combined_body.lower() else None
    draft.lmia_status = eligibility.lmia_status
    draft.can_apply_from_bd = eligibility.can_apply_from_bd
    draft.requires_existing_work_permit = eligibility.requires_existing_work_permit
    draft.open_to_international_candidates = eligibility.open_to_international_candidates
    draft.open_to_authorized_workers_only = eligibility.open_to_authorized_workers_only
    draft.eligibility_status = eligibility.eligibility_status
    draft.target_audience_tags = eligibility.target_audience_tags
    draft.risk_flags = eligibility.risk_flags
    draft.source_trust_badge = trust_badge
    draft.source_trust_tier = source.trust_level or (source.trust_tier.value if source.trust_tier else None)
    draft.bangladesh_applicability = suitability.bangladesh_applicability
    draft.bangladesh_applicability_reason = suitability.bangladesh_applicability_reason
    draft.rural_user_fit_score = suitability.rural_user_fit_score
    draft.bangladesh_applicability_score = suitability.bangladesh_applicability_score
    draft.category_match_score = category.category_match_score
    draft.ai_confidence = extraction.extraction_confidence
    draft.extraction_warnings = suitability.warnings
    draft.extraction_confidence = extraction.extraction_confidence
    draft.content_hash = opp_hash
    draft.source_content_hash = raw.content_hash
    draft.source_item_key = source_item_key
    draft.raw_text = (page.raw_text or cleaned_text(raw.raw_text))[:10_000] or None
    draft.raw_document_id = raw.id
    draft.connector_key = source.connector_key
    draft.record_type = extraction.record_type
    draft.extracted_json = extraction.model_dump(mode="json")
    draft.trust_score = _trust_score(source.trust_level or source.trust_tier.value if source.trust_tier else "")
    draft.freshness_score = _freshness_score(now)
    draft.actionability_score = _action_score(
        has_deadline=bool(extraction.deadline_text),
        has_apply=bool(application_url),
        has_req=bool(extraction.requirements),
    )
    _populate_opportunity_detail_fields(draft, extraction, page, source)
    _enrich_official_bilingual_fields(db, draft, source, [])
    draft.actionability_score = suitability.actionability_score
    draft.overall_rank_score = _overall_score(draft)
    draft.last_seen_at = now
    draft.first_seen_at = draft.first_seen_at or now
    draft.missing_count = 0
    if low_confidence_review:
        draft.needs_admin_review = True
        draft.review_status = "pending"
        draft.admin_status = "low_confidence_official_job"
        draft.status = "pending"
        draft.is_active = False
        draft.published_at = None
    elif _is_strict_official_job_source(source) and _should_publish_strict_source(source):
        draft.needs_admin_review = False
        draft.review_status = "approved"
        draft.admin_status = "auto_approved"
        draft.status = "published"
        draft.is_active = True
        draft.published_at = draft.published_at or now
    else:
        if draft.admin_status in {"inactive"} and draft.status != "published":
            draft.admin_status = "needs_review"
        if draft.status != "published":
            draft.needs_admin_review = bool(force_review or suitability.needs_review or suitability.bangladesh_applicability != "high")
            draft.review_status = "approved" if (not draft.needs_admin_review and source.auto_publish) else "pending"
            draft.admin_status = "auto_approved" if not draft.needs_admin_review else "needs_review"
            draft.status = "published" if draft.review_status == "approved" else "pending"
            draft.is_active = draft.status == "published"
            if draft.status == "published":
                draft.published_at = draft.published_at or now
    draft.updated_at = now
    _refresh_search_tsv(db, draft.id)


def _populate_opportunity_detail_fields(draft: Opportunity, extraction, page, source: Source) -> None:
    metadata = page.metadata or {}
    location_text = metadata.get("location_raw") or ", ".join(filter(None, [extraction.city, extraction.country or source.country])) or None
    draft.title_en = draft.title_en or (_clean_latin_text(extraction.title) if extraction.title else None)
    draft.job_title = extraction.title or draft.job_title
    draft.salary_text = _format_salary_text(extraction.salary_min, extraction.salary_max, extraction.salary_currency)
    draft.location_text = location_text
    all_requirements = _clean_list(extraction.requirements) + _clean_list(getattr(extraction, "qualifications", None))
    draft.eligibility_text = extraction.eligibility_text or _list_to_text(all_requirements, separator="\n")
    draft.education_requirement = extraction.degree_level or _pick_requirement_line(all_requirements, ("education", "degree", "diploma", "bachelor", "ssc"))
    draft.experience_requirement = _pick_requirement_line(all_requirements, ("experience", "year", "yrs"))
    draft.language_requirement = ", ".join(extraction.language_requirements) if extraction.language_requirements else _pick_requirement_line(_clean_list(getattr(extraction, "skills", None)), ("english", "arabic", "language"))
    draft.visa_or_work_permit_info = _extract_visa_info(extraction.eligibility_text, page.raw_text or "")
    if _is_strict_official_job_source(source) and not draft.journey_steps and (application_url := (extraction.application_url or getattr(page, "original_apply_url", None) or page.document_url)):
        draft.journey_steps = _default_journey_steps(application_url)
        draft.application_steps = list(draft.journey_steps)
    if _is_strict_official_job_source(source) and not draft.documents_needed:
        draft.documents_needed = _default_documents_needed()
        draft.documents_required = list(draft.documents_needed)
    draft.required_documents = _list_to_text(draft.documents_needed)
    draft.application_process = _list_to_text(draft.journey_steps, separator="\n")
    draft.posted_date = parse_deadline((page.metadata or {}).get("posting_date_text"))


def _enrich_official_bilingual_fields(db: Session, draft: Opportunity, source: Source, logs: list[str]) -> None:
    if not _is_strict_official_job_source(source):
        return
    try:
        changes = enrich_bilingual_record(db, draft)
        if changes and logs is not None:
            logs.append(f"Bilingual enrichment applied: {len(changes)} fields")
    except Exception as exc:
        if logs is not None:
            logs.append(f"Bilingual enrichment skipped: {exc}")


def _format_salary_text(salary_min: float | None, salary_max: float | None, salary_currency: str | None) -> str | None:
    if salary_min is None and salary_max is None:
        return None
    if salary_min is not None and salary_max is not None and salary_min != salary_max:
        return f"{salary_currency or ''} {salary_min:g} - {salary_max:g}".strip()
    value = salary_max if salary_max is not None else salary_min
    return f"{salary_currency or ''} {value:g}".strip() if value is not None else None


def _list_to_text(values: list[str] | None, *, separator: str = ", ") -> str | None:
    cleaned = [item.strip() for item in (values or []) if item and item.strip()]
    return separator.join(cleaned) if cleaned else None


def _clean_list(values: list[str] | None) -> list[str]:
    return [str(item).strip() for item in (values or []) if str(item).strip()]


def _build_requirements_json(extraction) -> dict:
    groups = {
        "requirements": _clean_list(extraction.requirements),
        "qualifications": _clean_list(getattr(extraction, "qualifications", None)),
        "responsibilities": _clean_list(getattr(extraction, "responsibilities", None)),
        "key_accountabilities": _clean_list(getattr(extraction, "key_accountabilities", None)),
        "role_accountabilities": _clean_list(getattr(extraction, "role_accountabilities", None)),
        "skills": _clean_list(getattr(extraction, "skills", None)),
        "work_conditions": _clean_list(getattr(extraction, "work_conditions", None)),
    }
    items: list[str] = []
    for key in ("requirements", "qualifications", "skills"):
        for item in groups[key]:
            if item not in items:
                items.append(item)
    return {
        "items": items,
        "groups": {key: value for key, value in groups.items() if value},
        "source_sections": _clean_source_sections(getattr(extraction, "source_sections", None)),
        "job_purpose": getattr(extraction, "job_purpose", None),
    }


def _build_benefits_json(extraction) -> dict:
    return {
        "items": _clean_list(extraction.benefits),
        "work_conditions": _clean_list(getattr(extraction, "work_conditions", None)),
    }


def _clean_source_sections(sections) -> list[dict[str, list[str] | str]]:
    cleaned: list[dict[str, list[str] | str]] = []
    for section in sections or []:
        if not isinstance(section, dict):
            continue
        title = str(section.get("title") or "").strip()
        items = section.get("items") or []
        if isinstance(items, str):
            items = [items]
        clean_items = [str(item).strip() for item in items if str(item).strip()]
        if title and clean_items:
            cleaned.append({"title": title, "items": clean_items})
    return cleaned


def _pick_requirement_line(requirements: list[str] | None, terms: tuple[str, ...]) -> str | None:
    for requirement in requirements or []:
        lowered = requirement.lower()
        if any(term in lowered for term in terms):
            return requirement
    return None


def _extract_visa_info(*texts: str | None) -> str | None:
    for text in texts:
        if not text:
            continue
        lowered = text.lower()
        if any(term in lowered for term in ("visa", "iqama", "work permit", "sponsorship")):
            return text[:500]
    return None


def _default_journey_steps(application_url: str) -> list[str]:
    return [
        "চাকরির যোগ্যতা ও শর্তগুলো ভালোভাবে দেখুন",
        "পাসপোর্ট, সিভি ও প্রয়োজনীয় কাগজপত্র প্রস্তুত করুন",
        f"আবেদনের লিংকে গিয়ে আবেদন করুন: {application_url}",
    ]


def _default_documents_needed() -> list[str]:
    return ["পাসপোর্ট", "সিভি", "শিক্ষাগত সনদ", "অভিজ্ঞতার সনদ"]


def _clean_latin_text(value: str | None) -> str | None:
    if not value:
        return None
    return value if re.search(r"[A-Za-z]", value) else None


def cleaned_text(value: str | None) -> str:
    return value or ""


def _build_slug(title: str, draft_id: int) -> str:
    import re as _re
    import unicodedata as _ud

    text_value = _ud.normalize("NFKD", title).encode("ascii", "ignore").decode("ascii")
    text_value = _re.sub(r"[^\w\s-]", "", text_value.lower())
    slug = _re.sub(r"[-\s]+", "-", text_value).strip("-")[:560]
    return f"{slug}-{draft_id}"


def _refresh_search_tsv(db: Session, draft_id: int) -> None:
    db.execute(
        text(
            "UPDATE opportunities "
            "SET search_tsv = to_tsvector('simple', "
            "coalesce(title,'') || ' ' || coalesce(summary_en,'') || ' ' || coalesce(eligibility_text,'')) "
            "WHERE id = :id"
        ),
        {"id": draft_id},
    )


def _mark_seen_for_duplicate(db: Session, *, source: Source, page, raw: RawDocument, seen_at: datetime) -> None:
    metadata = page.metadata or {}
    keys = [
        metadata.get("source_item_key"),
        metadata.get("source_job_id"),
    ]
    if page.original_apply_url:
        keys.append(hashlib.sha256(page.original_apply_url.strip().lower().encode()).hexdigest()[:64])
    keys = [str(key).strip() for key in keys if key]
    existing = None
    for key in keys:
        existing = db.scalar(
            select(Opportunity).where(
                Opportunity.source_id == source.id,
                Opportunity.source_item_key == key,
            )
        )
        if existing:
            break
    if existing is None and raw.canonical_url:
        existing = db.scalar(
            select(Opportunity).where(
                Opportunity.source_id == source.id,
                Opportunity.source_page_url == raw.canonical_url,
            )
        )
    if existing:
        existing.last_seen_at = seen_at
        existing.missing_count = 0
        existing.raw_document_id = raw.id
        existing.source_content_hash = raw.content_hash


def _reconcile_missing_source_jobs(db: Session, *, source: Source, started_at: datetime, logs: list[str]) -> None:
    if not getattr(source, "is_official_seed_source", False):
        return
    threshold = int((source.settings_json or {}).get("missing_inactive_threshold", 3))
    candidates = db.scalars(
        select(Opportunity).where(
            Opportunity.source_id == source.id,
            Opportunity.first_seen_at.is_not(None),
            (Opportunity.last_seen_at.is_(None)) | (Opportunity.last_seen_at < started_at),
            Opportunity.admin_status.notin_(["archived", "rejected", "hidden"]),
        )
    ).all()
    marked = 0
    for opp in candidates:
        opp.missing_count = (opp.missing_count or 0) + 1
        if opp.missing_count >= threshold:
            opp.admin_status = "inactive"
            opp.is_active = False
            if opp.status == "published":
                opp.status = "expired"
            marked += 1
    if candidates:
        logs.append(f"Missing reconciliation: {len(candidates)} candidates, {marked} marked inactive")


def _overall_score(opp: Opportunity) -> float:
    return (
        0.25 * (opp.trust_score or 0)
        + 0.15 * (opp.freshness_score or 0)
        + 0.20 * (opp.actionability_score or 0)
        + 0.20 * (opp.bangladesh_applicability_score or 0)
        + 0.15 * (opp.rural_user_fit_score or 0)
        + 0.05 * (opp.category_match_score or 0)
    )


def _trust_score(trust: str) -> float:
    return {
        "government_official": 1.0,
        "official_gov": 1.0,
        "official_partner": 0.9,
        "verified_source": 0.75,
        "established_portal": 0.7,
        "news_source": 0.45,
        "news_only": 0.45,
    }.get(trust, 0.4)


def _freshness_score(created_at: datetime, max_days: int = 120) -> float:
    age_days = (datetime.now(UTC) - created_at).days
    return max(0.1, min(1.0, 1.0 - (age_days / max_days)))


def _action_score(has_deadline: bool, has_apply: bool, has_req: bool) -> float:
    return 0.3 + (0.3 if has_deadline else 0) + (0.25 if has_apply else 0) + (0.15 if has_req else 0)


def _country_from_location(location: str | None) -> str | None:
    text_value = (location or "").lower()
    if "saudi" in text_value or text_value == "sa":
        return "Saudi Arabia"
    if "united arab emirates" in text_value or "dubai" in text_value:
        return "United Arab Emirates"
    if "jordan" in text_value or "amman" in text_value:
        return "Jordan"
    return None


def _city_from_location(location: str | None) -> str | None:
    if not location:
        return None
    for city in ["Riyadh", "Jeddah", "Dammam", "Dubai", "Amman"]:
        if city.lower() in location.lower():
            return city
    return None


def _extract_deadline(body: str) -> str | None:
    match = re.search(r"(?:deadline|closing date|apply before)[:\s-]+([^\n]{4,80})", body, re.I)
    return match.group(1).strip() if match else None


def _extract_education(body: str) -> str | None:
    lowered = body.lower()
    for level in ["phd", "master", "bachelor", "diploma", "high school", "secondary"]:
        if level in lowered:
            return level
    return None


def _extract_eligibility_text(body: str) -> str | None:
    return _extract_section_text(body, ["eligibility", "requirements", "qualifications"], max_chars=1200)


def _extract_documents(body: str) -> list[str]:
    section = _extract_section_text(body, ["documents", "passport", "cv", "resume"], max_chars=800) or ""
    return _split_compact_items(section, limit=8)


def _extract_bullets_near(body: str, markers: list[str]) -> list[str]:
    section = _extract_section_text(body, markers, max_chars=1000) or ""
    return _split_compact_items(section, limit=10)


def _extract_language_requirements(body: str) -> list[str]:
    lowered = body.lower()
    found = []
    for language in ["English", "Arabic", "Hindi", "Urdu", "Bangla"]:
        if language.lower() in lowered:
            found.append(language)
    return found


def _extract_section_text(body: str, markers: list[str], *, max_chars: int) -> str | None:
    lowered = body.lower()
    positions = [lowered.find(marker.lower()) for marker in markers if lowered.find(marker.lower()) >= 0]
    if not positions:
        return None
    start = min(positions)
    return body[start:start + max_chars].strip()


def _split_compact_items(text_value: str, *, limit: int) -> list[str]:
    items = []
    for part in re.split(r"[\n;•]+", text_value):
        cleaned = re.sub(r"\s+", " ", part).strip(" -:\t")
        if 5 <= len(cleaned) <= 220 and cleaned.lower() not in {"requirements", "qualifications", "documents"}:
            items.append(cleaned)
        if len(items) >= limit:
            break
    return list(dict.fromkeys(items))


def _update_source_error(db: Session, source: Source, error: str) -> None:
    from app.db.session import SessionLocal

    try:
        with SessionLocal() as new_db:
            src = new_db.get(Source, source.id)
            if not src:
                return
            src.last_error = error
            new_db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


def _enqueue_translation_tasks(opp_ids: list[int]) -> None:
    """Best-effort enqueue of background translation. Never raises — translation
    is non-critical, and the pipeline must succeed even if Celery isn't reachable
    or the worker module isn't importable (e.g. in unit tests without Celery)."""
    if not opp_ids:
        return
    try:
        from worker.tasks import translate_draft_async  # type: ignore[import-not-found]
    except Exception:
        logger.debug("translate_draft_async not importable; skipping enqueue")
        return
    for opp_id in opp_ids:
        try:
            translate_draft_async.delay(opp_id)
        except Exception as exc:
            logger.warning(
                "translate_enqueue_failed",
                extra={"opportunity_id": opp_id, "error": str(exc)},
            )
