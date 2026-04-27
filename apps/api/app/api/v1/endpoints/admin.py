import csv
import io
import re
import unicodedata
from datetime import UTC, datetime, timedelta

import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import case, delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_db
from app.models.entities import (
    AlertEvent,
    AlertRule,
    CrawlJob,
    CrawlRun,
    Opportunity,
    PublishedOpportunity,
    RawDocument,
    Source,
    User,
)
from app.models.enums import CrawlRunStatus, CrawlStatus
from app.schemas.admin import (
    AdminAiSettingsOut,
    AdminAiSettingsUpdate,
    AdminOverviewOut,
    AdminOverviewStats,
    AdminSourceOut,
    BulkImportError,
    BulkImportResult,
    CrawlJobOut,
    CrawlJobPage,
    CrawlRunOut,
    CrawlRunPage,
    DataResetResult,
    FailedExtractionOut,
    FailedExtractionPage,
    PublishedOpportunityOut,
    ReviewQueueOut,
    ReviewQueuePage,
    ReviewStatusUpdate,
    SourceTestResult,
    TriggerAllResult,
)
from app.schemas.common import MessageResponse
from app.schemas.opportunity import RawDocumentOut
from app.schemas.source import SourceCreate, SourceOut, SourceUpdate
from app.services.runtime_settings_service import (
    AI_API_KEY,
    AI_MODEL,
    AI_PROVIDER,
    get_ai_api_key,
    get_ai_model,
    get_ai_provider,
    has_ai_api_key,
    set_setting,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)
STALE_RUNNING_CRAWL_MINUTES = 30


# ── Helpers ────────────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")[:580]


def _serialize_sources(db: Session, sources: list[Source]) -> list[AdminSourceOut]:
    if not sources:
        return []
    source_ids = [s.id for s in sources]

    draft_counts = {
        row.source_id: row
        for row in db.execute(
            select(
                Opportunity.source_id.label("source_id"),
                func.count(Opportunity.id).label("total"),
                func.sum(case((Opportunity.review_status == "pending", 1), else_=0)).label("pending"),
            )
            .where(Opportunity.source_id.in_(source_ids))
            .group_by(Opportunity.source_id)
        )
    }
    pub_counts = {
        row.source_id: int(row.count)
        for row in db.execute(
            select(
                PublishedOpportunity.source_id.label("source_id"),
                func.count(PublishedOpportunity.id).label("count"),
            )
            .where(PublishedOpportunity.source_id.in_(source_ids))
            .group_by(PublishedOpportunity.source_id)
        )
    }
    raw_counts = {
        row.source_id: int(row.count)
        for row in db.execute(
            select(RawDocument.source_id.label("source_id"), func.count(RawDocument.id).label("count"))
            .where(RawDocument.source_id.in_(source_ids))
            .group_by(RawDocument.source_id)
        )
    }
    latest_run_ids = {
        row.source_id: row.max_id
        for row in db.execute(
            select(CrawlRun.source_id.label("source_id"), func.max(CrawlRun.id).label("max_id"))
            .where(CrawlRun.source_id.in_(source_ids))
            .group_by(CrawlRun.source_id)
        )
    }
    latest_runs: dict[int, CrawlRun] = {}
    if latest_run_ids:
        latest_runs = {
            r.id: r for r in db.scalars(select(CrawlRun).where(CrawlRun.id.in_(latest_run_ids.values()))).all()
        }
    # Legacy crawl job fallback
    latest_job_ids = {
        row.source_id: row.max_id
        for row in db.execute(
            select(CrawlJob.source_id.label("source_id"), func.max(CrawlJob.id).label("max_id"))
            .where(CrawlJob.source_id.in_(source_ids))
            .group_by(CrawlJob.source_id)
        )
    }
    latest_jobs: dict[int, CrawlJob] = {}
    if latest_job_ids:
        latest_jobs = {
            j.id: j for j in db.scalars(select(CrawlJob).where(CrawlJob.id.in_(latest_job_ids.values()))).all()
        }

    out: list[AdminSourceOut] = []
    for src in sources:
        dc = draft_counts.get(src.id)
        run = latest_runs.get(latest_run_ids.get(src.id))  # type: ignore[arg-type]
        job = latest_jobs.get(latest_job_ids.get(src.id))  # type: ignore[arg-type]
        # Prefer CrawlRun data; fall back to CrawlJob for legacy sources
        last_status = run.status.value if run else (job.status.value if job else None)
        last_started = run.started_at if run else (job.started_at if job else None)
        last_finished = run.finished_at if run else (job.finished_at if job else None)
        last_fetched = run.discovered_count if run else (job.pages_fetched if job else 0)
        last_extracted = run.draft_created_count if run else (job.records_extracted if job else 0)
        out.append(
            AdminSourceOut(
                id=src.id,
                name=src.name,
                base_url=src.base_url,
                root_url=src.root_url,
                country=src.country,
                country_scope=src.country_scope,
                source_type=src.source_type,
                ingestion_mode=src.ingestion_mode,
                connector_key=src.connector_key,
                trust_level=src.trust_level,
                compliance_status=src.compliance_status,
                crawl_frequency=src.crawl_frequency,
                first_crawl_mode=src.first_crawl_mode,
                target_audience=src.target_audience or [],
                search_keywords=src.search_keywords or [],
                enabled=src.enabled if src.enabled is not None else src.is_active,
                requires_admin_review=src.requires_admin_review,
                    last_attempted_at=src.last_attempted_at,
                last_crawled_at=src.last_crawled_at,
                last_success_at=src.last_success_at,
                last_error=src.last_error,
                created_at=src.created_at,
                updated_at=src.updated_at,
                # Legacy
                source_class=src.source_class.value,
                trust_tier=src.trust_tier.value,
                access_method=src.access_method.value,
                crawl_frequency_minutes=src.crawl_frequency_minutes,
                is_active=src.is_active,
                parser_key=src.parser_key,
                search_queries=src.search_queries or [],
                # Stats
                draft_count=int(dc.total) if dc else 0,
                pending_review_count=int(dc.pending) if dc else 0,
                published_count=pub_counts.get(src.id, 0),
                raw_document_count=raw_counts.get(src.id, 0),
                last_crawl_status=last_status,
                last_crawl_started_at=last_started,
                last_crawl_finished_at=last_finished,
                last_pages_fetched=last_fetched or 0,
                last_records_extracted=last_extracted or 0,
                opportunity_count=int(dc.total) if dc else 0,
                active_opportunity_count=pub_counts.get(src.id, 0),
            )
        )
    return out


