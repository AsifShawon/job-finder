from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup
from dateutil.parser import parse as parse_date

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.connectors.utils import extract_pdf_links
from app.ingestion.content_detector import detect as detect_content_type
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()

MAX_CANDIDATES = 250
MAX_FETCHED_PAGES = 25
REQUEST_TIMEOUT = 20.0
_DEFAULT_SEARCH_TERMS = [
    "Bangladesh jobs",
    "Bangladeshi workers visa",
    "migrant workers Bangladesh",
    "work permit Bangladesh",
    "recruitment policy Bangladesh",
    "job requirements Bangladesh",
]
RELEVANT_TERMS = {
    # Strongest signals - actual job listing vocabulary
    "job circular": 12,
    "circular": 10,
    "vacancy": 12,
    "vacancies": 12,
    "apply now": 11,
    "application deadline": 12,
    "last date of application": 12,
    "apply before": 11,
    "recruitment notice": 11,
    "job opening": 10,
    "positions available": 10,
    "hiring": 8,
    "work permit": 9,
    "visa support": 9,
    "accommodation provided": 8,
    "air ticket": 8,
    "food provided": 7,
    # Requirements vocabulary
    "requirements": 8,
    "eligibility": 8,
    "qualification": 7,
    "experience required": 8,
    "education required": 7,
    "age limit": 8,
    "age requirement": 8,
    "passport required": 9,
    # Job-specific vocabulary
    "salary": 8,
    "monthly salary": 9,
    "basic salary": 9,
    "overseas job": 9,
    "foreign job": 9,
    "abroad": 6,
    "foreign employment": 9,
    "manpower": 7,
    "recruitment agency": 8,
    "employer": 6,
    # Bangladesh-specific official sources
    "boesl": 12,
    "bmet": 12,
    "probashi kallyan": 10,
    "manpower export": 9,
    "overseas employment": 8,
    "migrant worker": 7,
    "bangladeshi workers": 6,
    # Destination countries
    "malaysia": 5,
    "saudi arabia": 5,
    "qatar": 5,
    "germany": 5,
    "canada": 5,
    "italy": 5,
    "south korea": 5,
    "japan": 5,
    "oman": 4,
    "kuwait": 4,
    "bahrain": 4,
    "singapore": 4,
    "united arab emirates": 4,
    "uae": 4,
    # Scholarship vocabulary
    "scholarship": 9,
    "fellowship": 8,
    "bursary": 8,
    "fully funded": 9,
    "stipend": 7,
    "study abroad": 8,
    "application open": 9,
}
NEGATIVE_TERMS = {
    # News article patterns - these indicate statistics reporting not job listings
    "month low",
    "month high",
    "year low",
    "year high",
    "dropped by",
    "fell by",
    "declined by",
    "decreased by",
    "increased by",
    "rose by",
    "grew by",
    "year-on-year",
    "month-on-month",
    "remittance inflow",
    "remittance outflow",
    "bbs data",
    "according to data",
    "according to statistics",
    "research unit",
    "analysts say",
    "experts say",
    "survey shows",
    "report shows",
    "data shows",
    "statistics show",
    "workers deployed",
    "workers sent abroad",
    "lowest since",
    "highest since",
    "labour market analysis",
    "employment trend",
    # Standard web page negatives
    "login",
    "signin",
    "signup",
    "register to read",
    "subscribe to read",
    "advertise with us",
    "privacy policy",
    "terms of service",
    "cookie policy",
    "about us",
    "contact us",
    "newsletter signup",
    "weather forecast",
    "stock market",
    "cryptocurrency",
    "sports news",
    "entertainment",
    "celebrity",
    "sitemap",
    "tag",
    "category",
    "author profile",
}


@dataclass
class CandidateLink:
    url: str
    title: str | None = None
    summary: str | None = None
    published_at: datetime | None = None
    source: str = "link"
    score: int = 0


