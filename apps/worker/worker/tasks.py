from datetime import UTC, datetime, timedelta

from celery import Task
from sqlalchemy import and_, select, text
import structlog

from app.db.session import SessionLocal
from app.ingestion.pipeline import run_source_ingestion
from app.models.entities import AlertEvent, AlertRule, CrawlJob, Opportunity, OpportunityEmbedding, Source
from app.models.enums import CrawlStatus
from app.schemas.opportunity import OpportunitySearchQuery
from app.services.embedding_service import EMBEDDING_MODEL, embed_text
from app.services.search_service import search_opportunities
from worker.celery_app import celery_app

logger = structlog.get_logger(__name__)
STALE_RUNNING_CRAWL_MINUTES = 30


class BaseRetryTask(Task):
    autoretry_for = (Exception,)
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True
    max_retries = 5

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        logger.error(
            "celery_task_failed",
            task=self.name,
            task_id=task_id,
            args=args,
            kwargs=kwargs,
            error=str(exc),
        )


@celery_app.task(base=BaseRetryTask, bind=True)
def schedule_active_source_crawls(self) -> dict:
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

            if last_job and last_job.started_at:
                minutes_since_last = (datetime.now(UTC) - last_job.started_at).total_seconds() / 60
                if minutes_since_last < source.crawl_frequency_minutes:
                    continue

            run_source_crawl.delay(source.id)
            queued += 1
        return {"queued_sources": queued}


@celery_app.task(base=BaseRetryTask, bind=True)
def run_source_crawl(self, source_id: int) -> dict:
    with SessionLocal() as db:
        result = run_source_ingestion(db, source_id)
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

        vector = embed_text(" ".join([opp.title or "", opp.summary or "", opp.eligibility_text or ""]))
        db.execute(
            text(
                "UPDATE opportunities "
                "SET search_tsv = to_tsvector('english', "
                "coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(eligibility_text, '')) "
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
