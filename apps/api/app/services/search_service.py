from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, case, desc, func, literal, or_, select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, OpportunityEmbedding, SavedOpportunity, Source
from app.models.enums import TrustTier
from app.schemas.opportunity import OpportunityCard, OpportunitySearchQuery, OpportunitySearchResponse
from app.services.embedding_service import embed_text
from app.services.ranking_service import final_rank


def _apply_filters(stmt: Select[tuple[Opportunity]], q: OpportunitySearchQuery, user_id: int | None) -> Select:
    if q.record_type:
        stmt = stmt.where(Opportunity.record_type == q.record_type)
    if q.country:
        stmt = stmt.where(Opportunity.country.ilike(f"%{q.country}%"))
    if q.city:
        stmt = stmt.where(Opportunity.city.ilike(f"%{q.city}%"))
    if q.sector:
        stmt = stmt.where(Opportunity.sector.ilike(f"%{q.sector}%"))
    if q.source_class:
        stmt = stmt.where(Source.source_class == q.source_class)
    if q.trust_tier:
        stmt = stmt.where(Source.trust_tier == q.trust_tier)
    if q.deadline_from:
        stmt = stmt.where(Opportunity.deadline >= q.deadline_from)
    if q.deadline_to:
        stmt = stmt.where(Opportunity.deadline <= q.deadline_to)
    if q.visa_support is not None:
        stmt = stmt.where(Opportunity.visa_support.is_(q.visa_support))
    if q.degree_level:
        stmt = stmt.where(Opportunity.degree_level.ilike(f"%{q.degree_level}%"))
    if q.salary_min is not None:
        stmt = stmt.where(or_(Opportunity.salary_max.is_(None), Opportunity.salary_max >= q.salary_min))
    if q.salary_max is not None:
        stmt = stmt.where(or_(Opportunity.salary_min.is_(None), Opportunity.salary_min <= q.salary_max))
    if q.fresh_days is not None:
        stmt = stmt.where(Opportunity.created_at >= datetime.now(UTC) - timedelta(days=q.fresh_days))
    if q.active_only:
        stmt = stmt.where(Opportunity.is_active.is_(True))
    if q.saved_only and user_id is not None:
        stmt = stmt.where(SavedOpportunity.user_id == user_id)
    return stmt


def search_opportunities(db: Session, query: OpportunitySearchQuery, user_id: int | None = None) -> OpportunitySearchResponse:
    lexical_score = literal(0.0)
    if query.q:
        lexical_score = func.ts_rank_cd(
            Opportunity.search_tsv,
            func.websearch_to_tsquery("english", query.q),
        )

    semantic_score = literal(0.0)
    stmt = select(Opportunity, Source, lexical_score.label("lexical_score"), semantic_score.label("semantic_score")).join(
        Source, Opportunity.source_id == Source.id
    )

    if query.semantic_q:
        vector = embed_text(query.semantic_q)
        stmt = stmt.join(OpportunityEmbedding, OpportunityEmbedding.opportunity_id == Opportunity.id)
        semantic_score = (1 - OpportunityEmbedding.embedding.cosine_distance(vector)).label("semantic_score")
        stmt = select(Opportunity, Source, lexical_score.label("lexical_score"), semantic_score).join(
            Source, Opportunity.source_id == Source.id
        )
        stmt = stmt.join(OpportunityEmbedding, OpportunityEmbedding.opportunity_id == Opportunity.id)

    if query.saved_only and user_id is not None:
        stmt = stmt.join(SavedOpportunity, SavedOpportunity.opportunity_id == Opportunity.id)

    stmt = _apply_filters(stmt, query, user_id)

    trust_multiplier = case(
        (Source.trust_tier == TrustTier.official_gov, 1.0),
        (Source.trust_tier == TrustTier.official_partner, 0.9),
        (Source.trust_tier == TrustTier.established_portal, 0.7),
        else_=0.45,
    )
    final_score = (
        (
            Opportunity.actionability_score * 0.1
            + Opportunity.freshness_score * 0.2
            + Opportunity.trust_score * 0.25
            + lexical_score * 0.25
            + semantic_score * 0.2
        )
        * trust_multiplier
    ).label("final_score")

    stmt = stmt.add_columns(final_score)

    if query.sort == "newest":
        stmt = stmt.order_by(desc(Opportunity.created_at))
    elif query.sort == "deadline":
        stmt = stmt.order_by(Opportunity.deadline.asc().nulls_last())
    elif query.sort == "trust":
        stmt = stmt.order_by(desc(Opportunity.trust_score))
    elif query.sort == "salary":
        stmt = stmt.order_by(desc(func.coalesce(Opportunity.salary_max, 0)))
    else:
        stmt = stmt.order_by(desc(final_score))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.execute(stmt.offset((query.page - 1) * query.page_size).limit(query.page_size)).all()

    saved_ids: set[int] = set()
    if user_id is not None and rows:
        opp_ids = [row[0].id for row in rows]
        saved_rows = db.execute(
            select(SavedOpportunity.opportunity_id).where(
                SavedOpportunity.user_id == user_id,
                SavedOpportunity.opportunity_id.in_(opp_ids),
            )
        ).all()
        saved_ids = {x[0] for x in saved_rows}

    items = [
        OpportunityCard(
            id=opp.id,
            title=opp.title,
            summary=opp.summary,
            record_type=opp.record_type,
            organization=opp.organization,
            employer=opp.employer,
            country=opp.country,
            city=opp.city,
            deadline=opp.deadline,
            salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
            salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
            salary_currency=opp.salary_currency,
            funding_type=opp.funding_type,
            trust_score=opp.trust_score,
            source_class=src.source_class,
            trust_tier=src.trust_tier,
            source_url=opp.source_url,
            why_this_matches="Matches your search intent and source trust preferences.",
            is_saved=opp.id in saved_ids,
        )
        for opp, src, _, _, _ in rows
    ]

    return OpportunitySearchResponse(items=items, total=total, page=query.page, page_size=query.page_size)


def get_similar_opportunities(db: Session, opportunity_id: int, limit: int = 5) -> list[OpportunityCard]:
    base = db.scalar(select(Opportunity).where(Opportunity.id == opportunity_id))
    if not base:
        return []

    stmt = (
        select(Opportunity, Source)
        .join(Source, Opportunity.source_id == Source.id)
        .where(Opportunity.id != opportunity_id)
        .where(Opportunity.record_type == base.record_type)
        .order_by(desc(Opportunity.overall_rank_score))
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return [
        OpportunityCard(
            id=opp.id,
            title=opp.title,
            summary=opp.summary,
            record_type=opp.record_type,
            organization=opp.organization,
            employer=opp.employer,
            country=opp.country,
            city=opp.city,
            deadline=opp.deadline,
            salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
            salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
            salary_currency=opp.salary_currency,
            funding_type=opp.funding_type,
            trust_score=opp.trust_score,
            source_class=src.source_class,
            trust_tier=src.trust_tier,
            source_url=opp.source_url,
            why_this_matches="Similar record type and ranking profile.",
            is_saved=False,
        )
        for opp, src in rows
    ]


def recompute_rank(opp: Opportunity, lexical: float = 0.0, semantic: float = 0.0) -> float:
    return final_rank(opp.trust_score, opp.freshness_score, lexical, semantic, opp.actionability_score)
