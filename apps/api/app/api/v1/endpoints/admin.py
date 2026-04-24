from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session
import structlog

from app.core.deps import get_admin_user
from app.db.session import get_db
from app.models.entities import AlertEvent, AlertRule, CrawlJob, Opportunity, RawDocument, Source, User
from app.models.enums import CrawlStatus
from app.schemas.admin import (
    AdminAiSettingsOut,
    AdminAiSettingsUpdate,
    AdminOverviewOut,
    AdminOverviewStats,
    AdminSourceOut,
    CrawlJobOut,
    CrawlJobPage,
    FailedExtractionOut,
    FailedExtractionPage,
)
from app.schemas.common import MessageResponse
from app.schemas.opportunity import RawDocumentOut
from app.schemas.source import SourceCreate, SourceOut, SourceUpdate
from app.services.runtime_settings_service import (
    GROQ_API_KEY,
    GROQ_MODEL,
    get_groq_model,
    has_groq_api_key,
    set_setting,
)

router = APIRouter(prefix="/admin", tags=["admin"])
logger = structlog.get_logger(__name__)
STALE_RUNNING_CRAWL_MINUTES = 30


def _serialize_sources(db: Session, sources: list[Source]) -> list[AdminSourceOut]:
    if not sources:
        return []

    source_ids = [source.id for source in sources]

    opportunity_counts = {
        row.source_id: row
        for row in db.execute(
            select(
                Opportunity.source_id.label("source_id"),
                func.count(Opportunity.id).label("opportunity_count"),
                func.sum(case((Opportunity.is_active.is_(True), 1), else_=0)).label("active_opportunity_count"),
            )
            .where(Opportunity.source_id.in_(source_ids))
            .group_by(Opportunity.source_id)
        )
    }
    raw_document_counts = {
        row.source_id: row.raw_document_count
        for row in db.execute(
            select(
                RawDocument.source_id.label("source_id"),
                func.count(RawDocument.id).label("raw_document_count"),
            )
            .where(RawDocument.source_id.in_(source_ids))
            .group_by(RawDocument.source_id)
        )
    }

    latest_job_ids = {
        row.source_id: row.latest_job_id
        for row in db.execute(
            select(
                CrawlJob.source_id.label("source_id"),
                func.max(CrawlJob.id).label("latest_job_id"),
            )
            .where(CrawlJob.source_id.in_(source_ids))
            .group_by(CrawlJob.source_id)
        )
    }
    latest_jobs = {}
    if latest_job_ids:
        latest_jobs = {
            row.id: row
            for row in db.scalars(select(CrawlJob).where(CrawlJob.id.in_(latest_job_ids.values()))).all()
        }

    serialized: list[AdminSourceOut] = []
    for source in sources:
        counts = opportunity_counts.get(source.id)
        latest_job = latest_jobs.get(latest_job_ids.get(source.id))
        serialized.append(
            AdminSourceOut(
                id=source.id,
                name=source.name,
                base_url=source.base_url,
                country=source.country,
                source_class=source.source_class.value,
                trust_tier=source.trust_tier.value,
                access_method=source.access_method.value,
                crawl_frequency_minutes=source.crawl_frequency_minutes,
                is_active=source.is_active,
                parser_key=source.parser_key,
                created_at=source.created_at,
                updated_at=source.updated_at,
                opportunity_count=int(counts.opportunity_count) if counts else 0,
                active_opportunity_count=int(counts.active_opportunity_count or 0) if counts else 0,
                raw_document_count=int(raw_document_counts.get(source.id, 0)),
                last_crawl_status=latest_job.status if latest_job else None,
                last_crawl_started_at=latest_job.started_at if latest_job else None,
                last_crawl_finished_at=latest_job.finished_at if latest_job else None,
                last_pages_fetched=latest_job.pages_fetched if latest_job else 0,
                last_records_extracted=latest_job.records_extracted if latest_job else 0,
            )
        )
    return serialized


