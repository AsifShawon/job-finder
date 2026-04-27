from datetime import UTC, datetime, timedelta

from celery import Task
from sqlalchemy import and_, select, text
import logging

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.ingestion.compliance_guard import ComplianceError
from app.ingestion.errors import ConnectorNotImplementedError, NonRetryableCrawlError, SourceConfigError, TransientCrawlError
from app.ingestion.pipeline import run_source_ingestion
from app.models.entities import AlertEvent, AlertRule, CrawlJob, Opportunity, OpportunityEmbedding, Source
from app.models.enums import CrawlStatus
from app.schemas.opportunity import OpportunitySearchQuery
from app.services.embedding_service import EMBEDDING_MODEL, embed_text
from app.services.search_service import search_opportunities
from worker.celery_app import celery_app

logger = logging.getLogger(__name__)
STALE_RUNNING_CRAWL_MINUTES = 30


class _NoHttpxStatusError(Exception):
    pass


try:
    import httpx
    _HTTPX_TIMEOUT_ERRORS = (httpx.TimeoutException, httpx.ConnectError)
    _HTTPX_STATUS_ERROR = httpx.HTTPStatusError
except Exception:  # pragma: no cover - optional dependency in worker image
    httpx = None  # type: ignore[assignment]
    _HTTPX_TIMEOUT_ERRORS = tuple()
    _HTTPX_STATUS_ERROR = _NoHttpxStatusError


class BaseRetryTask(Task):
    autoretry_for = (TransientCrawlError,) + _HTTPX_TIMEOUT_ERRORS
    dont_autoretry_for = (
        ComplianceError,
        SourceConfigError,
        ConnectorNotImplementedError,
        NonRetryableCrawlError,
        TypeError,
        ValueError,
    )
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    max_retries = 3

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(
            "celery_task_failed",
            extra={
                "task": self.name,
                "task_id": task_id,
                # Avoid using reserved LogRecord keys like 'args'/'kwargs'
                "task_args": args,
                "task_kwargs": kwargs,
                "error": str(exc),
            },
        )


@celery_app.task(base=BaseRetryTask, bind=True)
def schedule_active_source_crawls(self) -> dict:
    if not get_settings().enable_scheduled_crawls:
        return {"queued_sources": 0, "disabled": True}

    with SessionLocal() as db:
        sources = db.scalars(select(Source).where(Source.is_active.is_(True))).all()
        queued = 0
        for source in sources:
            running = db.scalar(
                select(CrawlJob).where(
                    CrawlJob.source_id == source.id,
                    CrawlJob.status == CrawlStatus.running,
                )
            )
            if running:
                if (
                    running.started_at
                    and running.started_at < datetime.now(UTC) - timedelta(minutes=STALE_RUNNING_CRAWL_MINUTES)
                ):
                    running.status = CrawlStatus.failed
                    running.finished_at = datetime.now(UTC)
                    running.error_message = "Marked failed because the crawl was stuck in running state."
                    db.commit()
                else:
                    continue

            last_job = db.scalar(
                select(CrawlJob)
                .where(CrawlJob.source_id == source.id)
                .order_by(CrawlJob.started_at.desc().nullslast(), CrawlJob.id.desc())
            )

            if not last_job or not last_job.started_at:
                continue

            minutes_since_last = (datetime.now(UTC) - last_job.started_at).total_seconds() / 60
            if minutes_since_last < source.crawl_frequency_minutes:
                continue

            run_source_crawl.delay(source.id)
            queued += 1
        return {"queued_sources": queued}


