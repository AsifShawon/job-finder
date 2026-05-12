from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings


@dataclass
class SearchResult:
    url: str
    title: str | None = None
    snippet: str | None = None
    score: float | None = None


class SearchProvider(Protocol):
    def search(self, query: str, *, site_domain: str, limit: int) -> list[SearchResult]:
        raise NotImplementedError


def _normalize_site_domain(domain_or_url: str) -> str:
    parsed = urlparse(domain_or_url)
    host = parsed.netloc or parsed.path
    return host.lower().removeprefix("www.")


class SearXNGSearchProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.search_provider_base_url.rstrip("/")
        self.timeout = self.settings.search_provider_timeout_seconds
        self.api_key = self.settings.search_provider_api_key

    def search(self, query: str, *, site_domain: str, limit: int) -> list[SearchResult]:
        if not self.base_url:
            raise RuntimeError("SEARCH_PROVIDER_BASE_URL is not configured")

        domain = _normalize_site_domain(site_domain)
        scoped_query = f"site:{domain} {query}".strip()
        headers = {"Accept": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        with httpx.Client(timeout=self.timeout, follow_redirects=True, headers=headers) as client:
            response = client.get(
                f"{self.base_url}/search",
                params={
                    "q": scoped_query,
                    "format": "json",
                    "language": "en",
                },
            )
            if response.status_code == 403:
                return self._search_html(client, scoped_query, limit)
            response.raise_for_status()
            payload = response.json()

        return self._parse_json_results(payload, limit)

    def _search_html(
        self, client: httpx.Client, scoped_query: str, limit: int
    ) -> list[SearchResult]:
        response = client.get(
            f"{self.base_url}/search",
            params={
                "q": scoped_query,
                "format": "html",
                "language": "en",
            },
        )
        response.raise_for_status()
        return self._parse_html_results(response.text, limit)

    @staticmethod
    def _parse_json_results(payload: dict, limit: int) -> list[SearchResult]:
        results: list[SearchResult] = []
        for item in (payload.get("results") or [])[:limit]:
            url = item.get("url")
            if not url:
                continue
            results.append(
                SearchResult(
                    url=url,
                    title=item.get("title"),
                    snippet=item.get("content") or item.get("snippet"),
                    score=float(item["score"]) if item.get("score") is not None else None,
                )
            )
        return results

    @staticmethod
    def _parse_html_results(html: str, limit: int) -> list[SearchResult]:
        soup = BeautifulSoup(html, "html.parser")
        results: list[SearchResult] = []
        for article in soup.select("article.result")[:limit]:
            anchor = article.select_one("h3 a")
            if not anchor:
                anchor = article.select_one("a")
            url = (anchor.get("href") or "").strip() if anchor else ""
            if not url:
                continue
            snippet_node = article.select_one(".content")
            results.append(
                SearchResult(
                    url=url,
                    title=anchor.get_text(" ", strip=True) if anchor else None,
                    snippet=snippet_node.get_text(" ", strip=True) if snippet_node else None,
                )
            )
        return results


class DuckDuckGoSearchProvider:
    """Open-source fallback that uses the duckduckgo-search package — no API
    key, no self-hosting. Used when SearXNG is unavailable, and as the default
    provider for the agentic discovery flow."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.timeout = self.settings.search_provider_timeout_seconds

    def search(self, query: str, *, site_domain: str = "", limit: int = 10) -> list[SearchResult]:
        try:
            # Lazy import — duckduckgo-search is an optional dep at install time.
            from duckduckgo_search import DDGS  # type: ignore[import-not-found]
        except ImportError as exc:
            raise RuntimeError(
                "duckduckgo-search not installed; pip install duckduckgo-search"
            ) from exc

        scoped_query = query
        if site_domain:
            domain = _normalize_site_domain(site_domain)
            scoped_query = f"site:{domain} {query}".strip()

        results: list[SearchResult] = []
        try:
            with DDGS(timeout=int(self.timeout)) as ddgs:
                for item in ddgs.text(scoped_query, max_results=limit) or []:
                    url = item.get("href") or item.get("url")
                    if not url:
                        continue
                    results.append(
                        SearchResult(
                            url=url,
                            title=item.get("title"),
                            snippet=item.get("body") or item.get("snippet"),
                        )
                    )
        except Exception as exc:  # network failure, rate limit, etc.
            raise RuntimeError(f"DuckDuckGo search failed: {exc}") from exc

        return results


def get_search_provider() -> SearchProvider:
    """Return the configured SearchProvider. Defaults to SearXNG; falls back to
    DuckDuckGo if SEARCH_PROVIDER=duckduckgo is set or if SearXNG is unreachable."""
    settings = get_settings()
    provider = (settings.search_provider or "searxng").strip().lower()
    if provider == "duckduckgo":
        return DuckDuckGoSearchProvider()
    if provider == "searxng":
        return SearXNGSearchProvider()
    raise RuntimeError(f"Unsupported search provider '{provider}'")


def get_fallback_search_provider() -> SearchProvider:
    """Used by the discovery agent when the primary provider fails."""
    return DuckDuckGoSearchProvider()
