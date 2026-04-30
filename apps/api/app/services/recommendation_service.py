from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Opportunity, SavedOpportunity, UserProfile

ISC_TO_SEARCH_TERMS: dict[str, list[str]] = {
    "construction_isc":    ["construction", "civil", "mason", "welder", "carpenter", "plumber", "electrician"],
    "ict_isc":             ["IT", "software", "developer", "tech", "digital", "programmer", "network"],
    "agrofood_isc":        ["food processing", "agriculture", "farm", "fishery", "food", "dairy"],
    "tourism_isc":         ["hotel", "hospitality", "restaurant", "tourism", "cook", "waiter", "chef"],
    "rgt_isc":             ["garments", "textile", "sewing", "fabric", "apparel", "tailoring"],
    "leather_isc":         ["leather", "footwear", "tannery", "shoe"],
    "light_eng_isc":       ["engineering", "mechanic", "lathe", "machinist", "fitter", "welder"],
    "jute_isc":            ["jute", "fiber", "yarn"],
    "ceramic_isc":         ["ceramic", "tile", "pottery", "glass"],
    "pharma_isc":          ["pharmaceutical", "medicine", "laboratory", "pharmacy", "medical"],
    "furniture_isc":       ["furniture", "carpentry", "wood", "cabinet"],
    "plastics_isc":        ["plastic", "polymer", "molding", "packaging"],
    "creative_media_isc":  ["media", "graphic", "video", "design", "creative", "photography"],
    "agriculture_isc":     ["agriculture", "farming", "crop", "livestock", "poultry"],
    "informal_isc":        ["general", "labor", "helper", "driver", "cleaner", "domestic", "security"],
}


def compute_match_score(opp: Opportunity, profile: UserProfile) -> float:
    """Score an opportunity against a user profile (0.0 to 1.0)."""
    score = 0.0

    # --- ISC SECTOR MATCH — weight 0.45 ---
    isc_keys = profile.preferred_sectors_json or []
    if isc_keys:
        opp_text = " ".join(filter(None, [
            opp.title or "",
            opp.sector or "",
            opp.summary_en or "",
            opp.summary or "",
            opp.employer_or_organization or "",
        ])).lower()

        best_isc_score = 0.0
        for key in isc_keys:
            terms = ISC_TO_SEARCH_TERMS.get(key, [])
            matched_terms = sum(1 for t in terms if t.lower() in opp_text)
            if matched_terms > 0:
                term_score = min(matched_terms / max(len(terms), 1), 1.0)
                best_isc_score = max(best_isc_score, term_score)

        score += 0.25 + (best_isc_score * 0.20)
    else:
        score += 0.15

    # --- COUNTRY MATCH — weight 0.35 ---
    preferred_countries = [c.lower() for c in (profile.preferred_countries_json or [])]
    if preferred_countries:
        opp_country = (opp.country or opp.destination_country or "").lower()
        if opp_country and any(
            c in opp_country or opp_country in c for c in preferred_countries
        ):
            score += 0.35
        else:
            score += 0.05
    else:
        score += 0.175

    # --- OPPORTUNITY TYPE MATCH — weight 0.15 ---
    target_types = [t.lower() for t in (profile.target_opportunity_types_json or [])]
    if target_types:
        opp_type = opp.opportunity_type or (
            opp.record_type.value if opp.record_type else None
        )
        if opp_type and opp_type.lower() in target_types:
            score += 0.15
    else:
        score += 0.075

    # --- EDUCATION MATCH — weight 0.05 ---
    if profile.education_level and opp.degree_level:
        if (
            profile.education_level.lower() in opp.degree_level.lower()
            or opp.degree_level.lower() in profile.education_level.lower()
        ):
            score += 0.05
    else:
        score += 0.025

    return min(score, 1.0)


def get_matching_isc_label(opp: Opportunity, isc_keys: list[str]) -> str | None:
    """Returns the first ISC key that matches this opportunity, or None."""
    opp_text = " ".join(filter(None, [
        opp.title or "", opp.sector or "", opp.summary_en or ""
    ])).lower()
    for key in isc_keys:
        terms = ISC_TO_SEARCH_TERMS.get(key, [])
        if any(t.lower() in opp_text for t in terms):
            return key
    return None


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
) -> tuple[list[tuple[Opportunity, float | None, bool, str | None]], int]:
    """Return (opportunity, match_score|None, is_saved, isc_match_key|None) tuples, plus total count."""
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == user_id))
    if profile is None:
        profile = UserProfile(user_id=user_id)

    saved_ids: set[int] = {
        row for row in db.scalars(
            select(SavedOpportunity.opportunity_id).where(SavedOpportunity.user_id == user_id)
        ).all()
    }

    opps = db.scalars(
        select(Opportunity)
        .where(Opportunity.status == "published")
        .order_by(Opportunity.overall_rank_score.desc())
        .limit(200)
    ).all()

    profile_active = has_any_preference(profile)
    profile_isc_keys = profile.preferred_sectors_json or []

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

    return [
        (opp, match, opp.id in saved_ids, get_matching_isc_label(opp, profile_isc_keys))
        for opp, match in page_items
    ], total
