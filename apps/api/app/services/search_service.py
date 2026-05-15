from datetime import UTC, datetime, timedelta

from sqlalchemy import Select, desc, func, literal, or_, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Opportunity,
    OpportunityEmbedding,
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
    # Always filter to published opportunities only
    stmt = stmt.where(
        Opportunity.status == "published",
        Opportunity.is_active.is_(True),
        Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]),
    )

    if q.q:
        stmt = stmt.where(
            Opportunity.search_tsv.op("@@")(func.websearch_to_tsquery("simple", q.q))
        )
    if q.opportunity_type:
        stmt = stmt.where(Opportunity.opportunity_type == q.opportunity_type)
    if q.country:
        stmt = stmt.where(
            or_(
                Opportunity.country.ilike(f"%{q.country}%"),
                Opportunity.destination_country.ilike(f"%{q.country}%"),
            )
        )
    if q.destination_country:
        stmt = stmt.where(Opportunity.destination_country.ilike(f"%{q.destination_country}%"))
    if q.can_apply_from_bd is not None:
        stmt = stmt.where(Opportunity.can_apply_from_bd.is_(q.can_apply_from_bd))
    if q.open_to_international_candidates is not None:
        stmt = stmt.where(
            Opportunity.open_to_international_candidates.is_(q.open_to_international_candidates)
        )
    if q.requires_existing_work_permit is not None:
        stmt = stmt.where(
            Opportunity.requires_existing_work_permit.is_(q.requires_existing_work_permit)
        )
    if q.lmia_status:
        stmt = stmt.where(Opportunity.lmia_status == q.lmia_status)
    if q.official_sources_only:
        stmt = stmt.where(
            Opportunity.source_trust_badge.in_(["সরকারি উৎস", "অফিসিয়াল পার্টনার"])
        )
    if q.sector:
        terms = [t.strip() for t in q.sector.split(",") if t.strip()]
        if len(terms) > 1:
            sector_conditions = [Opportunity.sector.ilike(f"%{t}%") for t in terms]
            sector_conditions += [Opportunity.title.ilike(f"%{t}%") for t in terms]
            stmt = stmt.where(or_(*sector_conditions))
        else:
            stmt = stmt.where(Opportunity.sector.ilike(f"%{q.sector}%"))
    if q.skill_level:
        stmt = stmt.where(Opportunity.skill_level.ilike(f"%{q.skill_level}%"))
    if q.education_level:
        stmt = stmt.where(
            or_(
                Opportunity.education_min.ilike(f"%{q.education_level}%"),
                Opportunity.degree_level.ilike(f"%{q.education_level}%"),
                Opportunity.education_requirement.ilike(f"%{q.education_level}%"),
            )
        )
    if q.experience_max is not None:
        stmt = stmt.where(
            or_(
                Opportunity.experience_min_years.is_(None),
                Opportunity.experience_min_years <= q.experience_max,
            )
        )
    if q.bangladesh_applicability:
        stmt = stmt.where(Opportunity.bangladesh_applicability == q.bangladesh_applicability)
    if q.source:
        stmt = stmt.where(Opportunity.source_name.ilike(f"%{q.source}%"))
    if q.trust_score_min is not None:
        stmt = stmt.where(Opportunity.trust_score >= q.trust_score_min)
    if q.deadline_from:
        stmt = stmt.where(Opportunity.deadline >= q.deadline_from)
    if q.deadline_to:
        stmt = stmt.where(Opportunity.deadline <= q.deadline_to)
    if q.salary_min is not None:
        stmt = stmt.where(
            or_(Opportunity.salary_max.is_(None), Opportunity.salary_max >= q.salary_min)
        )
    if q.salary_max is not None:
        stmt = stmt.where(
            or_(Opportunity.salary_min.is_(None), Opportunity.salary_min <= q.salary_max)
        )
    if q.fresh_days is not None:
        stmt = stmt.where(
            Opportunity.published_at >= datetime.now(UTC) - timedelta(days=q.fresh_days)
        )
    if q.source_type:
        stmt = stmt.join(Source, Source.id == Opportunity.source_id, isouter=True)
        stmt = stmt.where(Source.source_type == q.source_type)
    if q.saved_only and user_id is not None:
        stmt = stmt.join(
            SavedOpportunity,
            SavedOpportunity.opportunity_id == Opportunity.id,
        ).where(SavedOpportunity.user_id == user_id)
    return stmt


