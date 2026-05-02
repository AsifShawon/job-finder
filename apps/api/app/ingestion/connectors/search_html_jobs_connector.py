from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.connectors.utils import extract_pdf_links
from app.ingestion.content_detector import detect as detect_content_type
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.ingestion.search_provider import SearchResult, get_search_provider
from app.models.entities import Source

settings = get_settings()
_DEFAULT_QUERY_LIMIT = 5
_DEFAULT_RESULTS_LIMIT = 10
_DEFAULT_CHILD_LIMIT = 10
_DEFAULT_PAGE_AI_LIMIT = 25

_JOB_TERMS = {
    "job circular": 12,
    "vacancy": 11,
    "vacancies": 11,
    "apply now": 11,
    "application deadline": 12,
    "recruitment": 10,
    "career": 8,
    "careers": 8,
    "hiring": 8,
    "job": 6,
    "position": 5,
    "salary": 6,
    "requirement": 6,
    "requirements": 6,
    "eligibility": 6,
    "work permit": 8,
    "visa": 6,
}

_NEGATIVE_TERMS = {
    "news": -6,
    "article": -6,
    "analysis": -6,
    "opinion": -8,
    "statistics": -8,
    "trend": -8,
    "cookie": -10,
    "privacy": -10,
    "terms": -10,
    "login": -8,
    "signin": -8,
}


@dataclass
class _QueuedCandidate:
    url: str
    score: int
    depth: int
    discovery_source: str
    parent_url: str | None = None
    title: str | None = None
    snippet: str | None = None


def _normalize_url(url: str, base_url: str) -> str | None:
    absolute = urljoin(base_url, url.strip())
    parsed = urlparse(absolute)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    cleaned_query = urlencode(
        [
            (key, value)
            for key, value in parse_qsl(parsed.query, keep_blank_values=True)
            if not key.lower().startswith("utm_")
        ]
    )
    return urlunparse((parsed.scheme, parsed.netloc.lower(), parsed.path or "/", "", cleaned_query, ""))


def _same_domain(url: str, base_url: str) -> bool:
    base_host = urlparse(base_url).netloc.lower().removeprefix("www.")
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return host == base_host or host.endswith(f".{base_host}")


def _score_text(parts: Iterable[str | None]) -> int:
    text = " ".join(part for part in parts if part).lower()
    score = 0
    for term, weight in _JOB_TERMS.items():
        if term in text:
            score += weight
    for term, penalty in _NEGATIVE_TERMS.items():
        if term in text:
            score += penalty
    return score


def _score_result(result: SearchResult) -> int:
    url = result.url.lower()
    score = _score_text([result.title, result.snippet, url])
    if any(segment in url for segment in ("/job", "/jobs", "/career", "/careers", "/recruit", "/vacan", "/opening")):
        score += 8
    return score


def _extract_same_domain_links(soup: BeautifulSoup, page_url: str, base_url: str) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    for anchor in soup.select("a[href]")[:250]:
        href = anchor.get("href")
        if not href:
            continue
        normalized = _normalize_url(href, page_url)
        if not normalized or not _same_domain(normalized, base_url):
            continue
        text = " ".join(anchor.stripped_strings)[:240]
        links.append((normalized, text))
    return links


def _looks_like_listing_page(url: str, title: str | None, links: list[tuple[str, str]]) -> bool:
    listing_score = _score_text([url, title]) + len([text for _, text in links if _score_text([text]) >= 5])
    return listing_score >= 18 and len(links) >= 3