def _latest_running_crawl(db: Session, source_id: int) -> CrawlJob | None:
    return db.scalar(
        select(CrawlJob)
        .where(CrawlJob.source_id == source_id, CrawlJob.status == CrawlStatus.running)
        .order_by(CrawlJob.started_at.desc().nullslast(), CrawlJob.id.desc())
    )


def _close_stale_running_crawl(job: CrawlJob) -> bool:
    if not job.started_at:
        return False
    if job.started_at.astimezone(UTC) > datetime.now(UTC) - timedelta(minutes=STALE_RUNNING_CRAWL_MINUTES):
        return False
    job.status = CrawlStatus.failed
    job.finished_at = datetime.now(UTC)
    job.error_message = "Marked failed because the crawl was stuck in running state."
    return True


def _draft_to_review_out(draft: Opportunity, source_name: str | None) -> ReviewQueueOut:
    return ReviewQueueOut(
        id=draft.id,
        title=draft.title,
        title_bn=draft.title_bn,
        opportunity_type=draft.opportunity_type,
        source_id=draft.source_id,
        source_name=source_name or draft.source_name,
        source_page_url=draft.source_page_url or draft.source_url or "",
        document_url=draft.document_url,
        original_apply_url=draft.original_apply_url,
        content_type=draft.content_type,
        country=draft.country,
        destination_country=draft.destination_country,
        employer_or_organization=draft.employer_or_organization or draft.employer or draft.organization,
        deadline=str(draft.deadline) if draft.deadline else None,
        salary_text=draft.salary_text,
        eligibility_status=draft.eligibility_status,
        can_apply_from_bd=draft.can_apply_from_bd,
        requires_existing_work_permit=draft.requires_existing_work_permit,
        open_to_international_candidates=draft.open_to_international_candidates,
        lmia_status=draft.lmia_status,
        summary_bn=draft.summary_bn,
        summary_en=draft.summary_en or draft.summary,
        extraction_confidence=draft.extraction_confidence,
        needs_admin_review=draft.needs_admin_review,
        review_status=draft.review_status,
        reviewed_by=draft.reviewed_by,
        reviewed_at=draft.reviewed_at,
        target_audience_tags=draft.target_audience_tags or [],
        risk_flags=draft.risk_flags or [],
        source_trust_badge=draft.source_trust_badge,
        connector_key=draft.connector_key,
        raw_text=(draft.raw_text or draft.extracted_text or "")[:2000] or None,
        created_at=draft.created_at,
        record_type=draft.record_type.value if draft.record_type else None,
        source_url=draft.source_url,
    )


