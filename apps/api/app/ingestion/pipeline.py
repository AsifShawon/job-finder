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
from app.ingestion.parsers.registry import get_parser
from app.ingestion.pdf_extractor import download_pdf, extract_text as pdf_extract_text
from app.ingestion.source_router import get_connector
from app.ingestion.validators import (
    find_existing_opportunity,
    is_latest_snapshot_duplicate,
    parse_deadline,
    validate_extraction,
)
from app.models.entities import CrawlJob, CrawlRun, Opportunity, RawDocument, Source
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
        raw_html_path=raw_path,
        metadata_json=page.metadata,
        content_hash=raw_hash or "unknown",
        crawl_run_id=crawl_run.id,
    )
    db.add(raw)
    db.flush()

    if snapshot_duplicate:
        result.duplicates += 1
        logs.append(f"Skipped unchanged page: {canonical_url}")
        return

    if _should_reject_as_news(cleaned):
        logs.append(f"Pre-filter rejected news article: '{(cleaned.get('title') or '')[:80]}'")
        return

    extractions = _extract_records_for_page(db, source, page, cleaned)
    if not extractions:
        if source.connector_key != "search_html_jobs":
            result.failed += 1
        return

    extracted_any = False
    for extraction in extractions:
        errors = validate_extraction(extraction)
        if errors or extraction.record_type == "unknown":
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
    if source.connector_key == "search_html_jobs":
        if page.content_type == "linkout_only":
            title = page.title or cleaned.get("title") or page.url
            snippet = (page.metadata or {}).get("search_snippet")
            return [summarize_linkout_job(db, title=title, snippet=snippet, url=page.url)]
        max_jobs = max(1, source.max_jobs_per_page or 10)
        return extract_jobs_structured(db, cleaned, max_jobs=max_jobs)

    extraction = extract_structured(db, cleaned)
    return [extraction] if extraction.record_type != "unknown" else []


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

    existing = find_existing_opportunity(
        db,
        source_id=source.id,
        source_item_key=item_key,
        content_hash=opp_hash,
    )

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

    ocr_used = getattr(page, "ocr_used", False)
    force_review = bool(ocr_used or source.requires_admin_review)
    now = datetime.now(UTC)

    if existing:
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
        )
        result.draft_updated += 1
        result.duplicates += 1
        logs.append(f"Draft updated: id={existing.id} title='{(existing.title or '')[:60]}'")
        return

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
        degree_level=extraction.degree_level,
        salary_min=extraction.salary_min,
        salary_max=extraction.salary_max,
        salary_currency=extraction.salary_currency,
        deadline=parse_deadline(extraction.deadline_text),
        application_url=application_url,
        eligibility_text=extraction.eligibility_text,
        visa_support=extraction.visa_support,
        journey_steps=extraction.journey_steps,
        documents_needed=extraction.documents_needed,
        typical_salary_bdt=extraction.typical_salary_bdt,
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
        needs_admin_review=True,
        review_status="pending",
        status="pending",
        is_active=False,
        content_hash=opp_hash,
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
    )
    draft.overall_rank_score = 0.25 * draft.trust_score + 0.2 * draft.freshness_score + 0.1 * draft.actionability_score

    db.add(draft)
    db.flush()

    result.draft_created += 1
    if force_review:
        result.manual_review += 1

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
    draft.degree_level = extraction.degree_level
    draft.salary_min = extraction.salary_min
    draft.salary_max = extraction.salary_max
    draft.salary_currency = extraction.salary_currency
    draft.deadline = parse_deadline(extraction.deadline_text)
    draft.application_url = application_url
    draft.eligibility_text = extraction.eligibility_text
    draft.visa_support = extraction.visa_support
    draft.journey_steps = extraction.journey_steps
    draft.documents_needed = extraction.documents_needed
    draft.typical_salary_bdt = extraction.typical_salary_bdt
    draft.language_requirements_json = {"items": extraction.language_requirements}
    draft.requirements_json = {"items": extraction.requirements}
    draft.benefits_json = {"items": extraction.benefits}
    draft.lmia_status = eligibility.lmia_status
    draft.can_apply_from_bd = eligibility.can_apply_from_bd
    draft.requires_existing_work_permit = eligibility.requires_existing_work_permit
    draft.open_to_international_candidates = eligibility.open_to_international_candidates
    draft.open_to_authorized_workers_only = eligibility.open_to_authorized_workers_only
    draft.eligibility_status = eligibility.eligibility_status
    draft.target_audience_tags = eligibility.target_audience_tags
    draft.risk_flags = eligibility.risk_flags
    draft.source_trust_badge = trust_badge
    draft.extraction_confidence = extraction.extraction_confidence
    draft.content_hash = opp_hash
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
    draft.overall_rank_score = 0.25 * draft.trust_score + 0.2 * draft.freshness_score + 0.1 * draft.actionability_score
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
