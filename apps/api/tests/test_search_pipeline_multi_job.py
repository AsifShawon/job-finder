from __future__ import annotations

from unittest.mock import MagicMock

from app.ingestion.pipeline import PipelineResult, _process_page
from app.ingestion.schemas import FetchedPage, JobOpportunityExtraction
from app.models.entities import Opportunity, RawDocument, Source
from app.models.enums import AccessMethod, SourceClass, TrustTier


def _make_source() -> Source:
    return Source(
        name="Example Jobs",
        base_url="https://jobs.example.com/",
        root_url="https://jobs.example.com/",
        connector_key="search_html_jobs",
        requires_admin_review=True,
        auto_publish=False,
        trust_level="verified_source",
        source_class=SourceClass.news_policy,
        trust_tier=TrustTier.news_only,
        access_method=AccessMethod.static_html,
        crawl_frequency_minutes=1440,
    )


def _make_page() -> FetchedPage:
    return FetchedPage(
        url="https://jobs.example.com/jobs",
        canonical_url="https://jobs.example.com/jobs",
        title="Current vacancies",
        raw_html="<html><body><h1>Vacancies</h1><p>Apply now</p></body></html>",
        content_type="html",
    )


def _make_db() -> MagicMock:
    db = MagicMock()
    counter = {"raw": 0, "opp": 0}

    def add(obj):
        if isinstance(obj, RawDocument):
            counter["raw"] += 1
            obj.id = counter["raw"]
        if isinstance(obj, Opportunity):
            counter["opp"] += 1
            obj.id = counter["opp"]

    db.add.side_effect = add
    db.flush.side_effect = lambda: None
    db.execute.side_effect = lambda *_args, **_kwargs: None
    return db


def test_process_page_creates_multiple_opportunities(monkeypatch) -> None:
    db = _make_db()
    source = _make_source()
    page = _make_page()
    crawl_run = MagicMock(id=99)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: False)
    monkeypatch.setattr(
        "app.ingestion.pipeline._extract_records_for_page",
        lambda *_args, **_kwargs: [
            JobOpportunityExtraction(
                title="Welder",
                title_bn="ওয়েল্ডার",
                summary="Welder role",
                summary_en="Welder role in Japan.",
                summary_bn="জাপানে ওয়েল্ডার পদ।",
                country="Japan",
                employer="ABC Co",
                application_url="https://jobs.example.com/apply/1",
                requirements=["Valid passport required"],
                extraction_confidence=0.9,
            ),
            JobOpportunityExtraction(
                title="Driver",
                title_bn="ড্রাইভার",
                summary="Driver role",
                summary_en="Driver role in Japan.",
                summary_bn="জাপানে ড্রাইভার পদ।",
                country="Japan",
                employer="ABC Co",
                application_url="https://jobs.example.com/apply/2",
                requirements=["Driving license required"],
                extraction_confidence=0.86,
            ),
        ],
    )
    monkeypatch.setattr("app.ingestion.pipeline.find_existing_opportunity", lambda *args, **kwargs: None)

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="যাচাইকৃত উৎস",
        result=result,
        logs=[],
    )

    created = [call.args[0] for call in db.add.call_args_list if isinstance(call.args[0], Opportunity)]
    assert len(created) == 2
    assert result.draft_created == 2
    assert all(item.source_page_url == "https://jobs.example.com/jobs" for item in created)
    assert all(item.source_item_key for item in created)


def test_process_page_skips_ai_for_unchanged_snapshot(monkeypatch) -> None:
    db = _make_db()
    source = _make_source()
    page = _make_page()
    crawl_run = MagicMock(id=100)
    storage = MagicMock()
    storage.put_text.return_value = "/tmp/raw.html"

    called = {"extract": False}

    def _marker(*_args, **_kwargs):
        called["extract"] = True
        return []

    monkeypatch.setattr("app.ingestion.pipeline.is_latest_snapshot_duplicate", lambda *args, **kwargs: True)
    monkeypatch.setattr("app.ingestion.pipeline._extract_records_for_page", _marker)

    result = PipelineResult()
    _process_page(
        db=db,
        page=page,
        source=source,
        crawl_run=crawl_run,
        storage=storage,
        parser=lambda current_page: {"title": current_page.title},
        trust_badge="যাচাইকৃত উৎস",
        result=result,
        logs=[],
    )

    assert called["extract"] is False
    assert result.duplicates == 1
