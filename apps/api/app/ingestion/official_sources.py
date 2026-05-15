from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.entities import Source
from app.models.enums import AccessMethod, SourceClass, TrustTier


OFFICIAL_SOURCE_SEEDS = [
    {
        "name": "alfanar Official Careers",
        "base_url": "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/",
        "connector_key": "successfactors_alfanar",
        "settings_json": {"company": "alfanar", "country_hint": "Saudi Arabia", "missing_inactive_threshold": 3},
    },
    {
        "name": "Aramco European Candidates Careers",
        "base_url": "https://careers.aramco.com/expat_uk/go/For-European-Candidates/7717923#content",
        "connector_key": "successfactors_aramco",
        "settings_json": {"company": "Aramco", "country_hint": "Saudi Arabia", "conservative": True, "missing_inactive_threshold": 3},
    },
    {
        "name": "Tamimi Official Careers",
        "base_url": "https://tamimi.sa/careers.php",
        "connector_key": "tamimi_careers",
        "settings_json": {"company": "Abdulmohsen Al-Tamimi Group", "country_hint": "Saudi Arabia", "missing_inactive_threshold": 3},
    },
    {
        "name": "Maharah Posts",
        "base_url": "https://maharah.com/en/post/",
        "connector_key": "maharah_posts",
        "settings_json": {"company": "Maharah", "country_hint": "Saudi Arabia", "post_intelligence": True, "missing_inactive_threshold": 3},
    },
]


def ensure_official_sources(db: Session) -> None:
    changed = False
    for seed in OFFICIAL_SOURCE_SEEDS:
        source = db.scalar(select(Source).where(Source.name == seed["name"]))
        if source is None:
            source = Source(
                name=seed["name"],
                root_url=seed["base_url"],
                base_url=seed["base_url"],
                country="Saudi Arabia",
                source_type="job_board",
                ingestion_mode="html",
                connector_key=seed["connector_key"],
                trust_level="official_partner",
                compliance_status="allowed",
                crawl_frequency="weekly",
                first_crawl_mode="backfill_all",
                target_audience=["bangladeshi_applicants", "low_skilled_workers", "skilled_workers"],
                search_keywords=["electrician", "technician", "mechanic", "driver", "worker", "cleaner", "waiter", "welder"],
                enabled=True,
                requires_admin_review=True,
                feed_type="html",
                auto_publish=False,
                is_active=True,
                source_class=SourceClass.foreign_jobs,
                trust_tier=TrustTier.official_partner,
                access_method=AccessMethod.static_html,
                parser_key="default",
                crawl_frequency_minutes=10080,
            )
            db.add(source)
            changed = True
        before = (
            source.root_url, source.base_url, source.connector_key, source.trust_level,
            source.compliance_status, source.enabled, source.is_active,
            source.is_official_seed_source, source.is_deletable, source.settings_json,
        )
        source.root_url = seed["base_url"]
        source.base_url = seed["base_url"]
        source.connector_key = seed["connector_key"]
        source.trust_level = "official_partner"
        source.compliance_status = "allowed"
        source.enabled = True
        source.is_active = True
        source.is_official_seed_source = True
        source.is_deletable = False
        source.settings_json = seed["settings_json"]
        after = (
            source.root_url, source.base_url, source.connector_key, source.trust_level,
            source.compliance_status, source.enabled, source.is_active,
            source.is_official_seed_source, source.is_deletable, source.settings_json,
        )
        changed = changed or before != after
    if changed:
        db.commit()