def _latest_running_crawl(db: Session, source_id: int) -> CrawlJob | None:
    return db.scalar(
        select(CrawlJob)
        .where(CrawlJob.source_id == source_id, CrawlJob.status == CrawlStatus.running)
        .order_by(CrawlJob.started_at.desc().nullslast(), CrawlJob.id.desc())
    )


def _close_stale_running_crawl(job: CrawlJob) -> bool:
    if not job.started_at:
        return False
    started_at = job.started_at.astimezone(UTC)
    if started_at > datetime.now(UTC) - timedelta(minutes=STALE_RUNNING_CRAWL_MINUTES):
        return False
    job.status = CrawlStatus.failed
    job.finished_at = datetime.now(UTC)
    job.error_message = "Marked failed because the crawl was stuck in running state."
    return True


@router.get("/overview", response_model=AdminOverviewOut)
def admin_overview(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> AdminOverviewOut:
    now = datetime.now(UTC)
    stats = AdminOverviewStats(
        total_sources=db.scalar(select(func.count()).select_from(Source)) or 0,
        active_sources=db.scalar(select(func.count()).select_from(Source).where(Source.is_active.is_(True))) or 0,
        total_opportunities=db.scalar(select(func.count()).select_from(Opportunity)) or 0,
        active_opportunities=db.scalar(
            select(func.count()).select_from(Opportunity).where(Opportunity.is_active.is_(True))
        )
        or 0,
        total_users=db.scalar(select(func.count()).select_from(User)) or 0,
        total_alert_rules=db.scalar(select(func.count()).select_from(AlertRule)) or 0,
        running_crawls=db.scalar(
            select(func.count()).select_from(CrawlJob).where(CrawlJob.status == CrawlStatus.running)
        )
        or 0,
        failed_crawls_last_24h=db.scalar(
            select(func.count())
            .select_from(CrawlJob)
            .where(
                CrawlJob.status == CrawlStatus.failed,
                CrawlJob.started_at >= now - timedelta(hours=24),
            )
        )
        or 0,
        queued_alert_events=db.scalar(
            select(func.count()).select_from(AlertEvent).where(AlertEvent.status.in_(["pending", "queued"]))
        )
        or 0,
    )

    recent_rows = db.execute(
        select(CrawlJob, Source.name)
        .join(Source, Source.id == CrawlJob.source_id)
        .order_by(CrawlJob.id.desc())
        .limit(8)
    ).all()
    recent_crawls = [
        CrawlJobOut(
            id=job.id,
            source_id=job.source_id,
            source_name=source_name,
            status=job.status,
            started_at=job.started_at,
            finished_at=job.finished_at,
            error_message=job.error_message,
            pages_fetched=job.pages_fetched,
            records_extracted=job.records_extracted,
        )
        for job, source_name in recent_rows
    ]

    sources = db.scalars(select(Source).order_by(Source.updated_at.desc(), Source.created_at.desc()).limit(6)).all()
    return AdminOverviewOut(stats=stats, recent_crawls=recent_crawls, sources=_serialize_sources(db, sources))


@router.get("/settings/ai", response_model=AdminAiSettingsOut)
def ai_settings(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> AdminAiSettingsOut:
    return AdminAiSettingsOut(
        groq_api_key_configured=has_groq_api_key(db),
        groq_model=get_groq_model(db),
    )


@router.patch("/settings/ai", response_model=AdminAiSettingsOut)
def update_ai_settings(
    payload: AdminAiSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminAiSettingsOut:
    if payload.groq_api_key:
        set_setting(db, GROQ_API_KEY, payload.groq_api_key.strip())
    set_setting(db, GROQ_MODEL, payload.groq_model.strip())
    logger.info("admin_ai_settings_updated", groq_api_key_configured=has_groq_api_key(db), groq_model=get_groq_model(db))
    return AdminAiSettingsOut(
        groq_api_key_configured=has_groq_api_key(db),
        groq_model=get_groq_model(db),
    )


@router.get("/sources", response_model=list[AdminSourceOut])
def list_sources(db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> list[AdminSourceOut]:
    sources = db.scalars(select(Source).order_by(Source.created_at.desc())).all()
    return _serialize_sources(db, sources)


@router.post("/sources", response_model=SourceOut)
def create_source(payload: SourceCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> SourceOut:
    data = payload.model_dump()
    data["base_url"] = str(payload.base_url)
    source = Source(**data)
    db.add(source)
    db.commit()
    db.refresh(source)
    logger.info("admin_source_created", source_id=source.id, parser_key=source.parser_key, trust_tier=source.trust_tier.value)
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

    for key, value in data.items():
        setattr(source, key, value)
    db.commit()
    db.refresh(source)
    logger.info("admin_source_updated", source_id=source.id, parser_key=source.parser_key, trust_tier=source.trust_tier.value)
    return source


@router.delete("/sources/{source_id}", response_model=MessageResponse)
def delete_source(source_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> MessageResponse:
    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    db.delete(source)
    db.commit()
    logger.info("admin_source_deleted", source_id=source_id)
    return MessageResponse(message=f"Source {source_id} deleted")


@router.post("/sources/{source_id}/crawl", response_model=MessageResponse)
def trigger_crawl(
    source_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> MessageResponse:
    from worker.tasks import run_source_crawl

    source = db.scalar(select(Source).where(Source.id == source_id))
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    if not source.is_active:
        raise HTTPException(status_code=409, detail="Source is paused. Activate it before crawling.")

    running = _latest_running_crawl(db, source_id)
    if running and not _close_stale_running_crawl(running):
        raise HTTPException(status_code=409, detail=f"Crawl job #{running.id} is already running for this source.")
    if running:
        db.commit()

    run_source_crawl.delay(source_id)
    logger.info("admin_crawl_triggered", source_id=source_id)
    return MessageResponse(message=f"Crawl queued for source {source_id}")


@router.get("/crawl-jobs", response_model=CrawlJobPage)
def crawl_jobs(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> CrawlJobPage:
    stmt = select(CrawlJob, Source.name).join(Source, Source.id == CrawlJob.source_id).order_by(CrawlJob.id.desc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    serialized = [
        CrawlJobOut(
            id=job.id,
            source_id=job.source_id,
            source_name=source_name,
            status=job.status,
            started_at=job.started_at,
            finished_at=job.finished_at,
            error_message=job.error_message,
            pages_fetched=job.pages_fetched,
            records_extracted=job.records_extracted,
        )
        for job, source_name in items
    ]
    return CrawlJobPage(items=serialized, total=total, page=page, page_size=page_size)


@router.get("/raw-documents/{doc_id}", response_model=RawDocumentOut)
def raw_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)) -> RawDocumentOut:
    doc = db.scalar(select(RawDocument).where(RawDocument.id == doc_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Raw document not found")
    return doc


@router.get("/failed-extractions", response_model=FailedExtractionPage)
def failed_extractions(
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> FailedExtractionPage:
    stmt = (
        select(Opportunity, Source.name)
        .join(Source, Source.id == Opportunity.source_id)
        .where(Opportunity.extraction_confidence < 0.45)
        .order_by(Opportunity.updated_at.desc())
    )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    serialized = [
        FailedExtractionOut(
            id=opportunity.id,
            title=opportunity.title,
            record_type=opportunity.record_type,
            source_id=opportunity.source_id,
            source_name=source_name,
            source_url=opportunity.source_url,
            extraction_confidence=opportunity.extraction_confidence,
            updated_at=opportunity.updated_at,
        )
        for opportunity, source_name in items
    ]
    return FailedExtractionPage(items=serialized, total=total, page=page, page_size=page_size)


@router.post("/reindex/{opportunity_id}", response_model=MessageResponse)
def reindex(opportunity_id: int, _: User = Depends(get_admin_user)) -> MessageResponse:
    from worker.tasks import reindex_opportunity

    reindex_opportunity.delay(opportunity_id)
    logger.info("admin_reindex_triggered", opportunity_id=opportunity_id)
    return MessageResponse(message=f"Reindex queued for opportunity {opportunity_id}")
