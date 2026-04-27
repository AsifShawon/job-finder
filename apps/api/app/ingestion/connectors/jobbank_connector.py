"""
Job Bank (Canada) Connector — linkout_only / open-data mode.

Policy:
  - Job Bank's ToS prohibits automated scraping of individual job detail pages.
  - We use their open-data XML feed when available, or store only search-result
    links with a standardised Bangla warning that the user must visit the
    external site to apply.
  - compliance_status must be 'linkout_only' or 'use_api_only' in the DB.
    The compliance_guard will block scraping if wrongly configured.

Source config expected:
  connector_key    = jobbank_open_data_or_linkout
  compliance_status = linkout_only | use_api_only
  ingestion_mode   = open_data | linkout_only
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from html import unescape
from datetime import datetime
from urllib.parse import urljoin

import httpx

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()
_TIMEOUT = 20.0
_MAX_ITEMS = 50

_RESULT_ITEM_RE = re.compile(
    r'<article\b[^>]*id="article-(?P<job_id>\d+)"[^>]*>(?P<body>.*?)</article>',
    re.IGNORECASE | re.DOTALL,
)
_RESULT_LINK_RE = re.compile(
    r'<a\b[^>]*href="(?P<href>[^"]*jobposting(?:tfw)?/[^"]+)"[^>]*class="[^"]*resultJobItem[^"]*"[^>]*>(?P<body>.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")

# Bangla notice appended to every JobBank listing summary
_LINKOUT_NOTICE_BN = (
    "এই চাকরির বিস্তারিত তথ্য Job Bank Canada-র ওয়েবসাইটে পাওয়া যাবে। "
    "আবেদন করতে নিচের লিংকে যান। আমরা এই সাইটের তথ্য সরাসরি স্ক্র্যাপ করি না।"
)


class JobBankConnector(BaseSourceConnector):
    """
    Fetches Job Bank open-data XML feed.
    Each entry becomes a linkout FetchedPage — no detail scraping.
    """

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        with httpx.Client(
            timeout=_TIMEOUT,
            headers={"User-Agent": settings.crawler_user_agent},
            follow_redirects=True,
        ) as client:
            pages = self._fetch_open_data(client, source)
            if pages:
                return pages

            return self._fetch_search_results_html(client, source)

    def _fetch_open_data(self, client: httpx.Client, source: Source) -> list[FetchedPage]:
        try:
            resp = client.get(source.base_url)
            resp.raise_for_status()
        except httpx.HTTPError:
            return []

        content_type = resp.headers.get("content-type", "")
        if "xml" in content_type or resp.text.lstrip().startswith("<"):
            return self._parse_xml_feed(resp.text, source)

        # JSON open-data format fallback
        try:
            data = resp.json()
            return self._parse_json_feed(data, source)
        except Exception:
            return []

    def _fetch_search_results_html(self, client: httpx.Client, source: Source) -> list[FetchedPage]:
        try:
            resp = client.get(source.base_url)
            resp.raise_for_status()
        except httpx.HTTPError:
            return []

        content_type = resp.headers.get("content-type", "")
        if "html" not in content_type and "<html" not in resp.text[:500].lower():
            return []

        return self._parse_search_results_html(resp.text, source)

    def _parse_search_results_html(self, html_text: str, source: Source) -> list[FetchedPage]:
        pages: list[FetchedPage] = []

        for article_match in _RESULT_ITEM_RE.finditer(html_text):
            article_id = article_match.group("job_id")
            article_html = article_match.group("body")
            link_match = _RESULT_LINK_RE.search(article_html)
            if not link_match:
                continue

            href = link_match.group("href")
            body_html = link_match.group("body")
            canonical_url = urljoin(source.base_url, href)

            title = self._extract_search_result_field(body_html, r'<span class="noctitle">(?P<value>.*?)</span>')
            employer = self._extract_search_result_field(article_html, r'<li class="business">(?P<value>.*?)</li>')
            location = self._extract_search_result_field(article_html, r'<li class="location">(?P<value>.*?)</li>')
            salary = self._extract_search_result_field(article_html, r'<li class="salary">(?P<value>.*?)</li>')
            posted = self._extract_search_result_field(article_html, r'<li class="date">(?P<value>.*?)</li>')

            summary_bits = [bit for bit in [employer, location, salary, posted] if bit]
            summary = " | ".join(summary_bits)
            raw_text = "\n".join(
                [
                    part
                    for part in [
                        title,
                        employer,
                        location,
                        salary,
                        posted,
                        _LINKOUT_NOTICE_BN,
                    ]
                    if part
                ]
            )

            pages.append(
                FetchedPage(
                    url=canonical_url,
                    canonical_url=canonical_url,
                    title=title or None,
                    raw_html=article_html,
                    raw_text=raw_text,
                    content_type="html",
                    source_page_url=source.base_url,
                    extracted_links=[canonical_url],
                    metadata={
                        "source": "jobbank_search_results",
                        "linkout": True,
                        "apply_url": canonical_url,
                        "job_id": article_id,
                        "summary": summary,
                    },
                )
            )

            if len(pages) >= _MAX_ITEMS:
                break

        return pages

    @staticmethod
    def _extract_search_result_field(html_text: str, pattern: str) -> str:
        match = re.search(pattern, html_text, re.IGNORECASE | re.DOTALL)
        if not match:
            return ""
        value = match.group("value")
        value = _TAG_RE.sub(" ", unescape(value))
        return " ".join(value.split())

    def _parse_xml_feed(self, xml_text: str, source: Source) -> list[FetchedPage]:
        pages: list[FetchedPage] = []
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return []

        for item in root.findall(".//item")[:_MAX_ITEMS]:
            link = item.findtext("link")
            title = item.findtext("title")
            description = item.findtext("description") or ""

            if not link:
                continue

            pages.append(FetchedPage(
                url=link,
                canonical_url=link,
                title=title,
                raw_text=f"{description}\n\n{_LINKOUT_NOTICE_BN}",
                content_type="html",
                metadata={
                    "source": "jobbank_open_data",
                    "linkout": True,
                    "apply_url": link,
                },
            ))
        return pages

    def _parse_json_feed(self, data: list | dict, source: Source) -> list[FetchedPage]:
        if isinstance(data, dict):
            data = data.get("jobs") or data.get("results") or []
        pages: list[FetchedPage] = []
        for item in data[:_MAX_ITEMS]:
            if not isinstance(item, dict):
                continue
            link = item.get("url") or item.get("link") or item.get("applyUrl") or ""
            title = item.get("title") or item.get("jobTitle") or ""
            description = item.get("description") or item.get("summary") or ""

            pages.append(FetchedPage(
                url=link or source.base_url,
                canonical_url=link or None,
                title=title,
                raw_text=f"{description}\n\n{_LINKOUT_NOTICE_BN}",
                content_type="html",
                metadata={
                    "source": "jobbank_open_data",
                    "linkout": True,
                    "apply_url": link,
                    "country": item.get("country") or item.get("location"),
                },
            ))
        return pages
