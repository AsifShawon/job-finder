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


# ── Semantic dedup (cross-source merge) ───────────────────────────────────────

# Cosine similarity threshold above which two opportunities are considered the
# same listing republished on different sources. Tuned conservatively — false
# positives merge unrelated jobs together.
_SEMANTIC_DEDUP_THRESHOLD = 0.92


def find_semantic_duplicate(
    db: Session,
    *,
    title: str,
    summary: str | None,
    employer: str | None,
    country: str | None,
    embedding: list[float] | None,
    exclude_ids: tuple[int, ...] = (),
) -> Opportunity | None:
    """Find an existing Opportunity whose embedding is cosine-similar to the
    provided one. Used to detect the same job listed on multiple source sites.

    Returns the canonical (oldest) match if any, else None. Caller decides
    whether to merge `mirror_urls`.
    """
    if not embedding:
        return None

    from app.models.entities import OpportunityEmbedding
    # pgvector cosine distance: 0 = identical, 2 = opposite. Convert to
    # similarity = 1 - distance.
    distance_expr = OpportunityEmbedding.embedding.cosine_distance(embedding)
    stmt = (
        select(Opportunity, distance_expr.label("distance"))
        .join(OpportunityEmbedding, OpportunityEmbedding.opportunity_id == Opportunity.id)
        .where(distance_expr < (1.0 - _SEMANTIC_DEDUP_THRESHOLD))
        .order_by(distance_expr)
        .limit(5)
    )
    if exclude_ids:
        stmt = stmt.where(~Opportunity.id.in_(exclude_ids))

    candidates = db.execute(stmt).all()
    if not candidates:
        return None

    # Among the close matches, prefer one that also shares country/employer if
    # we have those — guards against merging two different jobs that happen to
    # have similar Bengali summaries.
    target_country = (country or "").strip().lower() or None
    target_employer = (employer or "").strip().lower() or None
    for opp, _distance in candidates:
        opp_country = (opp.country or opp.destination_country or "").strip().lower()
        opp_employer = (opp.employer_or_organization or opp.employer or "").strip().lower()
        if target_country and opp_country and target_country != opp_country:
            continue
        if target_employer and opp_employer and target_employer not in opp_employer and opp_employer not in target_employer:
            continue
        return opp

    # No country/employer-aware match — fall back to the closest candidate
    # only if we have no country/employer signal at all.
    if not target_country and not target_employer:
        return candidates[0][0]
    return None


def merge_mirror_url(opp: Opportunity, source_url: str) -> bool:
    """Append a source_url to opp.mirror_urls if not already present.
    Returns True when the list was changed."""
    if not source_url:
        return False
    existing = list(opp.mirror_urls or [])
    if source_url == opp.source_page_url or source_url == opp.source_url:
        return False
    if source_url in existing:
        return False
    existing.append(source_url)
    opp.mirror_urls = existing
    return True