@celery_app.task(base=BaseRetryTask, bind=True)
def run_source_crawl(self, source_id: int, force: bool = False) -> dict:
    with SessionLocal() as db:
        try:
            result = run_source_ingestion(db, source_id, force=force)
        except ValueError as exc:
            logger.warning(
                "source_crawl_skipped",
                extra={"source_id": source_id, "error": str(exc)},
            )
            return {
                "source_id": source_id,
                "pages_fetched": 0,
                "records_extracted": 0,
                "error": str(exc),
            }
        except ComplianceError as exc:
            logger.warning(
                "source_crawl_compliance_skip",
                extra={"source_id": source_id, "error": str(exc), "code": exc.code},
            )
            return {
                "source_id": source_id,
                "pages_fetched": 0,
                "records_extracted": 0,
                "error": str(exc),
                "status": "skipped_compliance" if exc.code != "recently_crawled" else "skipped_recently",
            }
        except (SourceConfigError, ConnectorNotImplementedError) as exc:
            logger.error(
                "source_crawl_failed_config",
                extra={"source_id": source_id, "error": str(exc)},
            )
            return {
                "source_id": source_id,
                "pages_fetched": 0,
                "records_extracted": 0,
                "error": str(exc),
                "status": "failed_config",
            }
        except _HTTPX_STATUS_ERROR as exc:
            status_code = getattr(exc.response, "status_code", None)
            if status_code in (429,) or (status_code and status_code >= 500):
                raise TransientCrawlError(f"Transient HTTP error {status_code}") from exc
            raise NonRetryableCrawlError(f"HTTP error {status_code}") from exc
        return {
            "source_id": source_id,
            "pages_fetched": result.pages_fetched,
            "records_extracted": result.records_extracted,
        }


@celery_app.task(base=BaseRetryTask, bind=True)
def reindex_opportunity(self, opportunity_id: int) -> dict:
    with SessionLocal() as db:
        opp = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
        if not opp:
            return {"message": "Opportunity not found", "opportunity_id": opportunity_id}

        embed_input = " ".join(filter(None, [opp.title, opp.summary, opp.sector, opp.country, opp.eligibility_text]))
        vector = embed_text(embed_input)
        db.execute(
            text(
                "UPDATE opportunities "
                "SET search_tsv = to_tsvector('simple', "
                "coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(eligibility_text, '') "
                "|| ' ' || coalesce(sector, '') || ' ' || coalesce(country, '')) "
                "WHERE id = :opportunity_id"
            ),
            {"opportunity_id": opp.id},
        )
        emb = db.scalar(select(OpportunityEmbedding).where(OpportunityEmbedding.opportunity_id == opp.id))
        if emb is None:
            emb = OpportunityEmbedding(opportunity_id=opp.id, embedding=vector, embedding_model=EMBEDDING_MODEL)
            db.add(emb)
        else:
            emb.embedding = vector
            emb.embedding_model = EMBEDDING_MODEL
        db.commit()
        return {"message": "Reindexed", "opportunity_id": opportunity_id}


@celery_app.task(base=BaseRetryTask, bind=True)
def generate_alert_events(self) -> dict:
    created = 0
    with SessionLocal() as db:
        rules = db.scalars(select(AlertRule).where(AlertRule.is_active.is_(True))).all()
        for rule in rules:
            query_text = rule.query_text
            data = rule.filter_json or {}
            parsed = OpportunitySearchQuery(
                q=query_text,
                country=data.get("country"),
                sector=data.get("sector"),
                record_type=data.get("record_type"),
                page=1,
                page_size=20,
                sort="relevance",
            )
            results = search_opportunities(db, query=parsed, user_id=rule.user_id)
            for item in results.items:
                exists = db.scalar(
                    select(AlertEvent).where(
                        and_(
                            AlertEvent.alert_rule_id == rule.id,
                            AlertEvent.opportunity_id == item.id,
                        )
                    )
                )
                if exists:
                    continue
                db.add(
                    AlertEvent(
                        alert_rule_id=rule.id,
                        opportunity_id=item.id,
                        sent_at=datetime.now(UTC),
                        status="queued",
                    )
                )
                created += 1
            rule.last_run_at = datetime.now(UTC)
        db.commit()
    return {"events_created": created}


@celery_app.task(base=BaseRetryTask, bind=True)
def cleanup_stale_opportunities(self) -> dict:
    with SessionLocal() as db:
        rows = db.scalars(
            select(Opportunity).where(
                Opportunity.deadline.is_not(None),
                Opportunity.deadline < datetime.now(UTC).date(),
                Opportunity.is_active.is_(True),
            )
        ).all()
        for row in rows:
            row.is_active = False
            row.last_verified_at = datetime.now(UTC)
        db.commit()
        return {"deactivated": len(rows)}


@celery_app.task(base=BaseRetryTask, bind=True)
def run_validation_pass(self) -> dict:
    with SessionLocal() as db:
        candidates = db.scalars(select(Opportunity).order_by(Opportunity.id.desc()).limit(200)).all()
        updated = 0
        for opp in candidates:
            if opp.deadline and opp.deadline < datetime.now(UTC).date() and opp.is_active:
                opp.is_active = False
                updated += 1
        db.commit()
        return {"updated": updated}
