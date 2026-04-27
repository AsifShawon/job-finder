from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, desc, func, literal, or_, select
from sqlalchemy.orm import Session

from app.models.entities import (
    PublishedOpportunity,
    PublishedOpportunityEmbedding,
    SavedOpportunity,
    Source,
)
from app.schemas.opportunity import (
    PublishedOpportunityCard,
    PublishedSearchQuery,
    PublishedSearchResponse,
)
from app.services.embedding_service import embed_query


def _apply_filters(stmt: Select, q: PublishedSearchQuery, user_id: int | None) -> Select:
    # Always search active published opportunities only
    stmt = stmt.where(PublishedOpportunity.is_active.is_(True))

    if q.q:
        stmt = stmt.where(
            PublishedOpportunity.search_tsv.op("@@")(func.websearch_to_tsquery("simple", q.q))
        )
    if q.opportunity_type:
        stmt = stmt.where(PublishedOpportunity.opportunity_type == q.opportunity_type)
    if q.country:
        stmt = stmt.where(
            or_(
                PublishedOpportunity.country.ilike(f"%{q.country}%"),
                PublishedOpportunity.destination_country.ilike(f"%{q.country}%"),
            )
        )
    if q.destination_country:
        stmt = stmt.where(PublishedOpportunity.destination_country.ilike(f"%{q.destination_country}%"))
    if q.can_apply_from_bd is not None:
        stmt = stmt.where(PublishedOpportunity.can_apply_from_bd.is_(q.can_apply_from_bd))
    if q.open_to_international_candidates is not None:
        stmt = stmt.where(
            PublishedOpportunity.open_to_international_candidates.is_(q.open_to_international_candidates)
        )
    if q.requires_existing_work_permit is not None:
        stmt = stmt.where(
            PublishedOpportunity.requires_existing_work_permit.is_(q.requires_existing_work_permit)
        )
    if q.lmia_status:
        stmt = stmt.where(PublishedOpportunity.lmia_status == q.lmia_status)
    if q.official_sources_only:
        stmt = stmt.where(
            PublishedOpportunity.source_trust_badge.in_(["সরকারি উৎস", "অফিসিয়াল পার্টনার"])
        )
    if q.sector:
        stmt = stmt.where(PublishedOpportunity.sector.ilike(f"%{q.sector}%"))
    if q.skill_level:
        stmt = stmt.where(PublishedOpportunity.skill_level.ilike(f"%{q.skill_level}%"))
    if q.deadline_from:
        stmt = stmt.where(PublishedOpportunity.deadline >= q.deadline_from)
    if q.deadline_to:
        stmt = stmt.where(PublishedOpportunity.deadline <= q.deadline_to)
    if q.salary_min is not None:
        stmt = stmt.where(
            or_(PublishedOpportunity.salary_max.is_(None), PublishedOpportunity.salary_max >= q.salary_min)
        )
    if q.salary_max is not None:
        stmt = stmt.where(
            or_(PublishedOpportunity.salary_min.is_(None), PublishedOpportunity.salary_min <= q.salary_max)
        )
    if q.fresh_days is not None:
        stmt = stmt.where(
            PublishedOpportunity.published_at >= datetime.now(UTC) - timedelta(days=q.fresh_days)
        )
    if q.source_type:
        stmt = stmt.join(Source, Source.id == PublishedOpportunity.source_id, isouter=True)
        stmt = stmt.where(Source.source_type == q.source_type)
    if q.saved_only and user_id is not None:
        stmt = stmt.join(
            SavedOpportunity,
            SavedOpportunity.opportunity_id == PublishedOpportunity.id,
        ).where(SavedOpportunity.user_id == user_id)
    return stmt