def search_opportunities(
    db: Session, query: PublishedSearchQuery, user_id: int | None = None
) -> PublishedSearchResponse:
    lexical_score = literal(0.0)
    if query.q:
        lexical_score = func.ts_rank_cd(
            Opportunity.search_tsv,
            func.websearch_to_tsquery("simple", query.q),
        )

    semantic_score = literal(0.0)
    stmt = select(
        Opportunity,
        lexical_score.label("lexical_score"),
        semantic_score.label("semantic_score"),
    )

    if query.q and hasattr(query, "semantic_q") and getattr(query, "semantic_q", None):
        vector = embed_query(query.q)
        stmt = stmt.join(
            OpportunityEmbedding,
            OpportunityEmbedding.opportunity_id == Opportunity.id,
            isouter=True,
        )
        semantic_score = (
            1 - OpportunityEmbedding.embedding.cosine_distance(vector)
        ).label("semantic_score")
        stmt = select(Opportunity, lexical_score.label("lexical_score"), semantic_score)

    stmt = _apply_filters(stmt, query, user_id)

    from sqlalchemy import case
    trust_mult = case(
        (Opportunity.source_trust_badge == "সরকারি উৎস", 1.0),
        (Opportunity.source_trust_badge == "অফিসিয়াল পার্টনার", 0.9),
        (Opportunity.source_trust_badge == "যাচাইকৃত উৎস", 0.75),
        else_=0.5,
    )

    final_score = (
        (
            Opportunity.actionability_score * 0.1
            + Opportunity.freshness_score * 0.2
            + Opportunity.trust_score * 0.25
            + lexical_score * 0.25
            + semantic_score * 0.2
        )
        * trust_mult
    ).label("final_score")

    stmt = stmt.add_columns(final_score)

    if query.sort == "newest":
        stmt = stmt.order_by(desc(Opportunity.published_at))
    elif query.sort == "deadline":
        stmt = stmt.order_by(Opportunity.deadline.asc().nulls_last())
    elif query.sort == "official":
        stmt = stmt.order_by(desc(Opportunity.trust_score), desc(final_score))
    elif query.sort == "salary":
        stmt = stmt.order_by(desc(func.coalesce(Opportunity.salary_max, 0)))
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
            id=opp.id,
            title=opp.title,
            title_bn=opp.title_bn,
            opportunity_type=opp.opportunity_type,
            country=opp.country,
            destination_country=opp.destination_country,
            employer_or_organization=opp.employer_or_organization,
            sector=opp.sector,
            platform_category_bn=opp.platform_category_bn,
            platform_category_en=opp.platform_category_en,
            salary_min=float(opp.salary_min) if opp.salary_min is not None else None,
            salary_max=float(opp.salary_max) if opp.salary_max is not None else None,
            salary_currency=opp.salary_currency,
            salary_text=opp.salary_text,
            deadline=opp.deadline,
            source_page_url=opp.source_page_url or "",
            document_url=opp.document_url,
            original_apply_url=opp.original_apply_url,
            content_type=opp.content_type,
            source_name=opp.source_name,
            source_trust_badge=opp.source_trust_badge,
            can_apply_from_bd=opp.can_apply_from_bd,
            requires_existing_work_permit=opp.requires_existing_work_permit,
            open_to_international_candidates=opp.open_to_international_candidates,
            open_to_authorized_workers_only=opp.open_to_authorized_workers_only,
            lmia_status=opp.lmia_status,
            eligibility_status=opp.eligibility_status,
            target_audience_tags=opp.target_audience_tags or [],
            risk_flags=opp.risk_flags or [],
            trust_score=opp.trust_score,
            bangladesh_applicability=opp.bangladesh_applicability,
            rural_user_fit_score=opp.rural_user_fit_score,
            actionability_score=opp.actionability_score,
            overall_rank_score=opp.overall_rank_score,
            published_at=opp.published_at,
            is_saved=opp.id in saved_ids,
            why_this_matches=_why_matches(opp, query.q),
            summary=opp.summary_bn or opp.summary_en,
            summary_bn=opp.summary_bn,
            source_url=opp.source_page_url or "",
            is_active=opp.status == "published",
        )
        for opp, *_ in rows
    ]

    return PublishedSearchResponse(items=items, total=total, page=query.page, page_size=query.page_size)


def get_similar_opportunities(
    db: Session, opportunity_id: int, limit: int = 5
) -> list[PublishedOpportunityCard]:
    base = db.scalar(
        select(Opportunity).where(
            Opportunity.id == opportunity_id,
            Opportunity.status == "published",
            Opportunity.is_active.is_(True),
            Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]),
        )
    )
    if not base:
        return []

    base_emb = db.scalar(
        select(OpportunityEmbedding).where(
            OpportunityEmbedding.opportunity_id == opportunity_id
        )
    )

    if base_emb is not None:
        stmt = (
            select(Opportunity)
            .join(
                OpportunityEmbedding,
                OpportunityEmbedding.opportunity_id == Opportunity.id,
            )
            .where(Opportunity.id != opportunity_id)
            .where(Opportunity.status == "published")
            .where(Opportunity.is_active.is_(True))
            .where(Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]))
            .order_by(OpportunityEmbedding.embedding.cosine_distance(base_emb.embedding))
            .limit(limit)
        )
    else:
        stmt = (
            select(Opportunity)
            .where(Opportunity.id != opportunity_id)
            .where(Opportunity.status == "published")
            .where(Opportunity.is_active.is_(True))
            .where(Opportunity.admin_status.notin_(["hidden", "archived", "inactive", "rejected"]))
            .where(Opportunity.opportunity_type == base.opportunity_type)
            .order_by(desc(Opportunity.overall_rank_score))
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
            platform_category_bn=p.platform_category_bn,
            platform_category_en=p.platform_category_en,
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
            trust_score=p.trust_score, bangladesh_applicability=p.bangladesh_applicability,
            rural_user_fit_score=p.rural_user_fit_score, actionability_score=p.actionability_score,
            overall_rank_score=p.overall_rank_score,
            published_at=p.published_at, is_saved=False,
            why_this_matches="Similar type and eligibility profile.",
            summary=p.summary_bn or p.summary_en,
            summary_bn=p.summary_bn, source_url=p.source_page_url or "",
            is_active=p.status == "published",
        )
        for p in rows
    ]


def _why_matches(opp: Opportunity, q: str | None) -> str:
    if opp.can_apply_from_bd:
        return "বাংলাদেশ থেকে আবেদনযোগ্য"
    if opp.open_to_international_candidates:
        return "আন্তর্জাতিক প্রার্থীদের জন্য উন্মুক্ত"
    if q:
        return f"'{q}' অনুসন্ধানের সাথে মিলেছে"
    return "উৎস বিশ্বাসযোগ্যতা ও প্রাসঙ্গিকতার ভিত্তিতে"
