"""
BOESL BRMS (Bangladesh Overseas Employment and Services Limited — Bureau of Manpower Resources System)
Connector for the BOESL job circular listing pages.

Source config expected:
  connector_key = boesl_brms
  source_type   = job_board
  trust_level   = government_official
  can_apply_from_bd default = True (enforced in eligibility_engine)
  requires_admin_review = True  (BOESL circulars must be reviewed before publishing)

The site is a JavaScript SPA so we use Playwright for rendering.
Two-phase crawl: listing page -> detail pages (each with an embedded PDF).
"""
from __future__ import annotations

import logging
from datetime import datetime
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()
logger = logging.getLogger(__name__)

MAX_PAGES = 30
_TIMEOUT = 30000  # ms


class BOESLBRMSConnector(BaseSourceConnector):
    """Scrapes BOESL BRMS job listing and detail pages via Playwright."""

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        return self.fetch(source, since=None)

    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []

        pages: list[FetchedPage] = []

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            try:
                cards = self._discover_cards(browser, source)
                for card in cards:
                    if len(pages) >= MAX_PAGES:
                        break
                    fetched = self._fetch_detail(browser, source, card)
                    if fetched is not None:
                        pages.append(fetched)
            finally:
                browser.close()

        return pages

    def _discover_cards(self, browser, source: Source) -> list[dict]:
        """Phase 1: load the listing page and extract job card metadata."""
        cards: list[dict] = []
        page = None
        try:
            page = browser.new_page(
                user_agent=settings.crawler_user_agent,
                java_script_enabled=True,
            )
            page.goto(source.base_url, wait_until="networkidle", timeout=_TIMEOUT)
            logger.debug("boesl_brms_fetched", extra={"url": source.base_url})

            # Collect cards; try multiple rounds of "next page" up to MAX_PAGES total
            while len(cards) < MAX_PAGES:
                new_cards = self._extract_cards_from_page(page, source.base_url)
                cards.extend(new_cards)

                # Check for a "next page" / pagination button
                next_btn = None
                for selector in [
                    "a[aria-label='Next']",
                    "a.page-link:has-text('»')",
                    "a.page-link:has-text('Next')",
                    "li.page-item:not(.disabled) a[rel='next']",
                    "button:has-text('Next')",
                ]:
                    try:
                        locator = page.locator(selector).first
                        if locator.is_visible(timeout=500):
                            next_btn = locator
                            break
                    except Exception:
                        pass

                if next_btn is None or len(cards) >= MAX_PAGES:
                    break

                try:
                    next_btn.click()
                    page.wait_for_load_state("networkidle", timeout=_TIMEOUT)
                except Exception as exc:
                    logger.warning(
                        "boesl_brms_page_failed",
                        extra={"url": source.base_url, "error": f"pagination: {exc}"},
                    )
                    break

        except Exception as exc:
            logger.warning(
                "boesl_brms_page_failed",
                extra={"url": source.base_url, "error": str(exc)},
            )
        finally:
            if page is not None:
                page.close()

        return cards[:MAX_PAGES]

    def _extract_cards_from_page(self, page, base_url: str) -> list[dict]:
        """Extract job card data from the currently rendered listing page."""
        cards: list[dict] = []

        # Each job card: try common Bootstrap / Angular / React card patterns
        card_selectors = [
            ".job-card",
            ".card",
            "article",
            "[class*='job-item']",
            "[class*='circular']",
            "tr",  # fallback if rendered as a table
        ]

        card_elements = []
        for selector in card_selectors:
            try:
                elements = page.locator(selector).all()
                if elements:
                    # Use the selector that yields the most candidates
                    if len(elements) > len(card_elements):
                        card_elements = elements
            except Exception:
                pass

        for el in card_elements:
            try:
                card = self._parse_card_element(el, base_url)
                if card and card.get("detail_url"):
                    cards.append(card)
            except Exception:
                pass

        return cards

    def _parse_card_element(self, el, base_url: str) -> dict | None:
        """Extract fields from a single job card element."""
        # Detail URL — look for a "Details" link or any /jobs/{id} href
        detail_url = None
        apply_url = None

        try:
            links = el.locator("a").all()
            for link in links:
                href = link.get_attribute("href") or ""
                text = (link.inner_text() or "").strip().lower()
                abs_href = urljoin(base_url, href) if href else ""
                if "detail" in text or "/jobs/" in href:
                    detail_url = abs_href
                if "apply" in text:
                    apply_url = abs_href
        except Exception:
            pass

        if not detail_url:
            return None

        # Title
        title = None
        for selector in ["h5", "h4", "h3", "h2", ".card-title", ".job-title", "td:first-child"]:
            try:
                t = el.locator(selector).first.inner_text()
                if t and t.strip():
                    title = t.strip()
                    break
            except Exception:
                pass

        # Country
        country = None
        for selector in [
            "[class*='country']",
            "[class*='destination']",
            "td:nth-child(2)",
            "span",
            "p",
        ]:
            try:
                texts = [e.inner_text().strip() for e in el.locator(selector).all()]
                for t in texts:
                    if t and len(t) < 50:
                        upper = t.upper()
                        # Heuristic: short ALL-CAPS or known country patterns
                        if upper == t or any(
                            c in upper for c in ["FIJI", "MALAYSIA", "SAUDI", "UAE", "QATAR", "KOREA", "JAPAN"]
                        ):
                            country = t
                            break
                if country:
                    break
            except Exception:
                pass

        # Closing date
        closing_date = None
        for selector in [
            "[class*='date']",
            "[class*='deadline']",
            "[class*='closing']",
            "td:last-child",
        ]:
            try:
                t = el.locator(selector).first.inner_text().strip()
                if t:
                    closing_date = t
                    break
            except Exception:
                pass

        return {
            "detail_url": detail_url,
            "title": title,
            "country": country,
            "closing_date": closing_date,
            "apply_url": apply_url,
        }

    def _fetch_detail(self, browser, source: Source, card: dict) -> FetchedPage | None:
        """Phase 2: open a detail page and extract the embedded PDF URL."""
        detail_url: str = card["detail_url"]
        page = None
        try:
            page = browser.new_page(
                user_agent=settings.crawler_user_agent,
                java_script_enabled=True,
            )
            page.goto(detail_url, wait_until="networkidle", timeout=_TIMEOUT)
            logger.debug("boesl_brms_fetched", extra={"url": detail_url})

            pdf_url = self._extract_pdf_url(page, detail_url)

            # Apply URL: prefer the one from the detail page if present
            apply_url = card.get("apply_url")
            try:
                apply_links = page.locator("a:has-text('Apply')").all()
                for link in apply_links:
                    href = link.get_attribute("href") or ""
                    if href:
                        apply_url = urljoin(detail_url, href)
                        break
            except Exception:
                pass

            return FetchedPage(
                url=detail_url,
                canonical_url=detail_url,
                title=card.get("title"),
                content_type="pdf" if pdf_url else "html",
                document_url=pdf_url,
                source_page_url=source.base_url,
                original_apply_url=apply_url,
                metadata={
                    "source": "boesl_brms",
                    "closing_date": card.get("closing_date"),
                    "country": card.get("country"),
                    "discovery_source": "boesl_brms_listing",
                },
            )

        except Exception as exc:
            logger.warning(
                "boesl_brms_page_failed",
                extra={"url": detail_url, "error": str(exc)},
            )
            return None
        finally:
            if page is not None:
                page.close()

    def _extract_pdf_url(self, page, base_url: str) -> str | None:
        """Find the embedded PDF URL from the rendered detail page."""
        # 1. Check iframe / embed / object attributes in DOM
        for selector, attr in [
            ("iframe[src]", "src"),
            ("embed[src]", "src"),
            ("object[data]", "data"),
            ("iframe", "src"),
            ("embed", "src"),
        ]:
            try:
                elements = page.locator(selector).all()
                for el in elements:
                    value = el.get_attribute(attr) or ""
                    if self._looks_like_pdf(value):
                        return urljoin(base_url, value)
            except Exception:
                pass

        # 2. Check live frames (in case PDF is in a cross-origin iframe)
        try:
            for frame in page.frames:
                url = frame.url
                if self._looks_like_pdf(url):
                    return url
        except Exception:
            pass

        # 3. Evaluate JS to find any src/data ending in .pdf in the DOM
        try:
            found = page.evaluate(
                """() => {
                    const candidates = [];
                    document.querySelectorAll('iframe,embed,object').forEach(el => {
                        const v = el.src || el.data || '';
                        if (v) candidates.push(v);
                    });
                    return candidates;
                }"""
            )
            for v in (found or []):
                if self._looks_like_pdf(v):
                    return urljoin(base_url, v)
        except Exception:
            pass

        # 4. Scan all links for .pdf hrefs
        try:
            links = page.locator("a[href]").all()
            for link in links:
                href = link.get_attribute("href") or ""
                if self._looks_like_pdf(href):
                    return urljoin(base_url, href)
        except Exception:
            pass

        return None

    @staticmethod
    def _looks_like_pdf(value: str) -> bool:
        if not value:
            return False
        lower = value.lower().split("?")[0]
        return lower.endswith(".pdf") or "application/pdf" in lower