class SearchHTMLJobsConnector(BaseSourceConnector):
    connector_key = "search_html_jobs"

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        self.last_discovery_diagnostics = {
            "queries_used": [],
            "search_results_found": 0,
            "child_pages_followed": 0,
            "pages_selected_for_ai": 0,
        }
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []

        query_terms = self._build_queries(source)
        self.last_discovery_diagnostics["queries_used"] = query_terms
        results_limit = max(1, source.search_results_limit or _DEFAULT_RESULTS_LIMIT)
        child_limit = max(0, source.child_page_limit or _DEFAULT_CHILD_LIMIT)
        page_ai_limit = max(1, source.page_ai_limit or _DEFAULT_PAGE_AI_LIMIT)

        provider = get_search_provider()
        candidate_map: dict[str, _QueuedCandidate] = {}
        for query in query_terms:
            for result in provider.search(query, site_domain=source.base_url, limit=results_limit):
                normalized = _normalize_url(result.url, source.base_url)
                if not normalized or not _same_domain(normalized, source.base_url):
                    continue
                scored = _score_result(result)
                if scored <= 0:
                    continue
                existing = candidate_map.get(normalized)
                if existing is None or scored > existing.score:
                    candidate_map[normalized] = _QueuedCandidate(
                        url=normalized,
                        score=scored,
                        depth=0,
                        discovery_source="search",
                        title=result.title,
                        snippet=result.snippet,
                    )
        self.last_discovery_diagnostics["search_results_found"] = len(candidate_map)

        root_url = _normalize_url(source.base_url, source.base_url)
        if root_url:
            candidate_map.setdefault(
                root_url,
                _QueuedCandidate(
                    url=root_url,
                    score=100,
                    depth=0,
                    discovery_source="root",
                    title=source.name,
                ),
            )

        queue = deque(
            sorted(candidate_map.values(), key=lambda item: (item.score, -item.depth), reverse=True)
        )
        seen_urls: set[str] = set()
        pages: list[FetchedPage] = []

        with httpx.Client(
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": settings.crawler_user_agent, "Accept": "text/html,application/xhtml+xml,application/xml"},
        ) as client:
            while queue and len(pages) < page_ai_limit:
                candidate = queue.popleft()
                if candidate.url in seen_urls or not is_allowed(candidate.url, settings.crawler_user_agent):
                    continue
                seen_urls.add(candidate.url)
                try:
                    response = client.get(candidate.url)
                    response.raise_for_status()
                except httpx.HTTPError:
                    continue

                content_type = response.headers.get("content-type", "")
                detected_type = detect_content_type(candidate.url, content_type)
                if detected_type == "pdf":
                    pages.append(
                        FetchedPage(
                            url=candidate.url,
                            canonical_url=candidate.url,
                            title=candidate.title,
                            content_type="pdf",
                            document_url=candidate.url,
                            source_page_url=candidate.url,
                            metadata={
                                "discovery_source": candidate.discovery_source,
                                "discovery_score": candidate.score,
                                "depth": candidate.depth,
                            },
                        )
                    )
                    continue

                soup = BeautifulSoup(response.text, "html.parser")
                title = candidate.title or (soup.title.text.strip() if soup.title else None)
                canonical_node = soup.select_one("link[rel='canonical'][href]")
                canonical_url = (
                    _normalize_url(canonical_node.get("href", ""), candidate.url) if canonical_node else candidate.url
                )
                page_links = _extract_same_domain_links(soup, candidate.url, source.base_url)
                pdf_links = extract_pdf_links(soup, candidate.url)
                listing_page = _looks_like_listing_page(candidate.url, title, page_links)

                pages.append(
                    FetchedPage(
                        url=candidate.url,
                        canonical_url=canonical_url or candidate.url,
                        title=title,
                        raw_html=response.text,
                        extracted_links=[url for url, _ in page_links[:50]],
                        content_type="html_with_pdf" if pdf_links else "html",
                        document_url=pdf_links[0] if pdf_links else None,
                        source_page_url=candidate.url,
                        metadata={
                            "discovery_source": candidate.discovery_source,
                            "discovery_score": candidate.score,
                            "depth": candidate.depth,
                            "listing_page": listing_page,
                            "search_snippet": candidate.snippet,
                            "parent_url": candidate.parent_url,
                        },
                    )
                )

                for pdf_url in pdf_links[:2]:
                    if len(pages) >= page_ai_limit:
                        break
                    pages.append(
                        FetchedPage(
                            url=pdf_url,
                            canonical_url=pdf_url,
                            title=title,
                            content_type="pdf",
                            document_url=pdf_url,
                            source_page_url=candidate.url,
                            metadata={"discovery_source": "embedded_pdf", "depth": candidate.depth + 1},
                        )
                    )

                if listing_page and child_limit > 0:
                    followed = 0
                    for child_url, child_text in page_links:
                        if child_url in seen_urls or any(item.url == child_url for item in queue):
                            continue
                        child_score = _score_text([child_url, child_text])
                        if child_score <= 0:
                            continue
                        queue.append(
                            _QueuedCandidate(
                                url=child_url,
                                score=child_score,
                                depth=candidate.depth + 1,
                                discovery_source="child_link",
                                parent_url=candidate.url,
                                title=child_text or None,
                            )
                        )
                        followed += 1
                        if followed >= child_limit:
                            break
                    self.last_discovery_diagnostics["child_pages_followed"] += followed

        self.last_discovery_diagnostics["pages_selected_for_ai"] = len(pages)
        return pages[:page_ai_limit]

    def _build_queries(self, source: Source) -> list[str]:
        raw_terms = source.search_queries or source.search_keywords or []
        normalized_terms = [term.strip() for term in raw_terms if term and term.strip()]
        if not normalized_terms:
            normalized_terms = [
                f"{source.name} jobs",
                f"{source.name} careers",
                f"{source.name} recruitment",
            ]
        return normalized_terms[:_DEFAULT_QUERY_LIMIT]
