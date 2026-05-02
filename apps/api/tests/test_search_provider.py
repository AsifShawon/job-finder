from __future__ import annotations

from app.ingestion.search_provider import SearXNGSearchProvider


class _FakeResponse:
    def __init__(self, payload: dict | None = None, *, status_code: int = 200, text: str = "") -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = text

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")
        return None

    def json(self) -> dict:
        return self._payload or {}


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


class _FallbackClient(_FakeClient):
    def get(self, url: str, params: dict) -> _FakeResponse:
        self.params_store.setdefault("calls", []).append({"url": url, "params": params})
        if params["format"] == "json":
            return _FakeResponse(status_code=403)
        return _FakeResponse(
            text="""
            <html>
              <body>
                <article class="result">
                  <h3><a href="https://jobs.example.com/opening/1">Welder</a></h3>
                  <p class="content">Apply now</p>
                </article>
                <article class="result">
                  <h3><a href="https://jobs.example.com/opening/2">Driver</a></h3>
                  <p class="content">Visa support</p>
                </article>
              </body>
            </html>
            """
        )


def test_searxng_provider_falls_back_to_html_when_json_is_forbidden(monkeypatch) -> None:
    captured: dict = {}
    provider = SearXNGSearchProvider()
    provider.base_url = "https://search.local"
    provider.timeout = 5

    monkeypatch.setattr(
        "app.ingestion.search_provider.httpx.Client",
        lambda **_kwargs: _FallbackClient(params_store=captured),
    )

    results = provider.search("welder jobs", site_domain="https://jobs.example.com", limit=2)

    assert len(results) == 2
    assert captured["calls"][0]["params"]["format"] == "json"
    assert captured["calls"][1]["params"]["format"] == "html"
    assert results[0].url == "https://jobs.example.com/opening/1"
    assert results[0].title == "Welder"