def _origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _normalize_url(url: str, base_url: str) -> str | None:
    absolute = urljoin(base_url, url.strip())
    parsed = urlparse(absolute)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    cleaned_query = urlencode(
        [(key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True) if not key.lower().startswith("utm_")]
    )
    return urlunparse((parsed.scheme, parsed.netloc.lower(), parsed.path or "/", "", cleaned_query, ""))


def _same_domain(url: str, base_url: str) -> bool:
    base_host = urlparse(base_url).netloc.lower().removeprefix("www.")
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return host == base_host or host.endswith(f".{base_host}")


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except Exception:
        try:
            parsed = parse_date(value, fuzzy=True)
        except Exception:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _is_recent(candidate: CandidateLink, since: datetime | None) -> bool:
    if not since or not candidate.published_at:
        return True
    comparison = since if since.tzinfo else since.replace(tzinfo=UTC)
    return candidate.published_at >= comparison


def _score_candidate(candidate: CandidateLink) -> int:
    import re as _re
    text = " ".join([candidate.url, candidate.title or "", candidate.summary or ""]).lower()
    score = 0

    for term, weight in RELEVANT_TERMS.items():
        if term in text:
            score += weight

    for term in NEGATIVE_TERMS:
        if term in text:
            score -= 18

    # Strongly reward URLs that look like job listing or circular pages
    job_url_signals = [
        "/circular", "/vacancy", "/vacancies", "/job-circular",
        "/recruitment", "/career", "/careers", "/notice",
        "/apply", "/demand", "/hiring", "/post", "/opening",
        "/probashi", "/overseas", "/manpower",
    ]
    for signal in job_url_signals:
        if signal in candidate.url.lower():
            score += 10
            break

    # Strongly penalize URLs that look like news articles
    news_url_signals = [
        "/news/", "/article/", "/articles/", "/story/", "/stories/",
        "/report/", "/reports/", "/analysis/", "/opinion/", "/editorial/",
        "/column/", "/columns/", "/blog/", "/blogs/", "/feature/",
        "/interview/", "/commentary/",
    ]
    for signal in news_url_signals:
        if signal in candidate.url.lower():
            score -= 20
            break

    # Small bonus for pages with date-based URLs (can be either news or circulars)
    if _re.search(r"/20\d{2}/\d{2}/", candidate.url):
        score += 1

    # Bonus if the page has a known publication date (freshness signal)
    if candidate.published_at:
        score += 3

    return score


def _merge_candidate(candidates: dict[str, CandidateLink], candidate: CandidateLink) -> None:
    existing = candidates.get(candidate.url)
    candidate.score = _score_candidate(candidate)
    if existing is None or candidate.score > existing.score:
        candidates[candidate.url] = candidate


def _extract_html_links(html: str, page_url: str, base_url: str, source_name: str) -> list[CandidateLink]:
    soup = BeautifulSoup(html, "html.parser")
    links: list[CandidateLink] = []
    for anchor in soup.select("a[href]")[:400]:
        href = anchor.get("href")
        if not href:
            continue
        normalized = _normalize_url(href, page_url)
        if not normalized or not _same_domain(normalized, base_url):
            continue
        text = " ".join(anchor.stripped_strings)[:220] or None
        links.append(CandidateLink(url=normalized, title=text, source=source_name))
    return links


def _parse_sitemap(xml_text: str, source_name: str) -> tuple[list[str], list[CandidateLink]]:
    root = ET.fromstring(xml_text)
    namespace = root.tag.split("}")[0].strip("{") if root.tag.startswith("{") else ""
    prefix = f"{{{namespace}}}" if namespace else ""
    sitemap_urls: list[str] = []
    page_links: list[CandidateLink] = []

    for sitemap in root.findall(f".//{prefix}sitemap"):
        loc = sitemap.findtext(f"{prefix}loc")
        if loc:
            sitemap_urls.append(loc.strip())

    for url_node in root.findall(f".//{prefix}url"):
        loc = url_node.findtext(f"{prefix}loc")
        if not loc:
            continue
        lastmod = _parse_datetime(url_node.findtext(f"{prefix}lastmod"))
        page_links.append(CandidateLink(url=loc.strip(), published_at=lastmod, source=source_name))

    return sitemap_urls, page_links


