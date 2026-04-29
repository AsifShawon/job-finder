from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, SavedOpportunity, UserProfile


def compute_match_score(opp: Opportunity, profile: UserProfile) -> float:
    """Score an opportunity against a user profile (0.0 to 1.0)."""
    score = 0.0

    # Country match — 0.35 weight
    preferred_countries = [c.lower() for c in (profile.preferred_countries_json or [])]
    if preferred_countries:
        if opp.country and opp.country.lower() in preferred_countries:
            score += 0.35
    else:
        score += 0.175  # neutral when no preference set

    # Sector match — 0.30 weight
    preferred_sectors = [s.lower() for s in (profile.preferred_sectors_json or [])]
    if preferred_sectors:
        if opp.sector and opp.sector.lower() in preferred_sectors:
            score += 0.30
    else:
        score += 0.15

    # Opportunity type match — 0.20 weight
    target_types = [t.lower() for t in (profile.target_opportunity_types_json or [])]
    if target_types:
        opp_type = opp.opportunity_type or (opp.record_type.value if opp.record_type else None)
        if opp_type and opp_type.lower() in target_types:
            score += 0.20
    else:
        score += 0.10

    # Education level match — 0.15 weight
    if profile.education_level and opp.degree_level:
        if profile.education_level.lower() in opp.degree_level.lower() or opp.degree_level.lower() in profile.education_level.lower():
            score += 0.15
    else:
        score += 0.075

    return min(score, 1.0)


def has_any_preference(profile: UserProfile) -> bool:
    return bool(
        (profile.preferred_countries_json)
        or (profile.preferred_sectors_json)
        or (profile.target_opportunity_types_json)
        or profile.education_level
    )


def get_recommendations(
    db: Session,
    user_id: int,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[tuple[Opportunity, float | None, bool]], int]:
    """Return (opportunity, match_score|None, is_saved) tuples, plus total count."""
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        profile = UserProfile(user_id=user_id)

    saved_ids: set[int] = {
        row for row in db.scalars(
            select(SavedOpportunity.opportunity_id).where(SavedOpportunity.user_id == user_id)
        ).all()
    }

    # BUG FIX: was Opportunity.is_active.is_(True) which queried pending drafts
    opps = db.scalars(
        select(Opportunity)
        .where(Opportunity.status == "published")
        .order_by(Opportunity.overall_rank_score.desc())
        .limit(200)
    ).all()

    profile_active = has_any_preference(profile)

    scored: list[tuple[Opportunity, float | None]] = []
    for opp in opps:
        if profile_active:
            match = compute_match_score(opp, profile)
            if match < 0.2:
                continue
            scored.append((opp, match))
        else:
            scored.append((opp, None))

    if profile_active:
        scored.sort(key=lambda x: (-(x[1] or 0), -x[0].overall_rank_score))

    total = len(scored)
    start = (page - 1) * page_size
    page_items = scored[start : start + page_size]

    return [(opp, match, opp.id in saved_ids) for opp, match in page_items], total
