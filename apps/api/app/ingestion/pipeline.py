"""
Ingestion pipeline.

Flow:
  Source → ComplianceGuard → CrawlRun created
       → SourceRouter → Connector.discover_items()
       → for each FetchedPage:
           → PDF extraction (if needed)
           → parse + clean
           → raw-doc dedup
           → LLM extraction
           → eligibility_engine
           → content_hash dedup
           → save/update OpportunityDraft (review_status='pending')
  → CrawlRun finished

CRITICAL: Nothing in this pipeline sets review_status='approved' or creates
a PublishedOpportunity. All items MUST go through admin review first.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.ingestion.cleaner import clean_page
from app.core.config import get_settings
from app.ingestion.compliance_guard import ComplianceError, check_before_crawl
from app.ingestion.eligibility_engine import tag_eligibility
from app.ingestion.errors import ConnectorNotImplementedError, SourceConfigError
from app.ingestion.extractor import extract_structured
from app.ingestion.parsers.registry import get_parser
from app.ingestion.pdf_extractor import download_pdf, extract_text as pdf_extract_text
from app.ingestion.source_router import get_connector
from app.ingestion.validators import is_duplicate, is_opportunity_duplicate, parse_deadline, validate_extraction
from app.models.entities import CrawlJob, CrawlRun, Opportunity, RawDocument, Source
from app.models.enums import CrawlRunStatus, CrawlStatus
from app.services.storage_service import ObjectStorage

logger = logging.getLogger(__name__)

_PDF_CONTENT_TYPES = {"pdf", "image_pdf"}


@dataclass
class PipelineResult:
    pages_fetched: int = 0
    draft_created: int = 0
    draft_updated: int = 0
    duplicates: int = 0
    failed: int = 0
    manual_review: int = 0
    error: str | None = None

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


def _trust_badge_for_source(source: Source) -> str | None:
    trust = source.trust_level or ""
    if trust == "government_official":
        return "সরকারি উৎস"
    if trust == "official_partner":
        return "অফিসিয়াল পার্টনার"
    if trust == "verified_source":
        return "যাচাইকৃত উৎস"
    return None


def run_source_ingestion(db: Session, source_id: int, *, force: bool = False) -> PipelineResult:
    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise ValueError(f"Source {source_id} not found")

    # Use enabled flag (new) with fallback to legacy is_active
    if not (source.enabled if source.enabled is not None else source.is_active):
        logger.info("pipeline_source_disabled", extra={"source_id": source_id})
        return PipelineResult(error="Source is disabled")

    # ── Prevent duplicate concurrent runs ─────────────────────────────────────
    running_run = db.scalar(
        select(CrawlRun).where(
            CrawlRun.source_id == source.id,
            CrawlRun.status == CrawlRunStatus.running,
        )
    )
    if running_run:
        return PipelineResult(error=f"CrawlRun #{running_run.id} already running")

    # ── Create CrawlRun ───────────────────────────────────────────────────────
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
    # Also create legacy CrawlJob for backward compat with admin pages
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

    # ── Compliance guard ──────────────────────────────────────────────────────
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
        logger.warning(
            "pipeline_compliance_block",
            extra={"source_id": source_id, "error": str(exc), "code": exc.code},
        )
        return PipelineResult(error=str(exc))

    if settings.crawler_smoke_mode:
        run.status = CrawlRunStatus.success_empty
        run.finished_at = datetime.now(UTC)
        run.discovered_count = 0
        run.logs = {"messages": logs + ["Smoke mode enabled; no discovery executed."]}

        legacy_job.status = CrawlStatus.success
        legacy_job.finished_at = datetime.now(UTC)
        legacy_job.pages_fetched = 0
        legacy_job.records_extracted = 0

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
        result.pages_fetched = len(pages)
        logs.append(f"Discovered {len(pages)} pages")

        for page in pages:
            try:
                _process_page(
                    db=db,
                    page=page,
                    source=source,
                    storage=storage,
                    parser=parser,
                    trust_badge=trust_badge,
                    result=result,
                    logs=logs,
                )
            except Exception as exc:
                result.failed += 1
                logs.append(f"Failed page {page.url}: {exc}")
                logger.warning(
                    "pipeline_page_error",
                    extra={"source_id": source_id, "url": page.url, "error": str(exc)},
                )

        # ── Mark CrawlRun complete ─────────────────────────────────────────────
        if result.pages_fetched == 0 and result.failed == 0 and result.draft_created == 0 and result.draft_updated == 0:
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
        run.failed_count = result.failed
        run.manual_review_count = result.manual_review
        run.logs = {"messages": logs}

        legacy_job.status = CrawlStatus.success
        legacy_job.finished_at = datetime.now(UTC)
        legacy_job.pages_fetched = result.pages_fetched
        legacy_job.records_extracted = result.draft_created + result.draft_updated

        if run.status in (CrawlRunStatus.success, CrawlRunStatus.partial_success, CrawlRunStatus.success_empty):
            source.last_crawled_at = datetime.now(UTC)
            source.last_success_at = datetime.now(UTC)
            source.last_error = None

        db.commit()
        logger.info(
            "pipeline_complete",
            extra={
                "source_id": source_id,
                "pages": result.pages_fetched,
                # 'created' is a reserved LogRecord attribute; avoid collision
                "drafts_created": result.draft_created,
                "updated": result.draft_updated,
                "dupes": result.duplicates,
                "failed": result.failed,
            },
        )
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
    storage: ObjectStorage,
    parser,
    trust_badge: str | None,
    result: PipelineResult,
    logs: list[str],
) -> None:
    # ── 1. PDF extraction ─────────────────────────────────────────────────────
    if page.content_type in _PDF_CONTENT_TYPES:
        pdf_url = page.document_url or page.url
        pdf_bytes = download_pdf(pdf_url)
        pdf_result = pdf_extract_text(pdf_bytes)
        page.raw_text = pdf_result.text
        page.content_type = pdf_result.content_type
        page.ocr_used = pdf_result.used_ocr

    # ── 2. Parse + clean ──────────────────────────────────────────────────────
    parsed = parser(page)
    cleaned = clean_page(page)
    cleaned["title"] = parsed.get("title") or cleaned.get("title")

    # ── 3. Raw-document dedup ─────────────────────────────────────────────────
    canon_url = cleaned.get("canonical_url")
    raw_hash = cleaned.get("content_hash", "")
    raw_title = cleaned.get("title") or ""
    if is_duplicate(db, canon_url, raw_hash, raw_title):
        result.duplicates += 1
        return

    # ── 4. Store RawDocument ──────────────────────────────────────────────────
    raw_path = storage.put_text(page.url, page.raw_html or page.raw_text or "")
    raw = RawDocument(
        source_id=source.id,
        source_url=page.url,
        canonical_url=canon_url,
        content_type=page.content_type,
        raw_text=cleaned.get("body_text"),
        raw_html_path=raw_path,
        metadata_json=page.metadata,
        content_hash=raw_hash or "unknown",
    )
    db.add(raw)
    db.flush()

    # ── 5. LLM extraction ─────────────────────────────────────────────────────
    try:
        extraction = extract_structured(db, cleaned)
    except Exception as exc:
        logs.append(f"LLM extraction failed for {page.url}: {exc}")
        result.failed += 1
        return

    errors = validate_extraction(extraction)
    if errors or extraction.record_type == "unknown":
        result.failed += 1
        return

    # ── 6. Content-hash dedup ────────────────────────────────────────────────
    opp_hash = _content_hash(
        title=extraction.title,
        source_id=source.id,
        deadline=extraction.deadline_text,
        source_page_url=page.source_page_url or page.url,
        document_url=page.document_url,
        original_apply_url=getattr(page, "original_apply_url", None),
    )

    existing = db.scalar(select(Opportunity).where(Opportunity.content_hash == opp_hash))
    if existing:
        # Update the existing draft's last-seen timestamp only
        existing.updated_at = datetime.now(UTC)
        result.draft_updated += 1
        result.duplicates += 1
        db.flush()
        return

    # ── 7. Eligibility tagging ────────────────────────────────────────────────
    eligibility = tag_eligibility(
        source_connector_key=source.connector_key,
        source_trust_level=source.trust_level,
        record_type=extraction.record_type,
        country=extraction.country or source.country,
        eligibility_text=extraction.eligibility_text,
        requirements_json={"items": extraction.requirements},
        title=extraction.title,
        summary=extraction.summary,
        employer=extraction.employer,
    )

    # ── 8. Build OpportunityDraft ─────────────────────────────────────────────
    # Force OCR items and source.requires_admin_review items to manual review
    ocr_used = getattr(page, "ocr_used", False)
    force_review = bool(ocr_used or source.requires_admin_review)

    # ALL crawled items are pending — never set is_active=True from the pipeline
    draft = Opportunity(
        source_id=source.id,
        source_name=source.name,
        source_page_url=page.source_page_url or page.url,
        source_url=page.source_page_url or page.url,   # legacy alias
        document_url=page.document_url,
        original_apply_url=getattr(page, "original_apply_url", None),
        content_type=page.content_type,

        opportunity_type=eligibility.opportunity_type,
        title=extraction.title or "Untitled",
        summary=extraction.summary,
        summary_bn=None,   # Set by LLM translation task or admin
        summary_en=extraction.summary,

        country=extraction.country or source.country,
        destination_country=None,
        employer_or_organization=extraction.employer or extraction.organization,
        employer=extraction.employer,
        organization=extraction.organization,
        sector=extraction.sector,
        degree_level=extraction.degree_level,

        salary_min=extraction.salary_min,
        salary_max=extraction.salary_max,
        salary_currency=extraction.salary_currency,

        deadline=parse_deadline(extraction.deadline_text),
        application_url=extraction.application_url,
        eligibility_text=extraction.eligibility_text,
        visa_support=extraction.visa_support,
        language_requirements_json={"items": extraction.language_requirements},
        requirements_json={"items": extraction.requirements},
        benefits_json={"items": extraction.benefits},

        lmia_status=eligibility.lmia_status,
        can_apply_from_bd=eligibility.can_apply_from_bd,
        requires_existing_work_permit=eligibility.requires_existing_work_permit,
        open_to_international_candidates=eligibility.open_to_international_candidates,
        open_to_authorized_workers_only=eligibility.open_to_authorized_workers_only,
        eligibility_status=eligibility.eligibility_status,
        target_audience_tags=eligibility.target_audience_tags,
        risk_flags=eligibility.risk_flags,
        source_trust_badge=trust_badge,

        extraction_confidence=extraction.extraction_confidence,
        needs_admin_review=True,           # Always true for crawled content
        review_status="pending",           # NEVER set to approved from here
        is_active=False,                   # Stays False until admin approves

        content_hash=opp_hash,
        raw_text=(page.raw_text or "")[:10_000] or None,
        raw_document_id=raw.id,
        connector_key=source.connector_key,
        record_type=extraction.record_type,

        # Scoring (used for ranking after approval)
        trust_score=_trust_score(source.trust_level or source.trust_tier.value if source.trust_tier else ""),
        freshness_score=_freshness_score(datetime.now(UTC)),
        actionability_score=_action_score(
            has_deadline=bool(extraction.deadline_text),
            has_apply=bool(extraction.application_url),
            has_req=bool(extraction.requirements),
        ),
    )
    draft.overall_rank_score = (
        0.25 * draft.trust_score + 0.2 * draft.freshness_score + 0.1 * draft.actionability_score
    )
    draft.extraction_confidence = extraction.extraction_confidence

    db.add(draft)
    db.flush()

    # Update TSV for future full-text search (on approval)
    db.execute(
        text(
            "UPDATE opportunities "
            "SET search_tsv = to_tsvector('simple', "
            "coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(eligibility_text,'')) "
            "WHERE id = :id"
        ),
        {"id": draft.id},
    )

    result.draft_created += 1
    if force_review:
        result.manual_review += 1

    logs.append(f"Draft created: id={draft.id} title='{draft.title[:60]}'")


# ── Score helpers ─────────────────────────────────────────────────────────────

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


def _update_source_error(db: Session, source: Source, error: str) -> None:
    # Avoid committing on a possibly aborted session. Use a fresh session
    # so that updating the Source.last_error does not fail when the
    # current transaction is already in an aborted state.
    from app.db.session import SessionLocal

    try:
        with SessionLocal() as new_db:
            src = new_db.get(Source, source.id)
            if not src:
                return
            src.last_error = error
            new_db.commit()
    except Exception:
        # Best-effort: don't raise from here as this function is called
        # during error handling — avoid masking the original exception.
        try:
            db.rollback()
        except Exception:
            pass
