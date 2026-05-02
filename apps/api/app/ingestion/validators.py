from datetime import date, datetime
from difflib import SequenceMatcher
from urllib.parse import urlparse

from dateutil.parser import parse as parse_date
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.ingestion.schemas import ExtractionBase
from app.models.entities import Opportunity, RawDocument




def parse_deadline(deadline_text: str | None) -> date | None:
    if not deadline_text:
        return None
    try:
        return parse_date(deadline_text, fuzzy=True).date()
    except Exception:
        return None


def validate_extraction(extraction: ExtractionBase) -> list[str]:
    errors: list[str] = []
    if not extraction.title:
        errors.append("Missing title")
    if extraction.application_url:
        parsed = urlparse(extraction.application_url)
        if parsed.scheme not in {"http", "https"}:
            errors.append("Invalid application URL")
    return errors


def is_duplicate(
    db: Session,
    canonical_url: str | None,
    content_hash: str,
    title: str,
) -> bool:
    if canonical_url:
        latest = db.scalar(
            select(RawDocument)
            .where(RawDocument.canonical_url == canonical_url)
            .order_by(desc(RawDocument.fetched_at), desc(RawDocument.id))
            .limit(1)
        )
        if latest and latest.content_hash == content_hash:
            return True

    by_hash = db.scalar(select(RawDocument).where(RawDocument.content_hash == content_hash))
    if by_hash:
        return True

    candidates = db.scalars(select(Opportunity.title).order_by(Opportunity.id.desc()).limit(100)).all()
    title_l = title.lower()
    for candidate in candidates:
        if SequenceMatcher(None, title_l, candidate.lower()).ratio() > 0.9:
            return True
    return False


def stale_or_inactive(deadline: date | None) -> bool:
    return bool(deadline and deadline < datetime.utcnow().date())


def is_opportunity_duplicate(db: Session, content_hash: str) -> bool:
    """Check whether an Opportunity with this semantic content_hash already exists."""
    return bool(db.scalar(select(Opportunity).where(Opportunity.content_hash == content_hash)))


def is_latest_snapshot_duplicate(
    db: Session,
    *,
    source_id: int,
    canonical_url: str | None,
    content_hash: str,
) -> bool:
    if not canonical_url:
        return False
    latest = db.scalar(
        select(RawDocument)
        .where(
            RawDocument.source_id == source_id,
            RawDocument.canonical_url == canonical_url,
        )
        .order_by(desc(RawDocument.fetched_at), desc(RawDocument.id))
        .limit(1)
    )
    return bool(latest and latest.content_hash == content_hash)


def find_existing_opportunity(
    db: Session,
    *,
    source_id: int,
    source_item_key: str | None,
    content_hash: str,
) -> Opportunity | None:
    if source_item_key:
        existing = db.scalar(
            select(Opportunity).where(
                Opportunity.source_id == source_id,
                Opportunity.source_item_key == source_item_key,
            )
        )
        if existing:
            return existing
    return db.scalar(
        select(Opportunity).where(
            Opportunity.source_id == source_id,
            Opportunity.content_hash == content_hash,
        )
    )
