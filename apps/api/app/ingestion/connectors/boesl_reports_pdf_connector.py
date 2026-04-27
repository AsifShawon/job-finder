"""
BOESL Reports / Notices PDF Connector.
Crawls a BOESL reports or annual publications page and fetches embedded PDF documents.
Falls back to OCR when PyMuPDF yields no useful text (scanned circulars).

Source config expected:
  connector_key = boesl_reports_pdf
  ingestion_mode = html_with_pdf | pdf
  trust_level    = government_official
  requires_admin_review = True
"""
from __future__ import annotations

from datetime import datetime
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.connectors.utils import extract_pdf_links
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()
_TIMEOUT = 30.0
_MAX_PAGES = 20


class BOESLReportsPDFConnector(BaseSourceConnector):
    """
    Fetches the BOESL reports/publications index page and returns
    FetchedPage entries for every PDF found (content_type='pdf').
    PDF text extraction + OCR is handled by the pipeline.
    """

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
            return self._scrape_index(client, source)

    def _scrape_index(self, client: httpx.Client, source: Source) -> list[FetchedPage]:
        pages: list[FetchedPage] = []
        urls_to_visit = [source.base_url]

        # Also try common BOESL sub-paths
        for suffix in ["/reports", "/publications", "/annual-report", "/circulars", "/notice"]:
            urls_to_visit.append(urljoin(source.base_url, suffix))

        seen: set[str] = set()
        for page_url in urls_to_visit:
            if page_url in seen:
                continue
            seen.add(page_url)
            try:
                resp = client.get(page_url)
                if resp.status_code >= 400:
                    continue
            except httpx.HTTPError:
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            pdf_links = extract_pdf_links(soup, page_url)

            for pdf_url in pdf_links:
                if pdf_url in seen:
                    continue
                seen.add(pdf_url)

                # Try to get a title from the anchor text linking to this PDF
                title = None
                for a in soup.select(f"a[href]"):
                    href = a.get("href", "")
                    if href and pdf_url.endswith(href.lstrip("/")):
                        title = a.get_text(strip=True) or None
                        break

                pages.append(FetchedPage(
                    url=pdf_url,
                    canonical_url=pdf_url,
                    title=title,
                    content_type="pdf",
                    document_url=pdf_url,
                    source_page_url=page_url,
                    metadata={"source": "boesl_reports_pdf", "index_page": page_url},
                ))

                if len(pages) >= _MAX_PAGES:
                    return pages

        return pages
