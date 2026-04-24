from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.entities import Opportunity, Source, User, UserProfile
from app.models.enums import AccessMethod, RecordType, SourceClass, TrustTier


def seed_sources() -> list[Source]:
    return [
        Source(
            name="Bangladesh BMET",
            base_url="https://www.bmet.gov.bd",
            country="Bangladesh",
            source_class=SourceClass.bd_migration,
            trust_tier=TrustTier.official_gov,
            access_method=AccessMethod.static_html,
            crawl_frequency_minutes=720,
            parser_key="bd_bmet_default",
            is_active=True,
        ),
        Source(
            name="EURES Jobs",
            base_url="https://eures.europa.eu",
            country="EU",
            source_class=SourceClass.foreign_jobs,
            trust_tier=TrustTier.official_partner,
            access_method=AccessMethod.rss,
            crawl_frequency_minutes=360,
            parser_key="default",
            is_active=True,
        ),
        Source(
            name="DAAD Scholarships",
            base_url="https://www.daad.de/en/",
            country="Germany",
            source_class=SourceClass.scholarship,
            trust_tier=TrustTier.official_partner,
            access_method=AccessMethod.static_html,
            crawl_frequency_minutes=1440,
            parser_key="scholarship_generic",
            is_active=True,
        ),
        Source(
            name="Migration Policy News",
            base_url="https://example.com/policy-feed",
            country="Global",
            source_class=SourceClass.news_policy,
            trust_tier=TrustTier.news_only,
            access_method=AccessMethod.rss,
            crawl_frequency_minutes=240,
            parser_key="policy_news_default",
            is_active=True,
        ),
    ]


def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(Source.id).limit(1)) is None:
            sources = seed_sources()
            db.add_all(sources)
            db.commit()

        if db.scalar(select(User.id).where(User.email == "admin@example.com")) is None:
            admin = User(
                full_name="Platform Admin",
                email="admin@example.com",
                hashed_password=get_password_hash("Admin12345!"),
                is_admin=True,
            )
            db.add(admin)
            db.flush()
            db.add(UserProfile(user_id=admin.id, preferred_countries_json=["Canada", "Germany"]))
            db.commit()

        source = db.scalar(select(Source).where(Source.name == "EURES Jobs"))
        if source and db.scalar(select(Opportunity.id).limit(1)) is None:
            db.add_all(
                [
                    Opportunity(
                        record_type=RecordType.job,
                        title="Warehouse Associate - Ontario",
                        summary="Entry-level warehouse role with structured onboarding.",
                        country="Canada",
                        city="Ontario",
                        employer="Northbay Logistics",
                        sector="Logistics",
                        degree_level="HSC",
                        salary_min=2200,
                        salary_max=2900,
                        salary_currency="CAD",
                        deadline=(datetime.now(UTC) + timedelta(days=45)).date(),
                        application_url="https://example.com/jobs/warehouse-ontario",
                        visa_support=True,
                        source_id=source.id,
                        source_url="https://example.com/jobs/warehouse-ontario",
                        trust_score=0.9,
                        freshness_score=0.95,
                        actionability_score=0.85,
                        extraction_confidence=0.78,
                        overall_rank_score=0.88,
                        is_active=True,
                        requirements_json={"items": ["Basic English", "Physical fitness"]},
                        benefits_json={"items": ["Accommodation support"]},
                        language_requirements_json={"items": ["English"]},
                        published_at=datetime.now(UTC),
                        last_verified_at=datetime.now(UTC),
                    ),
                    Opportunity(
                        record_type=RecordType.scholarship,
                        title="Engineering Scholarship in Germany",
                        summary="Funded scholarship for Bangladeshi engineering graduates.",
                        country="Germany",
                        organization="DAAD",
                        sector="Education",
                        funding_type="Fully funded",
                        deadline=(datetime.now(UTC) + timedelta(days=60)).date(),
                        application_url="https://example.com/scholarships/engineering-germany",
                        source_id=source.id,
                        source_url="https://example.com/scholarships/engineering-germany",
                        trust_score=0.87,
                        freshness_score=0.92,
                        actionability_score=0.8,
                        extraction_confidence=0.81,
                        overall_rank_score=0.84,
                        is_active=True,
                        requirements_json={"items": ["Bachelor in engineering", "IELTS 6.5+"]},
                        benefits_json={"items": ["Tuition", "Stipend"]},
                        language_requirements_json={"items": ["English"]},
                        published_at=datetime.now(UTC),
                        last_verified_at=datetime.now(UTC),
                    ),
                ]
            )
            db.commit()


if __name__ == "__main__":
    seed()
    print("Seed completed")