def _parse_feed(xml_text: str, feed_url: str) -> list[CandidateLink]:
    root = ET.fromstring(xml_text)
    links: list[CandidateLink] = []
    for item in root.findall(".//item")[:100]:
        link = item.findtext("link")
        if not link:
            continue
        links.append(
            CandidateLink(
                url=link.strip(),
                title=item.findtext("title"),
                summary=item.findtext("description"),
                published_at=_parse_datetime(item.findtext("pubDate")),
                source="rss",
            )
        )
    for entry in root.findall(".//{http://www.w3.org/2005/Atom}entry")[:100]:
        href = None
        for link_node in entry.findall("{http://www.w3.org/2005/Atom}link"):
            href = link_node.attrib.get("href")
            if href:
                break
        if href:
            links.append(
                CandidateLink(
                    url=urljoin(feed_url, href),
                    title=entry.findtext("{http://www.w3.org/2005/Atom}title"),
                    summary=entry.findtext("{http://www.w3.org/2005/Atom}summary"),
                    published_at=_parse_datetime(entry.findtext("{http://www.w3.org/2005/Atom}updated")),
                    source="atom",
                )
            )
    return links


class StaticHTMLConnector(BaseSourceConnector):
    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []

        with httpx.Client(
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": settings.crawler_user_agent, "Accept": "text/html,application/xhtml+xml,application/xml"},
            follow_redirects=True,
        ) as client:
            candidates = self._discover_candidates(client, source, since)
            return self._fetch_pages(client, source, candidates)

    def _discover_candidates(self, client: httpx.Client, source: Source, since: datetime | None) -> list[CandidateLink]:
        candidates: dict[str, CandidateLink] = {}
        base_url = source.base_url
        origin = _origin(base_url)

        for candidate in self._discover_from_robots_and_sitemaps(client, source, since):
            _merge_candidate(candidates, candidate)

        discovery_urls = [
            base_url,
            urljoin(origin, "/feed"),
            urljoin(origin, "/rss"),
            urljoin(origin, "/rss.xml"),
            urljoin(origin, "/sitemap.xml"),
        ]
        active_terms = source.search_queries or _DEFAULT_SEARCH_TERMS
        discovery_urls.extend(urljoin(origin, f"/search?q={term.replace(' ', '+')}") for term in active_terms)
        discovery_urls.extend(urljoin(origin, f"/search/{term.replace(' ', '%20')}") for term in active_terms[:2])

        seen_discovery_urls: set[str] = set()
        for discovery_url in discovery_urls:
            normalized = _normalize_url(discovery_url, base_url)
            if not normalized or normalized in seen_discovery_urls:
                continue
            seen_discovery_urls.add(normalized)
            try:
                response = client.get(normalized)
                if response.status_code >= 400:
                    continue
            except httpx.HTTPError:
                continue

            content_type = response.headers.get("content-type", "")
            if "xml" in content_type or response.text.lstrip().startswith("<"):
                try:
                    feed_links = _parse_feed(response.text, normalized)
                except Exception:
                    feed_links = []
                for link in feed_links:
                    link.url = _normalize_url(link.url, base_url) or link.url
                    if _same_domain(link.url, base_url) and _is_recent(link, since):
                        _merge_candidate(candidates, link)

            if "html" in content_type or "<html" in response.text[:500].lower():
                for link in _extract_html_links(response.text, normalized, base_url, "html"):
                    if _is_recent(link, since):
                        _merge_candidate(candidates, link)

            if len(candidates) >= MAX_CANDIDATES:
                break

        selected = [candidate for candidate in candidates.values() if candidate.score > 0 and _is_recent(candidate, since)]
        selected.sort(key=lambda item: (item.score, item.published_at or datetime.min.replace(tzinfo=UTC)), reverse=True)
        return selected[:MAX_FETCHED_PAGES]

    def _discover_from_robots_and_sitemaps(
        self,
        client: httpx.Client,
        source: Source,
        since: datetime | None,
    ) -> list[CandidateLink]:
        base_url = source.base_url
        origin = _origin(base_url)
        sitemap_urls = [urljoin(origin, "/sitemap.xml")]
        candidates: list[CandidateLink] = []

        try:
            robots = client.get(urljoin(origin, "/robots.txt"))
            if robots.status_code < 400:
                for line in robots.text.splitlines():
                    if line.lower().startswith("sitemap:"):
                        sitemap_urls.append(line.split(":", 1)[1].strip())
        except httpx.HTTPError:
            pass

        seen_sitemaps: set[str] = set()
        while sitemap_urls and len(seen_sitemaps) < 20 and len(candidates) < MAX_CANDIDATES:
            sitemap_url = sitemap_urls.pop(0)
            normalized = _normalize_url(sitemap_url, base_url)
            if not normalized or normalized in seen_sitemaps:
                continue
            seen_sitemaps.add(normalized)
            try:
                response = client.get(normalized)
                if response.status_code >= 400:
                    continue
                nested_sitemaps, links = _parse_sitemap(response.text, "sitemap")
            except Exception:
                continue

            sitemap_urls.extend(nested_sitemaps[:20])
            for link in links:
                link.url = _normalize_url(link.url, base_url) or link.url
                if _same_domain(link.url, base_url) and _is_recent(link, since):
                    candidates.append(link)

        return candidates

    def _fetch_pages(self, client: httpx.Client, source: Source, candidates: list[CandidateLink]) -> list[FetchedPage]:
        pages: list[FetchedPage] = []
        for candidate in candidates:
            if not is_allowed(candidate.url, settings.crawler_user_agent):
                continue
            try:
                response = client.get(candidate.url)
                if response.status_code >= 400:
                    continue
            except httpx.HTTPError:
                continue

            ct_header = response.headers.get("content-type", "")
            detected = detect_content_type(candidate.url, ct_header)

            # Direct PDF URL — hand off as a pdf page (no HTML parsing needed)
            if detected == "pdf":
                pages.append(
                    FetchedPage(
                        url=candidate.url,
                        canonical_url=candidate.url,
                        title=candidate.title,
                        raw_text=None,
                        content_type="pdf",
                        document_url=candidate.url,
                        metadata={"content_type": ct_header},
                    )
                )
                if len(pages) >= MAX_FETCHED_PAGES:
                    break
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            title = candidate.title or (soup.title.text.strip() if soup.title else None)
            canonical = None
            canonical_node = soup.select_one("link[rel='canonical'][href]")
            if canonical_node:
                canonical = _normalize_url(canonical_node.get("href", ""), candidate.url)

            # Detect embedded PDF links in this HTML page
            pdf_links = extract_pdf_links(soup, candidate.url)
            page_content_type = "html_with_pdf" if pdf_links else "html"
            primary_doc_url = pdf_links[0] if pdf_links else None

            pages.append(
                FetchedPage(
                    url=candidate.url,
                    canonical_url=canonical or candidate.url,
                    title=title,
                    raw_html=response.text,
                    content_type=page_content_type,
                    document_url=primary_doc_url,
                    metadata={
                        "status_code": response.status_code,
                        "content_type": ct_header,
                        "discovery_source": candidate.source,
                        "discovery_score": candidate.score,
                        "discovery_published_at": candidate.published_at.isoformat() if candidate.published_at else None,
                    },
                    extracted_links=[],
                )
            )

            # Add a dedicated PDF page entry for each embedded PDF (up to 3)
            for pdf_url in pdf_links[:3]:
                if len(pages) >= MAX_FETCHED_PAGES:
                    break
                pages.append(
                    FetchedPage(
                        url=pdf_url,
                        canonical_url=pdf_url,
                        title=title,
                        content_type="pdf",
                        document_url=pdf_url,
                        source_page_url=candidate.url,
                        metadata={"discovery_source": "embedded_pdf"},
                    )
                )

            if len(pages) >= MAX_FETCHED_PAGES:
                break
        return pages
