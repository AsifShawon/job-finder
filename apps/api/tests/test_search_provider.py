from __future__ import annotations

from app.ingestion.search_provider import SearXNGSearchProvider


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(self, *, params_store: dict) -> None:
        self.params_store = params_store

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def get(self, url: str, params: dict) -> _FakeResponse:
        self.params_store["url"] = url
        self.params_store["params"] = params
        return _FakeResponse(
            {
                "results": [
                    {"url": "https://jobs.example.com/opening/1", "title": "Welder", "content": "Apply now"},
                    {"url": "https://jobs.example.com/opening/2", "title": "Driver", "content": "Visa support"},
                ]
            }
        )


def test_searxng_provider_scopes_query_to_same_domain(monkeypatch) -> None:
    captured: dict = {}
    provider = SearXNGSearchProvider()
    provider.base_url = "https://search.local"
    provider.timeout = 5

    monkeypatch.setattr(
        "app.ingestion.search_provider.httpx.Client",
        lambda **_kwargs: _FakeClient(params_store=captured),
    )

    results = provider.search("welder jobs", site_domain="https://jobs.example.com", limit=2)

    assert len(results) == 2
    assert captured["url"] == "https://search.local/search"
    assert captured["params"]["q"] == "site:jobs.example.com welder jobs"
    assert captured["params"]["format"] == "json"
