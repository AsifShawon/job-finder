from datetime import datetime

from playwright.sync_api import Error as PlaywrightError, sync_playwright

from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source
from app.core.config import get_settings

settings = get_settings()


class DynamicHTMLConnector(BaseSourceConnector):
    def fetch(self, source: Source, since: datetime | None = None) -> list[FetchedPage]:
        if not is_allowed(source.base_url, settings.crawler_user_agent):
            return []
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.goto(source.base_url, wait_until="networkidle", timeout=30000)
                html = page.content()
                title = page.title()
                browser.close()
        except PlaywrightError as exc:
            raise RuntimeError(
                "Dynamic HTML crawling needs Playwright browser binaries. "
                "Use the default static discovery source mode for now, or install Chromium in the worker image before using dynamic_html."
            ) from exc

        return [
            FetchedPage(
                url=source.base_url,
                canonical_url=source.base_url,
                title=title,
                raw_html=html,
                metadata={"rendered": True},
                extracted_links=[],
            )
        ]
