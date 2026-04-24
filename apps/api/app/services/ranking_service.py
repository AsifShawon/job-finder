from datetime import UTC, datetime

from app.models.enums import TrustTier

TRUST_WEIGHTS = {
    TrustTier.official_gov: 1.0,
    TrustTier.official_partner: 0.9,
    TrustTier.established_portal: 0.7,
    TrustTier.news_only: 0.45,
}


def trust_weight(tier: TrustTier) -> float:
    return TRUST_WEIGHTS.get(tier, 0.4)


def freshness_score(published_at: datetime | None) -> float:
    if not published_at:
        return 0.5
    age_days = max(0, (datetime.now(UTC) - published_at).days)
    return max(0.1, min(1.0, 1.0 - (age_days / 120.0)))


def actionability_score(has_deadline: bool, has_apply_link: bool, has_requirements: bool) -> float:
    score = 0.3
    score += 0.3 if has_deadline else 0.0
    score += 0.25 if has_apply_link else 0.0
    score += 0.15 if has_requirements else 0.0
    return min(score, 1.0)


def final_rank(
    trust: float,
    freshness: float,
    lexical: float,
    semantic: float,
    actionability: float,
) -> float:
    return (0.25 * trust) + (0.2 * freshness) + (0.25 * lexical) + (0.2 * semantic) + (0.1 * actionability)