def search_opportunities(
    db: Session, query: PublishedSearchQuery, user_id: int | None = None
) -> PublishedSearchResponse:
    lexical_score = literal(0.0)
    if query.q:
        lexical_score = func.ts_rank_cd(
            PublishedOpportunity.search_tsv,
            func.websearch_to_tsquery("simple", query.q),
        )

    semantic_score = literal(0.0)
    stmt = select(
        PublishedOpportunity,
        lexical_score.label("lexical_score"),
        semantic_score.label("semantic_score"),
    )

    if query.q and hasattr(query, "semantic_q") and getattr(query, "semantic_q", None):
        vector = embed_query(query.q)
        stmt = stmt.join(
            PublishedOpportunityEmbedding,
            PublishedOpportunityEmbedding.published_opportunity_id == PublishedOpportunity.id,
            isouter=True,
        )
        semantic_score = (
            1 - PublishedOpportunityEmbedding.embedding.cosine_distance(vector)
        ).label("semantic_score")
        stmt = select(PublishedOpportunity, lexical_score.label("lexical_score"), semantic_score)

    stmt = _apply_filters(stmt, query, user_id)

    # Trust multiplier based on source badge
    from sqlalchemy import case
    trust_mult = case(
        (PublishedOpportunity.source_trust_badge == "সরকারি উৎস", 1.0),
        (PublishedOpportunity.source_trust_badge == "অফিসিয়াল পার্টনার", 0.9),
        (PublishedOpportunity.source_trust_badge == "যাচাইকৃত উৎস", 0.75),
        else_=0.5,
    )

    final_score = (
        (
            PublishedOpportunity.actionability_score * 0.1
            + PublishedOpportunity.freshness_score * 0.2
            + PublishedOpportunity.trust_score * 0.25
            + lexical_score * 0.25
            + semantic_score * 0.2
        )
        * trust_mult
    ).label("final_score")

    stmt = stmt.add_columns(final_score)

    if query.sort == "newest":
        stmt = stmt.order_by(desc(PublishedOpportunity.published_at))
    elif query.sort == "deadline":
        stmt = stmt.order_by(PublishedOpportunity.deadline.asc().nulls_last())
    elif query.sort == "official":
        stmt = stmt.order_by(desc(PublishedOpportunity.trust_score), desc(final_score))
    elif query.sort == "salary":
        stmt = stmt.order_by(desc(func.coalesce(PublishedOpportunity.salary_max, 0)))
    else:
        stmt = stmt.order_by(desc(final_score))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.offset((query.page - 1) * query.page_size).limit(query.page_size)).all()

    saved_ids: set[int] = set()
    if user_id is not None and rows:
        pub_ids = [row[0].id for row in rows]
        saved_rows = db.execute(
            select(SavedOpportunity.opportunity_id).where(
                SavedOpportunity.user_id == user_id,
                SavedOpportunity.opportunity_id.in_(pub_ids),
            )
        ).all()
        saved_ids = {x[0] for x in saved_rows}

    items = [
        PublishedOpportunityCard(
            id=pub.id,
            title=pub.title,
            title_bn=pub.title_bn,
            opportunity_type=pub.opportunity_type,
            country=pub.country,
            destination_country=pub.destination_country,
            employer_or_organization=pub.employer_or_organization,
            sector=pub.sector,
            salary_min=float(pub.salary_min) if pub.salary_min is not None else None,
            salary_max=float(pub.salary_max) if pub.salary_max is not None else None,
            salary_currency=pub.salary_currency,
            salary_text=pub.salary_text,
            deadline=pub.deadline,
            source_page_url=pub.source_page_url or "",
            document_url=pub.document_url,
            original_apply_url=pub.original_apply_url,
            content_type=pub.content_type,
            source_name=pub.source_name,
            source_trust_badge=pub.source_trust_badge,
            can_apply_from_bd=pub.can_apply_from_bd,
            requires_existing_work_permit=pub.requires_existing_work_permit,
            open_to_international_candidates=pub.open_to_international_candidates,
            open_to_authorized_workers_only=pub.open_to_authorized_workers_only,
            lmia_status=pub.lmia_status,
            eligibility_status=pub.eligibility_status,
            target_audience_tags=pub.target_audience_tags or [],
            risk_flags=pub.risk_flags or [],
            trust_score=pub.trust_score,
            overall_rank_score=pub.overall_rank_score,
            published_at=pub.published_at,
            is_saved=pub.id in saved_ids,
            why_this_matches=_why_matches(pub, query.q),
            summary=pub.summary_bn or pub.summary_en,
            summary_bn=pub.summary_bn,
            source_url=pub.source_page_url or "",
            is_active=pub.is_active,
        )
        for pub, *_ in rows
    ]

    return PublishedSearchResponse(items=items, total=total, page=query.page, page_size=query.page_size)


