from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.ingestion.cleaner import clean_page
from app.ingestion.connectors.registry import get_connector
from app.ingestion.extractor import extract_structured
from app.ingestion.parsers.registry import get_parser
from app.ingestion.validators import is_duplicate, parse_deadline, stale_or_inactive, validate_extraction
from app.models.entities import CrawlJob, Opportunity, OpportunityEmbedding, RawDocument, Source
from app.models.enums import CrawlStatus
from app.services.embedding_service import EMBEDDING_MODEL, embed_text
from app.services.ranking_service import actionability_score, freshness_score, trust_weight
from app.services.storage_service import ObjectStorage


class IngestionResult:
    def __init__(self, pages_fetched: int = 0, records_extracted: int = 0) -> None:
        self.pages_fetched = pages_fetched
        self.records_extracted = records_extracted


def run_source_ingestion(db: Session, source_id: int) -> IngestionResult:
    source = db.scalar(select(Source).where(Source.id == source_id, Source.is_active.is_(True)))
    if not source:
        raise ValueError("Source not found or inactive")

    running = db.scalar(
        select(CrawlJob).where(
            CrawlJob.source_id == source.id,
            CrawlJob.status == CrawlStatus.running,
        )
    )
    if running:
        return IngestionResult()

    job = CrawlJob(source_id=source.id, status=CrawlStatus.running, started_at=datetime.now(UTC))
    db.add(job)
    db.commit()

    try:
        last_success = db.scalar(
            select(CrawlJob)
            .where(
                CrawlJob.source_id == source.id,
                CrawlJob.status == CrawlStatus.success,
                CrawlJob.finished_at.is_not(None),
            )
            .order_by(CrawlJob.finished_at.desc(), CrawlJob.id.desc())
        )
        crawl_since = last_success.finished_at if last_success and last_success.finished_at else datetime.now(UTC) - timedelta(days=30)

        storage = ObjectStorage()
        parser = get_parser(source.parser_key)
        connector = get_connector(source)

        pages = connector.fetch(source, since=crawl_since)
        extracted_count = 0
        for page in pages:
            parsed = parser(page)
            cleaned = clean_page(page)
            cleaned["title"] = parsed.get("title") or cleaned.get("title")

            if is_duplicate(db, cleaned.get("canonical_url"), cleaned["content_hash"], cleaned.get("title") or ""):
                continue

            raw_path = storage.put_text(page.url, page.raw_html or page.raw_text or "")
            raw = RawDocument(
                source_id=source.id,
                source_url=page.url,
                canonical_url=cleaned.get("canonical_url"),
                content_type=page.metadata.get("content_type"),
                raw_text=cleaned.get("body_text"),
                raw_html_path=raw_path,
                metadata_json=page.metadata,
                content_hash=cleaned["content_hash"],
            )
            db.add(raw)
            db.flush()

            try:
                extraction = extract_structured(db, cleaned)
            except Exception:
                continue
            errors = validate_extraction(extraction)
            if errors or extraction.record_type == "unknown":
                continue

            deadline = parse_deadline(extraction.deadline_text)
            trust = trust_weight(source.trust_tier)
            fresh = freshness_score(datetime.now(UTC))
            action = actionability_score(bool(deadline), bool(extraction.application_url), bool(extraction.requirements))

            opp = Opportunity(
                record_type=extraction.record_type,
                title=extraction.title or "Untitled",
                summary=extraction.summary,
                country=extraction.country or source.country,
                city=extraction.city,
                employer=extraction.employer,
                organization=extraction.organization,
                sector=extraction.sector,
                degree_level=extraction.degree_level,
                salary_min=extraction.salary_min,
                salary_max=extraction.salary_max,
                salary_currency=extraction.salary_currency,
                funding_type=extraction.funding_type,
                duration_text=extraction.duration_text,
                deadline=deadline,
                application_url=extraction.application_url,
                eligibility_text=extraction.eligibility_text,
                visa_support=extraction.visa_support,
                language_requirements_json={"items": extraction.language_requirements},
                requirements_json={"items": extraction.requirements},
                benefits_json={"items": extraction.benefits},
                source_id=source.id,
                raw_document_id=raw.id,
                source_url=page.url,
                trust_score=trust,
                freshness_score=fresh,
                actionability_score=action,
                extraction_confidence=extraction.extraction_confidence,
                overall_rank_score=(0.25 * trust) + (0.2 * fresh) + (0.1 * action),
                is_active=not stale_or_inactive(deadline),
                published_at=datetime.now(UTC),
                last_verified_at=datetime.now(UTC),
            )
            db.add(opp)
            db.flush()

            db.execute(
                text(
                    "UPDATE opportunities "
                    "SET search_tsv = to_tsvector('english', "
                    "coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(eligibility_text, '')) "
                    "WHERE id = :opportunity_id"
                ),
                {"opportunity_id": opp.id},
            )

            vector = embed_text(" ".join([opp.title or "", opp.summary or "", opp.eligibility_text or ""]))
            emb = OpportunityEmbedding(
                opportunity_id=opp.id,
                embedding=vector,
                embedding_model=EMBEDDING_MODEL,
            )
            db.add(emb)
            extracted_count += 1

        job.status = CrawlStatus.success
        job.finished_at = datetime.now(UTC)
        job.pages_fetched = len(pages)
        job.records_extracted = extracted_count
        db.commit()
        return IngestionResult(pages_fetched=len(pages), records_extracted=extracted_count)
    except Exception as exc:
        db.rollback()
        job.status = CrawlStatus.failed
        job.finished_at = datetime.now(UTC)
        job.error_message = str(exc)[:2000]
        db.commit()
        raise
