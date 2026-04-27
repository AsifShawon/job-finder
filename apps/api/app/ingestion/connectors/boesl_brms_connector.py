"""
BOESL BRMS (Bangladesh Overseas Employment and Services Limited — Bureau of Manpower Resources System)
Connector for the BOESL job circular listing pages.

Source config expected:
  connector_key = boesl_brms
  source_type   = job_board
  trust_level   = government_official
  can_apply_from_bd default = True (enforced in eligibility_engine)
  requires_admin_review = True  (BOESL circulars must be reviewed before publishing)
"""
from __future__ import annotations

from datetime import datetime
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.connectors.utils import extract_pdf_links
from app.ingestion.content_detector import detect as detect_content_type
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()
_TIMEOUT = 20.0
_MAX_PAGES = 30


class BOESLBRMSConnector(BaseSourceConnector):
    """Scrapes BOESL job circular listing and detail pages."""

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []

        with httpx.Client(
            timeout=_TIMEOUT,
            headers={"User-Agent": settings.crawler_user_agent},
            follow_redirects=True,
        ) as client:
            listing_links = self._discover_circulars(client, source)
            return self._fetch_circular_pages(client, source, listing_links)

    def _discover_circulars(self, client: httpx.Client, source: Source) -> list[str]:
        """Return detail-page URLs from the circular listing."""
        try:
            resp = client.get(source.base_url)
            resp.raise_for_status()
        except httpx.HTTPError:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        links: list[str] = []
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            if not href:
                continue
            absolute = urljoin(source.base_url, href)
            lower = href.lower()
            # BOESL circular URLs contain keywords like /circular, /notice, /demand
            if any(kw in lower for kw in ["/circular", "/notice", "/demand", "/job", "/brms"]):
                if absolute not in links:
                    links.append(absolute)
            if len(links) >= _MAX_PAGES:
                break
        return links

    def _fetch_circular_pages(
        self, client: httpx.Client, source: Source, urls: list[str]
    ) -> list[FetchedPage]:
        pages: list[FetchedPage] = []
        for url in urls:
            if not is_allowed(url, settings.crawler_user_agent):
                continue
            try:
                resp = client.get(url)
                if resp.status_code >= 400:
                    continue
            except httpx.HTTPError:
                continue

            ct_header = resp.headers.get("content-type", "")
            detected = detect_content_type(url, ct_header)

            if detected == "pdf":
                pages.append(FetchedPage(
                    url=url,
                    canonical_url=url,
                    content_type="pdf",
                    document_url=url,
                    metadata={"source": "boesl_brms", "content_type": ct_header},
                ))
            else:
                soup = BeautifulSoup(resp.text, "html.parser")
                title_tag = soup.select_one("h1, h2, .circular-title, .notice-title")
                title = title_tag.get_text(strip=True) if title_tag else None

                pdf_links = extract_pdf_links(soup, url)
                content_type = "html_with_pdf" if pdf_links else "html"
                doc_url = pdf_links[0] if pdf_links else None

                pages.append(FetchedPage(
                    url=url,
                    canonical_url=url,
                    title=title,
                    raw_html=resp.text,
                    content_type=content_type,
                    document_url=doc_url,
                    metadata={"source": "boesl_brms", "content_type": ct_header},
                ))

                for pdf_url in pdf_links[:3]:
                    if len(pages) >= _MAX_PAGES:
                        break
                    pages.append(FetchedPage(
                        url=pdf_url,
                        canonical_url=pdf_url,
                        title=title,
                        content_type="pdf",
                        document_url=pdf_url,
                        source_page_url=url,
                        metadata={"source": "boesl_brms", "discovery_source": "embedded_pdf"},
                    ))

            if len(pages) >= _MAX_PAGES:
                break
        return pages