# ── Overview ───────────────────────────────────────────────────────────────────

@router.get("/overview", response_model=AdminOverviewOut)
def admin_overview(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> AdminOverviewOut:
    now = datetime.now(UTC)
    pending_review = db.scalar(
        select(func.count()).select_from(Opportunity).where(
            Opportunity.needs_admin_review.is_(True),
            Opportunity.review_status.in_(["pending", None]),
        )
    ) or 0
    stats = AdminOverviewStats(
        total_sources=db.scalar(select(func.count()).select_from(Source)) or 0,
        active_sources=db.scalar(select(func.count()).select_from(Source).where(Source.enabled.is_(True))) or 0,
        total_drafts=db.scalar(select(func.count()).select_from(Opportunity)) or 0,
        pending_review=pending_review,
        total_published=db.scalar(select(func.count()).select_from(PublishedOpportunity)) or 0,
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        total_alert_rules=db.scalar(select(func.count()).select_from(AlertRule)) or 0,
        running_crawls=db.scalar(
            select(func.count()).select_from(CrawlRun).where(CrawlRun.status == CrawlRunStatus.running)
        ) or 0,
        failed_crawls_last_24h=db.scalar(
            select(func.count()).select_from(CrawlRun).where(
                CrawlRun.status.in_([CrawlRunStatus.failed, CrawlRunStatus.failed_config]),
                CrawlRun.started_at >= now - timedelta(hours=24),
            )
        ) or 0,
        queued_alert_events=db.scalar(
            select(func.count()).select_from(AlertEvent).where(AlertEvent.status.in_(["pending", "queued"]))
        ) or 0,
        total_opportunities=db.scalar(select(func.count()).select_from(Opportunity)) or 0,
        active_opportunities=db.scalar(
            select(func.count()).select_from(PublishedOpportunity).where(PublishedOpportunity.is_active.is_(True))
        ) or 0,
    )

    recent_job_rows = db.execute(
        select(CrawlJob, Source.name)
        .join(Source, Source.id == CrawlJob.source_id)
        .order_by(CrawlJob.id.desc())
        .limit(8)
    ).all()
    recent_crawls = [
        CrawlJobOut(
            id=j.id, source_id=j.source_id, source_name=n, status=j.status,
            started_at=j.started_at, finished_at=j.finished_at,
            error_message=j.error_message, pages_fetched=j.pages_fetched,
            records_extracted=j.records_extracted,
        )
        for j, n in recent_job_rows
    ]

    recent_run_rows = db.execute(
        select(CrawlRun, Source.name)
        .join(Source, Source.id == CrawlRun.source_id)
        .order_by(CrawlRun.id.desc())
        .limit(8)
    ).all()
    recent_runs = [
        CrawlRunOut(
            id=r.id, source_id=r.source_id, source_name=n,
            connector_key=r.connector_key, source_type=r.source_type,
            ingestion_mode=r.ingestion_mode, crawl_mode=r.crawl_mode,
            status=r.status, discovered_count=r.discovered_count,
            draft_created_count=r.draft_created_count, duplicate_count=r.duplicate_count,
            failed_count=r.failed_count, manual_review_count=r.manual_review_count,
            started_at=r.started_at, finished_at=r.finished_at,
            error_message=r.error_message, logs=r.logs,
        )
        for r, n in recent_run_rows
    ]

    sources = db.scalars(select(Source).order_by(Source.updated_at.desc()).limit(6)).all()
    return AdminOverviewOut(
        stats=stats,
        recent_crawls=recent_crawls,
        recent_runs=recent_runs,
        sources=_serialize_sources(db, sources),
    )


# ── AI Settings ────────────────────────────────────────────────────────────────

@router.get("/settings/ai", response_model=AdminAiSettingsOut)
def ai_settings(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> AdminAiSettingsOut:
    return AdminAiSettingsOut(
        ai_provider=get_ai_provider(db),
        ai_api_key_configured=has_ai_api_key(db),
        ai_model=get_ai_model(db),
    )


@router.patch("/settings/ai", response_model=AdminAiSettingsOut)
def update_ai_settings(
    payload: AdminAiSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminAiSettingsOut:
    provider = payload.ai_provider.strip().lower()
    set_setting(db, AI_PROVIDER, provider)
    if payload.ai_api_key:
        key_name = AI_API_KEY if provider not in {"groq", "mistral"} else ("mistral_api_key" if provider == "mistral" else "groq_api_key")
        set_setting(db, key_name, payload.ai_api_key.strip())
    if payload.ai_model.strip():
        set_setting(db, AI_MODEL, payload.ai_model.strip())
    return AdminAiSettingsOut(
        ai_provider=get_ai_provider(db),
        ai_api_key_configured=has_ai_api_key(db),
        ai_model=get_ai_model(db),
    )


# ── Sources ────────────────────────────────────────────────────────────────────

@router.get("/sources", response_model=list[AdminSourceOut])
def list_sources(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> list[AdminSourceOut]:
    sources = db.scalars(select(Source).order_by(Source.created_at.desc())).all()
    return _serialize_sources(db, sources)


@router.post("/sources", response_model=SourceOut)
def create_source(payload: SourceCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> SourceOut:
    data = payload.model_dump()
    data["base_url"] = str(payload.base_url)
    data["root_url"] = data["base_url"]
    source = Source(**data)
    db.add(source)
    db.commit()
    db.refresh(source)
    logger.info("admin_source_created", extra={"source_id": source.id, "name": source.name})
    return source


@router.patch("/sources/{source_id}", response_model=SourceOut)
def update_source(
    source_id: int,
    payload: SourceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> SourceOut:
    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    data = payload.model_dump(exclude_unset=True)
    if payload.base_url is not None:
        data["base_url"] = str(payload.base_url)
        data.setdefault("root_url", data["base_url"])
    # Sync enabled → is_active
    if "enabled" in data:
        data["is_active"] = data["enabled"]
    for key, value in data.items():
        setattr(source, key, value)
    db.commit()
    db.refresh(source)
    logger.info("admin_source_updated", extra={"source_id": source.id})
    return source


@router.delete("/sources/{source_id}", response_model=MessageResponse)
def delete_source(source_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> MessageResponse:
    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(source)
    db.commit()
    logger.info("admin_source_deleted", extra={"source_id": source_id})
    return MessageResponse(message=f"Source {source_id} deleted")


@router.post("/sources/{source_id}/crawl", response_model=MessageResponse)
def trigger_crawl(
    source_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> MessageResponse:
    from worker.tasks import run_source_crawl

    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    if not (source.enabled if source.enabled is not None else source.is_active):
        raise HTTPException(status_code=409, detail="Source is disabled. Enable it before crawling.")

    running = _latest_running_crawl(db, source_id)
    if running and not _close_stale_running_crawl(running):
        raise HTTPException(status_code=409, detail=f"Crawl #{running.id} is already running.")
    if running:
        db.commit()

    run_source_crawl.delay(source_id, force=force)
    logger.info("admin_crawl_triggered", extra={"source_id": source_id})
    return MessageResponse(message=f"Crawl queued for source {source_id}")


@router.post("/sources/{source_id}/test", response_model=SourceTestResult)
def test_source(source_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> SourceTestResult:
    from app.ingestion.compliance_guard import ComplianceError, check_before_crawl
    from app.ingestion.source_router import get_connector

    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    compliance_warning: str | None = None
    try:
        compliance_warning = check_before_crawl(source)
    except ComplianceError as exc:
        return SourceTestResult(
            source_id=source_id, source_name=source.name, pages_found=0,
            sample_titles=[], compliance_warning=str(exc), error=None,
        )
    try:
        connector = get_connector(source)
        pages = connector.discover_items(source, crawl_mode="preview_only")
        sample_titles = [(p.title or p.url)[:120] for p in pages[:5]]
        return SourceTestResult(
            source_id=source_id, source_name=source.name, pages_found=len(pages),
            sample_titles=sample_titles, compliance_warning=compliance_warning, error=None,
        )
    except Exception as exc:
        return SourceTestResult(
            source_id=source_id, source_name=source.name, pages_found=0,
            sample_titles=[], compliance_warning=compliance_warning, error=str(exc)[:500],
        )


# ── Crawl jobs / runs ─────────────────────────────────────────────────────────

@router.get("/crawl-jobs", response_model=CrawlJobPage)
def crawl_jobs(
    page: int = 1, page_size: int = 20,
    db: Session = Depends(get_db), _: User = Depends(get_admin_user),
) -> CrawlJobPage:
    stmt = select(CrawlJob, Source.name).join(Source, Source.id == CrawlJob.source_id).order_by(CrawlJob.id.desc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return CrawlJobPage(
        items=[
            CrawlJobOut(
                id=j.id, source_id=j.source_id, source_name=n, status=j.status,
                started_at=j.started_at, finished_at=j.finished_at,
                error_message=j.error_message, pages_fetched=j.pages_fetched,
                records_extracted=j.records_extracted,
            )
            for j, n in items
        ],
        total=total, page=page, page_size=page_size,
    )


@router.get("/crawl-runs", response_model=CrawlRunPage)
def crawl_runs(
    page: int = 1, page_size: int = 20, source_id: int | None = None,
    db: Session = Depends(get_db), _: User = Depends(get_admin_user),
) -> CrawlRunPage:
    stmt = select(CrawlRun, Source.name).join(Source, Source.id == CrawlRun.source_id).order_by(CrawlRun.id.desc())
    if source_id:
        stmt = stmt.where(CrawlRun.source_id == source_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return CrawlRunPage(
        items=[
            CrawlRunOut(
                id=r.id, source_id=r.source_id, source_name=n,
                connector_key=r.connector_key, source_type=r.source_type,
                ingestion_mode=r.ingestion_mode, crawl_mode=r.crawl_mode,
                status=r.status, discovered_count=r.discovered_count,
                parsed_count=r.parsed_count, duplicate_count=r.duplicate_count,
                draft_created_count=r.draft_created_count, draft_updated_count=r.draft_updated_count,
                failed_count=r.failed_count, manual_review_count=r.manual_review_count,
                started_at=r.started_at, finished_at=r.finished_at,
                error_message=r.error_message, logs=r.logs,
            )
            for r, n in items
        ],
        total=total, page=page, page_size=page_size,
    )


@router.post("/crawls/trigger-all", response_model=TriggerAllResult)
def trigger_all_crawls(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> TriggerAllResult:
    from worker.tasks import run_source_crawl

    sources = db.scalars(
        select(Source).where(Source.enabled.is_(True))
    ).all()
    queued = 0
    skipped = 0
    for source in sources:
        running = _latest_running_crawl(db, source.id)
        if running and not _close_stale_running_crawl(running):
            skipped += 1
            continue
        run_source_crawl.delay(source.id)
        queued += 1
    db.commit()
    return TriggerAllResult(queued=queued, skipped=skipped)


# ── Review queue ───────────────────────────────────────────────────────────────

@router.get("/review-queue", response_model=ReviewQueuePage)
def review_queue(
    page: int = 1, page_size: int = 20,
    status: str = "pending",
    db: Session = Depends(get_db), _: User = Depends(get_admin_user),
) -> ReviewQueuePage:
    stmt = (
        select(Opportunity, Source.name)
        .join(Source, Source.id == Opportunity.source_id)
        .where(
            Opportunity.needs_admin_review.is_(True),
            Opportunity.review_status.in_([status, None] if status == "pending" else [status]),
        )
        .order_by(Opportunity.created_at.desc())
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return ReviewQueuePage(
        items=[_draft_to_review_out(draft, src_name) for draft, src_name in rows],
        total=total, page=page, page_size=page_size,
    )


@router.post("/review/{draft_id}/approve", response_model=PublishedOpportunityOut)
def approve_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> PublishedOpportunityOut:
    """
    Approve a draft and create/update its PublishedOpportunity row.
    This is the ONLY path that makes content visible to public users.
    """
    draft = db.scalar(select(Opportunity).where(Opportunity.id == draft_id))
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    source = db.scalar(select(Source).where(Source.id == draft.source_id))

    # Mark draft approved
    draft.review_status = "approved"
    draft.is_active = True
    draft.reviewed_by = admin.id
    draft.reviewed_at = datetime.now(UTC)

    # Upsert PublishedOpportunity
    existing_pub = db.scalar(
        select(PublishedOpportunity).where(PublishedOpportunity.draft_id == draft_id)
    )

    slug = _slugify(draft.title or "opportunity") + f"-{draft_id}"

    pub_fields = dict(
        draft_id=draft.id,
        source_id=draft.source_id,
        source_name=draft.source_name or (source.name if source else None),
        source_page_url=draft.source_page_url or draft.source_url or "",
        document_url=draft.document_url,
        original_apply_url=draft.original_apply_url,
        content_type=draft.content_type,
        opportunity_type=draft.opportunity_type,
        title=draft.title,
        title_bn=draft.title_bn,
        summary_bn=draft.summary_bn,
        summary_en=draft.summary_en or draft.summary,
        country=draft.country,
        destination_country=draft.destination_country,
        employer_or_organization=draft.employer_or_organization or draft.employer or draft.organization,
        job_title=draft.job_title,
        sector=draft.sector,
        skill_level=draft.skill_level,
        salary_min=float(draft.salary_min) if draft.salary_min is not None else None,
        salary_max=float(draft.salary_max) if draft.salary_max is not None else None,
        salary_currency=draft.salary_currency,
        salary_text=draft.salary_text,
        location_text=draft.location_text,
        deadline=draft.deadline,
        posted_date=draft.posted_date,
        eligibility_text=draft.eligibility_text,
        required_documents=draft.required_documents,
        application_process=draft.application_process,
        education_requirement=draft.education_requirement,
        experience_requirement=draft.experience_requirement,
        language_requirement=draft.language_requirement,
        age_requirement=draft.age_requirement,
        gender_requirement=draft.gender_requirement,
        visa_or_work_permit_info=draft.visa_or_work_permit_info,
        lmia_status=draft.lmia_status,
        can_apply_from_bd=draft.can_apply_from_bd,
        requires_existing_work_permit=draft.requires_existing_work_permit,
        open_to_international_candidates=draft.open_to_international_candidates,
        open_to_authorized_workers_only=draft.open_to_authorized_workers_only,
        eligibility_status=draft.eligibility_status,
        target_audience_tags=draft.target_audience_tags or [],
        risk_flags=draft.risk_flags or [],
        source_trust_badge=draft.source_trust_badge,
        extraction_confidence=draft.extraction_confidence,
        connector_key=draft.connector_key,
        trust_score=draft.trust_score,
        freshness_score=draft.freshness_score,
        actionability_score=draft.actionability_score,
        overall_rank_score=draft.overall_rank_score,
        slug=slug,
        is_active=True,
        published_at=datetime.now(UTC),
    )

    if existing_pub:
        for k, v in pub_fields.items():
            setattr(existing_pub, k, v)
        pub = existing_pub
    else:
        pub = PublishedOpportunity(**pub_fields)
        db.add(pub)

    db.flush()

    # Build search_tsv for the published row
    db.execute(
        text(
            "UPDATE published_opportunities "
            "SET search_tsv = to_tsvector('simple', "
            "coalesce(title,'') || ' ' || coalesce(summary_bn,'') || ' ' || coalesce(eligibility_text,'')) "
            "WHERE id = :id"
        ),
        {"id": pub.id},
    )

    db.commit()
    db.refresh(pub)
    logger.info("admin_draft_approved", extra={"draft_id": draft_id, "published_id": pub.id})

    return PublishedOpportunityOut(
        id=pub.id, draft_id=pub.draft_id, title=pub.title,
        opportunity_type=pub.opportunity_type, country=pub.country,
        source_name=pub.source_name, can_apply_from_bd=pub.can_apply_from_bd,
        published_at=pub.published_at, is_active=pub.is_active,
    )


@router.post("/review/{draft_id}/reject", response_model=ReviewQueueOut)
def reject_draft(
    draft_id: int,
    payload: ReviewStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> ReviewQueueOut:
    draft = db.scalar(select(Opportunity).where(Opportunity.id == draft_id))
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft.review_status = "rejected"
    draft.is_active = False
    draft.reviewed_by = admin.id
    draft.reviewed_at = datetime.now(UTC)

    # Deactivate any published version
    pub = db.scalar(select(PublishedOpportunity).where(PublishedOpportunity.draft_id == draft_id))
    if pub:
        pub.is_active = False

    db.commit()
    source_name = db.scalar(select(Source.name).where(Source.id == draft.source_id))
    logger.info("admin_draft_rejected", extra={"draft_id": draft_id})
    return _draft_to_review_out(draft, source_name)


@router.post("/review/{draft_id}/needs-manual-fix", response_model=ReviewQueueOut)
def needs_manual_fix(
    draft_id: int,
    payload: ReviewStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> ReviewQueueOut:
    draft = db.scalar(select(Opportunity).where(Opportunity.id == draft_id))
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    draft.review_status = "needs_manual_fix"
    draft.is_active = False
    draft.reviewed_by = admin.id
    draft.reviewed_at = datetime.now(UTC)
    db.commit()
    source_name = db.scalar(select(Source.name).where(Source.id == draft.source_id))
    logger.info("admin_draft_needs_fix", extra={"draft_id": draft_id})
    return _draft_to_review_out(draft, source_name)


@router.patch("/opportunities/{opportunity_id}/review-status", response_model=ReviewQueueOut)
def set_review_status(
    opportunity_id: int,
    payload: ReviewStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> ReviewQueueOut:
    """Legacy single-endpoint for approve/reject/needs_manual_fix (used by old frontend)."""
    valid = {"approved", "rejected", "needs_manual_fix"}
    if payload.status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of: {valid}")

    if payload.status == "approved":
        return approve_draft(opportunity_id, db=db, admin=admin)
    elif payload.status == "rejected":
        return reject_draft(opportunity_id, payload=payload, db=db, admin=admin)
    else:
        return needs_manual_fix(opportunity_id, payload=payload, db=db, admin=admin)


@router.patch("/review/{draft_id}", response_model=ReviewQueueOut)
def edit_draft(
    draft_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> ReviewQueueOut:
    """Allow admin to correct fields before approving."""
    draft = db.scalar(select(Opportunity).where(Opportunity.id == draft_id))
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")

    editable = {
        "title", "title_bn", "summary_bn", "summary_en",
        "country", "destination_country", "employer_or_organization",
        "job_title", "deadline", "salary_text", "eligibility_text",
        "lmia_status", "can_apply_from_bd", "eligibility_status",
        "requires_existing_work_permit", "open_to_international_candidates",
        "visa_or_work_permit_info", "application_process",
    }
    for field, value in payload.items():
        if field in editable:
            setattr(draft, field, value)

    db.commit()
    source_name = db.scalar(select(Source.name).where(Source.id == draft.source_id))
    return _draft_to_review_out(draft, source_name)


# ── Published opportunities ────────────────────────────────────────────────────

@router.get("/published", response_model=list[PublishedOpportunityOut])
def list_published(
    page: int = 1, page_size: int = 20,
    db: Session = Depends(get_db), _: User = Depends(get_admin_user),
) -> list[PublishedOpportunityOut]:
    pubs = db.scalars(
        select(PublishedOpportunity)
        .where(PublishedOpportunity.is_active.is_(True))
        .order_by(PublishedOpportunity.published_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [
        PublishedOpportunityOut(
            id=p.id, draft_id=p.draft_id, title=p.title,
            opportunity_type=p.opportunity_type, country=p.country,
            source_name=p.source_name, can_apply_from_bd=p.can_apply_from_bd,
            published_at=p.published_at, is_active=p.is_active,
        )
        for p in pubs
    ]


# ── Bulk import ────────────────────────────────────────────────────────────────

@router.post("/sources/bulk-import", response_model=BulkImportResult)
def bulk_import_sources(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> BulkImportResult:
    content = file.file.read()
    filename = (file.filename or "").lower()

    errors: list[BulkImportError] = []
    created = 0
    skipped = 0

    if filename.endswith(".xlsx"):
        try:
            import openpyxl
        except ImportError:
            raise HTTPException(status_code=500, detail="openpyxl not installed")
        wb = openpyxl.load_workbook(io.BytesIO(content))
        ws = wb.active
        rows_iter = ws.iter_rows(values_only=True)
        headers = [str(h).strip() if h is not None else "" for h in next(rows_iter)]
        raw_rows = [dict(zip(headers, [str(v).strip() if v is not None else "" for v in row])) for row in rows_iter]
    else:
        raw_rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))

    for idx, row in enumerate(raw_rows, start=2):
        name = row.get("name", "").strip()
        base_url = row.get("base_url", "").strip() or row.get("root_url", "").strip()
        if not name or not base_url:
            errors.append(BulkImportError(row=idx, detail="Missing required columns: name, base_url"))
            continue
        try:
            ta_raw = row.get("target_audience") or ""
            kw_raw = row.get("search_keywords") or row.get("search_queries") or ""
            payload = SourceCreate(
                name=name,
                base_url=base_url,  # type: ignore[arg-type]
                country=row.get("country") or "Bangladesh",
                source_type=row.get("source_type") or None,
                ingestion_mode=row.get("ingestion_mode") or None,
                connector_key=row.get("connector_key") or None,
                country_scope=row.get("country_scope") or None,
                target_audience=[t.strip() for t in ta_raw.split(",") if t.strip()],
                search_keywords=[k.strip() for k in kw_raw.split(",") if k.strip()],
                trust_level=row.get("trust_level") or None,
                compliance_status=row.get("compliance_status") or "unknown",
                crawl_frequency=row.get("crawl_frequency") or "daily",
                first_crawl_mode=row.get("first_crawl_mode") or "active_only",
                requires_admin_review=str(row.get("requires_admin_review", "true")).lower() in ("true", "1", "yes"),
                enabled=str(row.get("enabled", row.get("is_active", "true"))).lower() not in ("false", "0", "no"),
            )
        except Exception as exc:
            errors.append(BulkImportError(row=idx, detail=str(exc)))
            continue
        data = payload.model_dump()
        data["base_url"] = str(payload.base_url)
        data["root_url"] = data["base_url"]
        src = Source(**data)
        db.add(src)
        try:
            db.flush()
            created += 1
        except IntegrityError:
            db.rollback()
            skipped += 1

    db.commit()
    return BulkImportResult(created=created, skipped=skipped, errors=errors)


# ── Reindex / reset ────────────────────────────────────────────────────────────

@router.post("/reindex/{opportunity_id}", response_model=MessageResponse)
def reindex(opportunity_id: int, _: User = Depends(get_admin_user)) -> MessageResponse:
    from worker.tasks import reindex_opportunity
    reindex_opportunity.delay(opportunity_id)
    return MessageResponse(message=f"Reindex queued for opportunity {opportunity_id}")


@router.post("/reindex-all")
def reindex_all(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> dict:
    from worker.tasks import reindex_opportunity
    ids = db.scalars(select(Opportunity.id)).all()
    for oid in ids:
        reindex_opportunity.delay(oid)
    return {"queued": len(ids)}


@router.post("/reset-all-data", response_model=DataResetResult)
def reset_all_data(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> DataResetResult:
    from app.models.entities import OpportunityEmbedding, PublishedOpportunityEmbedding

    n_pub_emb = db.scalar(select(func.count()).select_from(PublishedOpportunityEmbedding)) or 0
    db.execute(delete(PublishedOpportunityEmbedding))
    n_pub = db.scalar(select(func.count()).select_from(PublishedOpportunity)) or 0
    db.execute(delete(PublishedOpportunity))
    n_emb = db.scalar(select(func.count()).select_from(OpportunityEmbedding)) or 0
    db.execute(delete(OpportunityEmbedding))
    n_opp = db.scalar(select(func.count()).select_from(Opportunity)) or 0
    db.execute(delete(Opportunity))
    n_raw = db.scalar(select(func.count()).select_from(RawDocument)) or 0
    db.execute(delete(RawDocument))
    n_runs = db.scalar(select(func.count()).select_from(CrawlRun)) or 0
    db.execute(delete(CrawlRun))
    n_jobs = db.scalar(select(func.count()).select_from(CrawlJob)) or 0
    db.execute(delete(CrawlJob))
    n_src = db.scalar(select(func.count()).select_from(Source)) or 0
    db.execute(delete(Source))
    db.commit()
    logger.warning(
        "admin_reset_all_data",
        extra={"sources": n_src, "drafts": n_opp, "published": n_pub},
    )
    return DataResetResult(
        deleted_published=n_pub, deleted_drafts=n_opp,
        deleted_raw_documents=n_raw, deleted_crawl_runs=n_runs,
        deleted_crawl_jobs=n_jobs, deleted_sources=n_src,
        deleted_opportunities=n_opp,
    )


# ── Raw documents ──────────────────────────────────────────────────────────────

@router.get("/raw-documents/{doc_id}", response_model=RawDocumentOut)
def raw_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> RawDocumentOut:
    doc = db.scalar(select(RawDocument).where(RawDocument.id == doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Raw document not found")
    return doc


# ── Legacy failed-extractions endpoint (backward compat for old frontend) ──────

@router.get("/failed-extractions", response_model=FailedExtractionPage)
def failed_extractions(
    page: int = 1, page_size: int = 20,
    db: Session = Depends(get_db), _: User = Depends(get_admin_user),
) -> FailedExtractionPage:
    stmt = (
        select(Opportunity, Source.name)
        .join(Source, Source.id == Opportunity.source_id)
        .where(Opportunity.extraction_confidence < 0.45)
        .order_by(Opportunity.updated_at.desc())
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return FailedExtractionPage(
        items=[
            FailedExtractionOut(
                id=o.id, title=o.title, record_type=o.record_type,
                source_id=o.source_id, source_name=n,
                source_url=o.source_url or o.source_page_url or "",
                extraction_confidence=o.extraction_confidence, updated_at=o.updated_at,
            )
            for o, n in items
        ],
        total=total, page=page, page_size=page_size,
    )
