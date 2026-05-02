from __future__ import annotations

from app.ingestion.connectors.search_html_jobs_connector import SearchHTMLJobsConnector
from app.ingestion.search_provider import SearchResult
from app.models.entities import Source
from app.models.enums import AccessMethod, SourceClass, TrustTier


HTML_BY_URL = {
    "https://jobs.example.com/": """
        <html><head><title>Careers</title></head><body>
        <a href="/jobs">Open Positions</a>
        </body></html>
    """,
    "https://jobs.example.com/jobs": """
        <html><head><title>Current Jobs</title></head><body>
        <h1>Vacancy List</h1>
        <a href="/jobs/welder">Welder vacancy apply now</a>
        <a href="/jobs/news">Employment news analysis</a>
        </body></html>
    """,
    "https://jobs.example.com/jobs/welder": """
        <html><head><title>Welder in Japan</title></head><body>
        <h1>Welder</h1>
        <p>Application deadline 2026-12-31</p>
        <a href="https://jobs.example.com/apply/welder">Apply now</a>
        </body></html>
    """,
    "https://jobs.example.com/jobs/news": """
        <html><head><title>Labour market news</title></head><body>
        <p>Employment statistics and analysis.</p>
        </body></html>
    """,
}


class _FakeResponse:
    def __init__(self, url: str) -> None:
        self.url = url
        self.status_code = 200
        self.headers = {"content-type": "text/html"}
        self.text = HTML_BY_URL[url]

    def raise_for_status(self) -> None:
        return None


class _FakeHTTPClient:
    def __enter__(self) -> "_FakeHTTPClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def get(self, url: str) -> _FakeResponse:
        return _FakeResponse(url)


class _FakeProvider:
    def search(self, query: str, *, site_domain: str, limit: int) -> list[SearchResult]:
        assert "jobs.example.com" in site_domain
        assert limit == 5
        return [
            SearchResult(url="https://jobs.example.com/jobs", title="Current Jobs", snippet="Vacancy list"),
            SearchResult(url="https://jobs.example.com/jobs/news", title="Labour market news", snippet="Analysis"),
        ]


def _make_source() -> Source:
    return Source(
        name="Example Jobs",
        base_url="https://jobs.example.com/",
        root_url="https://jobs.example.com/",
        connector_key="search_html_jobs",
        search_queries=["welder jobs"],
        search_results_limit=5,
        child_page_limit=3,
        page_ai_limit=10,
        max_jobs_per_page=10,
        source_class=SourceClass.news_policy,
        trust_tier=TrustTier.news_only,
        access_method=AccessMethod.static_html,
        crawl_frequency_minutes=1440,
    )


def test_search_html_jobs_connector_discovers_child_pages(monkeypatch) -> None:
    connector = SearchHTMLJobsConnector()
    source = _make_source()

    monkeypatch.setattr("app.ingestion.connectors.search_html_jobs_connector.is_allowed", lambda *_args, **_kwargs: True)
    monkeypatch.setattr("app.ingestion.connectors.search_html_jobs_connector.get_search_provider", lambda: _FakeProvider())
    monkeypatch.setattr("app.ingestion.connectors.search_html_jobs_connector.httpx.Client", lambda **_kwargs: _FakeHTTPClient())

    pages = connector.discover_items(source, crawl_mode="preview_only")
    urls = {page.url for page in pages}
    diagnostics = connector.get_last_discovery_diagnostics()

    assert "https://jobs.example.com/jobs" in urls
    assert "https://jobs.example.com/jobs/welder" in urls
    assert diagnostics["queries_used"] == ["welder jobs"]
    assert diagnostics["search_results_found"] == 2
    assert diagnostics["child_pages_followed"] >= 1
    assert diagnostics["pages_selected_for_ai"] == len(pages)
