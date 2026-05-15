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

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ingestion.cleaner import clean_page
from app.ingestion.compliance_guard import ComplianceError, check_before_crawl
from app.ingestion.eligibility_engine import tag_eligibility
from app.ingestion.errors import ConnectorNotImplementedError, SourceConfigError
from app.ingestion.extractor import extract_jobs_structured, extract_structured, summarize_linkout_job
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
    error: str | None = None
    # IDs of drafts that should be auto-translated after the pipeline commits.
    pending_translation_ids: list[int] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.pending_translation_ids is None:
            self.pending_translation_ids = []

    @property
    def records_extracted(self) -> int:
        return self.draft_created + self.draft_updated


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

        if result.pages_fetched == 0 and result.failed == 0 and result.records_extracted == 0:
            if (source.compliance_status or "").lower() == "linkout_only":
                run.status = CrawlRunStatus.linkout_only_skipped
            else:
                run.status = CrawlRunStatus.success_empty
        else:
            run.status = CrawlRunStatus.success if result.failed == 0 else CrawlRunStatus.partial_success
        run.finished_at = datetime.now(UTC)
        run.discovered_count = result.pages_fetched
        run.draft_created_count = result.draft_created
        run.draft_updated_count = result.draft_updated
        run.duplicate_count = result.duplicates
        run.unchanged_count = result.unchanged
        run.skipped_count = result.skipped
        run.failed_count = result.failed
        run.manual_review_count = result.manual_review
        run.logs = {"messages": logs}

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
        run.logs = {"messages": logs + [f"Fatal error: {err_msg}"]}
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
        raw.skip_reason = "no_extractable_opportunity"
        result.skipped += 1
        if source.connector_key != "search_html_jobs":
            result.failed += 1
        return

    extracted_any = False
    for extraction in extractions:
        errors = validate_extraction(extraction)
        if errors or extraction.record_type == "unknown":
            raw.skip_reason = "; ".join(errors) if errors else "unknown_record_type"
            result.skipped += 1
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
        raw.skip_reason = skip_reason
        raw.detected_item_type = detected_item_type
        result.skipped += 1
        logs.append(f"Skipped {source_page_url}: {skip_reason}")
        return

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

    # Embedding for semantic cross-source dedup. Computed lazily — only when
    # there's no exact hash match (otherwise we already know it's a dupe).
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
                # Only treat as duplicate if it's from a *different* source (otherwise
                # find_existing_opportunity would have caught it via content_hash).
                if semantic_match and semantic_match.source_id == source.id:
                    semantic_match = None
        except Exception as exc:
            logger.warning("semantic_dedup_failed", extra={"error": str(exc)})
            semantic_match = None

    if semantic_match is not None:
        # Same job listed on a new source. Don't create a draft — just record the
        # mirror URL on the canonical row so the public page can deep-link both.
        if merge_mirror_url(semantic_match, source_page_url):
            logs.append(
                f"Semantic dedup: merged {source_page_url} into canonical opportunity #{semantic_match.id}"
            )
        result.duplicates += 1
        return

    eligibility = tag_eligibility(
        source_connector_key=source.connector_key,
        source_trust_level=source.trust_level,
        record_type=extraction.record_type,
        country=extraction.country or source.country,
        eligibility_text=extraction.eligibility_text,
        requirements_json={"items": extraction.requirements},
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
        )
        if old_source_hash == raw.content_hash:
            result.unchanged += 1
        else:
            result.draft_updated += 1
        result.duplicates += 1
        result.pending_translation_ids.append(existing.id)
        logs.append(f"Draft updated: id={existing.id} title='{(existing.title or '')[:60]}'")
        return

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
        requirements_json={"items": extraction.requirements},
        benefits_json={"items": extraction.benefits},
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
    draft.actionability_score = suitability.actionability_score
    draft.overall_rank_score = _overall_score(draft)

    db.add(draft)
    db.flush()

    result.draft_created += 1
    if draft.needs_admin_review:
        result.manual_review += 1
    result.pending_translation_ids.append(draft.id)

    # Persist the embedding alongside the draft so semantic dedup catches
    # future duplicates (and so the RAG copilot can retrieve over the corpus
    # once the draft is approved).
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
    draft.requirements_json = {"items": extraction.requirements}
    draft.benefits_json = {"items": extraction.benefits}
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
    draft.actionability_score = suitability.actionability_score
    draft.overall_rank_score = _overall_score(draft)
    draft.last_seen_at = now
    draft.first_seen_at = draft.first_seen_at or now
    draft.missing_count = 0
    if draft.admin_status in {"inactive"} and draft.status != "published":
        draft.admin_status = "needs_review"
    draft.updated_at = now
    _refresh_search_tsv(db, draft.id)


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
