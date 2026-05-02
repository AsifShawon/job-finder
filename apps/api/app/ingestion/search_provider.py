from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse

import httpx

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
            response.raise_for_status()
            payload = response.json()

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


def get_search_provider() -> SearchProvider:
    settings = get_settings()
    provider = (settings.search_provider or "searxng").strip().lower()
    if provider == "searxng":
        return SearXNGSearchProvider()
    raise RuntimeError(f"Unsupported search provider '{provider}'")
