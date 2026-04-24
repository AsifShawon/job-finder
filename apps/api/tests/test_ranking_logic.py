from datetime import UTC, datetime, timedelta

from app.services.ranking_service import actionability_score, final_rank, freshness_score, trust_weight
from app.models.enums import TrustTier


def test_trust_weight_prefers_official() -> None:
    assert trust_weight(TrustTier.official_gov) > trust_weight(TrustTier.news_only)


def test_freshness_score_decreases_with_age() -> None:
    now_score = freshness_score(datetime.now(UTC))
    old_score = freshness_score(datetime.now(UTC) - timedelta(days=120))
    assert now_score > old_score


def test_final_rank_in_bounds() -> None:
    rank = final_rank(0.9, 0.7, 0.8, 0.6, actionability_score(True, True, True))
    assert 0.0 <= rank <= 1.0
