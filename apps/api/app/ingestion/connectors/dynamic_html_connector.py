from datetime import datetime
from urllib.parse import urlencode, urlparse, urlunparse

import logging
from playwright.sync_api import Error as PlaywrightError, Page, sync_playwright

from bs4 import BeautifulSoup

from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.connectors.utils import extract_pdf_links
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Common selectors to try when dismissing cookie/consent banners and ad overlays
_CONSENT_SELECTORS = [
    "#onetrust-accept-btn-handler",
    "#CybotCookiebotDialogBodyButtonAccept",
    "[aria-label*='Accept all' i]",
    "[aria-label*='Accept cookies' i]",
    "button:has-text('Accept all')",
    "button:has-text('Accept All')",
    "button:has-text('Agree')",
    "button:has-text('Got it')",
    "button:has-text('I agree')",
    ".cookie-accept",
    "#accept-cookies",
    "[id*='cookie'] button",
    "[class*='cookie-banner'] button",
]

_MODAL_CLOSE_SELECTORS = [
    "[aria-label='Close']",
    "[aria-label='close']",
    "button.close",
    ".modal-close",
    "[class*='modal'] button.close",
    "[class*='popup'] button[class*='close']",
    "[class*='overlay'] button[class*='close']",
]

_AD_REMOVAL_SCRIPT = (
    "document.querySelectorAll("
    "'[id*=\"ad-\"],[id*=\"ads-\"],[class*=\"ad-overlay\"],"
    "[class*=\"sticky-ad\"],[id*=\"popup-ad\"],[class*=\"interstitial\"]'"
    ").forEach(function(el){el.remove()});"
)


class DynamicHTMLConnector(BaseSourceConnector):
    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def _dismiss_overlays(self, page: Page) -> None:
        """Attempt to dismiss cookie banners, modal popups, and ad overlays.

        All steps are wrapped in try/except so a missed dismissal never kills the crawl.
        """
        for selector in _CONSENT_SELECTORS:
            try:
                locator = page.locator(selector).first
                if locator.is_visible(timeout=800):
                    locator.click(timeout=1000)
                    break
            except Exception:
                pass

        for selector in _MODAL_CLOSE_SELECTORS:
            try:
                locator = page.locator(selector).first
                if locator.is_visible(timeout=500):
                    locator.click(timeout=800)
            except Exception:
                pass

        try:
            page.evaluate(_AD_REMOVAL_SCRIPT)
        except Exception:
            pass

        try:
            page.wait_for_timeout(800)
        except Exception:
            pass

    def _build_urls(self, source: Source) -> list[str]:
        urls = [source.base_url]
        for term in (source.search_queries or [])[:2]:
            parsed = urlparse(source.base_url)
            search_url = urlunparse(parsed._replace(query=urlencode({"q": term})))
            if search_url not in urls:
                urls.append(search_url)
        return urls

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []

        urls = self._build_urls(source)
        pages: list[FetchedPage] = []

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
                )
                for url in urls:
                    if not is_allowed(url, settings.crawler_user_agent):
                        continue
                    try:
                        page = browser.new_page(
                            user_agent=settings.crawler_user_agent,
                            java_script_enabled=True,
                        )
                        page.goto(url, wait_until="networkidle", timeout=30000)
                        self._dismiss_overlays(page)
                        html = page.content()
                        title = page.title()
                        page.close()
                        logger.debug("dynamic_html_fetched", extra={"url": url, "title": title})

                        soup = BeautifulSoup(html, "html.parser")
                        pdf_links = extract_pdf_links(soup, url)
                        page_content_type = "html_with_pdf" if pdf_links else "html"
                        primary_doc_url = pdf_links[0] if pdf_links else None

                        pages.append(
                            FetchedPage(
                                url=url,
                                canonical_url=url,
                                title=title,
                                raw_html=html,
                                content_type=page_content_type,
                                document_url=primary_doc_url,
                                metadata={"rendered": True},
                                extracted_links=[],
                            )
                        )

                        # Add dedicated PDF page entries for each embedded link
                        for pdf_url in pdf_links[:3]:
                            pages.append(
                                FetchedPage(
                                    url=pdf_url,
                                    canonical_url=pdf_url,
                                    title=title,
                                    content_type="pdf",
                                    document_url=pdf_url,
                                    source_page_url=url,
                                    metadata={"rendered": True, "discovery_source": "embedded_pdf"},
                                )
                            )
                    except Exception as exc:
                        logger.warning(
                            "dynamic_html_page_failed",
                            extra={"url": url, "error": str(exc)},
                        )
                browser.close()
        except PlaywrightError as exc:
            raise RuntimeError(
                "Dynamic HTML crawling needs Playwright browser binaries. "
                "Use the default static discovery source mode for now, or install Chromium in the worker image before using dynamic_html."
            ) from exc

        return pages