def get_similar_opportunities(
    db: Session, published_id: int, limit: int = 5
) -> list[PublishedOpportunityCard]:
    base = db.scalar(
        select(PublishedOpportunity).where(PublishedOpportunity.id == published_id)
    )
    if not base:
        return []

    base_emb = db.scalar(
        select(PublishedOpportunityEmbedding).where(
            PublishedOpportunityEmbedding.published_opportunity_id == published_id
        )
    )

    if base_emb is not None:
        stmt = (
            select(PublishedOpportunity)
            .join(
                PublishedOpportunityEmbedding,
                PublishedOpportunityEmbedding.published_opportunity_id == PublishedOpportunity.id,
            )
            .where(PublishedOpportunity.id != published_id)
            .where(PublishedOpportunity.is_active.is_(True))
            .order_by(PublishedOpportunityEmbedding.embedding.cosine_distance(base_emb.embedding))
            .limit(limit)
        )
    else:
        stmt = (
            select(PublishedOpportunity)
            .where(PublishedOpportunity.id != published_id)
            .where(PublishedOpportunity.is_active.is_(True))
            .where(PublishedOpportunity.opportunity_type == base.opportunity_type)
            .order_by(desc(PublishedOpportunity.overall_rank_score))
            .limit(limit)
        )

    rows = db.scalars(stmt).all()
    return [
        PublishedOpportunityCard(
            id=p.id, title=p.title, title_bn=p.title_bn,
            opportunity_type=p.opportunity_type, country=p.country,
            destination_country=p.destination_country,
            employer_or_organization=p.employer_or_organization,
            sector=p.sector,
            salary_min=float(p.salary_min) if p.salary_min is not None else None,
            salary_max=float(p.salary_max) if p.salary_max is not None else None,
            salary_currency=p.salary_currency, salary_text=p.salary_text,
            deadline=p.deadline, source_page_url=p.source_page_url or "",
            document_url=p.document_url, original_apply_url=p.original_apply_url,
            content_type=p.content_type, source_name=p.source_name,
            source_trust_badge=p.source_trust_badge,
            can_apply_from_bd=p.can_apply_from_bd,
            requires_existing_work_permit=p.requires_existing_work_permit,
            open_to_international_candidates=p.open_to_international_candidates,
            open_to_authorized_workers_only=p.open_to_authorized_workers_only,
            lmia_status=p.lmia_status, eligibility_status=p.eligibility_status,
            target_audience_tags=p.target_audience_tags or [],
            risk_flags=p.risk_flags or [],
            trust_score=p.trust_score, overall_rank_score=p.overall_rank_score,
            published_at=p.published_at, is_saved=False,
            why_this_matches="Similar type and eligibility profile.",
            summary=p.summary_bn or p.summary_en,
            summary_bn=p.summary_bn, source_url=p.source_page_url or "",
            is_active=p.is_active,
        )
        for p in rows
    ]


def _why_matches(pub: PublishedOpportunity, q: str | None) -> str:
    if pub.can_apply_from_bd:
        return "বাংলাদেশ থেকে আবেদনযোগ্য"
    if pub.open_to_international_candidates:
        return "আন্তর্জাতিক প্রার্থীদের জন্য উন্মুক্ত"
    if q:
        return f"'{q}' অনুসন্ধানের সাথে মিলেছে"
    return "উৎস বিশ্বাসযোগ্যতা ও প্রাসঙ্গিকতার ভিত্তিতে"
