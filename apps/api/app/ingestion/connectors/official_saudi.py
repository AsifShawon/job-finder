from __future__ import annotations

import hashlib
import logging
import re
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

from app.core.config import get_settings
from app.ingestion.connectors.base import BaseSourceConnector
from app.ingestion.robots import is_allowed
from app.ingestion.schemas import FetchedPage
from app.models.entities import Source

settings = get_settings()
logger = logging.getLogger(__name__)

MAX_PAGES = 50
MAX_DETAIL_PAGES = 300
PREVIEW_DETAIL_LIMIT = 8
NAVIGATION_TIMEOUT_MS = 30_000
READY_TIMEOUT_MS = 12_000
RENDER_SETTLE_MS = 1_200

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


@dataclass
class ListingJob:
    title: str
    detail_url: str
    listing_page_url: str | None = None
    source_job_id: str | None = None
    location: str | None = None
    department: str | None = None
    experience_level: str | None = None
    posting_date: str | None = None
    company: str | None = None
    apply_url: str | None = None


@dataclass
class RenderedPage:
    requested_url: str
    final_url: str
    html: str
    title: str | None = None


def parse_successfactors_listing(html: str, page_url: str, *, flavor: str) -> tuple[list[ListingJob], list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    jobs: dict[str, ListingJob] = {}

    for anchor in soup.select("a[href]"):
        title = _clean(anchor.get_text(" ", strip=True))
        href = anchor.get("href") or ""
        if not title or not _looks_like_job_link(href, title):
            continue
        detail_url = urljoin(page_url, href)
        surrounding = _clean(anchor.parent.get_text(" ", strip=True) if anchor.parent else "")
        row_text = _clean(anchor.find_parent("tr").get_text(" ", strip=True) if anchor.find_parent("tr") else surrounding)
        if not row_text:
            row_text = surrounding
        parsed = _parse_successfactors_row_text(title, row_text, flavor=flavor)
        jobs[detail_url] = ListingJob(title=title, detail_url=detail_url, listing_page_url=page_url, **parsed)

    next_pages = []
    for anchor in soup.select("a[href]"):
        text = _clean(anchor.get_text(" ", strip=True)).lower()
        href = anchor.get("href") or ""
        if text in {"next", "2", "3", "4", "5", "6", "7", "8", "9", "10"} or "startrow=" in href.lower():
            next_pages.append(urljoin(page_url, href))
    return list(jobs.values()), list(dict.fromkeys(next_pages))


def parse_successfactors_detail(
    html: str,
    detail_url: str,
    listing: ListingJob,
    *,
    company: str,
    flavor: str,
) -> FetchedPage:
    soup = BeautifulSoup(html, "html.parser")
    for node in soup.select("script, style, nav, header, footer"):
        node.decompose()
    title_node = soup.select_one("h1") or soup.select_one(".jobTitle") or soup.select_one("title")
    title = _clean(title_node.get_text(" ", strip=True) if title_node else listing.title)
    body = _clean_multiline_text(soup.get_text("\n", strip=True))
    canonical = _canonical(detail_url, soup)
    apply_url = _find_apply_url(soup, detail_url) or listing.apply_url or detail_url
    source_job_id = listing.source_job_id or _extract_req_id(body)
    content_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()[:64]
    return FetchedPage(
        url=detail_url,
        canonical_url=canonical,
        title=title or listing.title,
        raw_html=html,
        raw_text=body,
        content_type="html",
        original_apply_url=apply_url,
        metadata={
            "structured_job": True,
            "official_detail_page": True,
            "source_item_key": source_job_id or canonical or detail_url,
            "source_job_id": source_job_id,
            "company": company,
            "location_raw": listing.location,
            "department": listing.department,
            "experience_level": listing.experience_level,
            "posting_date_text": listing.posting_date,
            "detected_item_type": "job",
            "content_hash": content_hash,
            "connector_flavor": flavor,
            "rendered": True,
            "crawl_engine": "playwright",
            "section_parser_required": True,
            "connector_key": f"successfactors_{flavor}",
            "listing_page_url": listing.listing_page_url,
            "requested_detail_url": listing.detail_url,
            "final_rendered_url": detail_url,
            "listing_card_title": listing.title,
        },
    )


def parse_tamimi_listing(html: str, page_url: str) -> tuple[list[ListingJob], list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    jobs: dict[str, ListingJob] = {}
    next_pages = _extract_listing_next_pages(
        soup,
        page_url,
        text_markers={"next", "2", "3", "4", "5", "6", "7", "8", "9", "10"},
        href_markers=("page=", "paged=", "offset=", "start="),
    )
    for card in soup.select(".card .card-body"):
        anchor = card.select_one("a[href*='career.php']")
        title_node = card.select_one(".card-body-title")
        if anchor is None or title_node is None:
            continue
        detail_url = urljoin(page_url, anchor.get("href") or "")
        if not _same_host_or_relative(detail_url, page_url):
            continue
        block = _clean(card.get_text(" ", strip=True))
        title = _clean(title_node.get_text(" ", strip=True))
        if not title:
            continue
        subtitle = card.select_one(".card-body-subtitle")
        jobs[detail_url] = ListingJob(
            title=title,
            detail_url=detail_url,
            listing_page_url=page_url,
            location=_extract_location(block),
            department=_clean(subtitle.get_text(" ", strip=True)) if subtitle else None,
            posting_date=_extract_date_text(block),
            apply_url=detail_url,
        )
    if jobs:
        return list(jobs.values()), next_pages

    for anchor in soup.select("a[href]"):
        text = _clean(anchor.get_text(" ", strip=True))
        href = anchor.get("href") or ""
        surrounding = _clean(
            anchor.find_parent(["tr", "li", "div", "article"]).get_text(" ", strip=True)
            if anchor.find_parent(["tr", "li", "div", "article"])
            else ""
        )
        combined = f"{text} {surrounding}".strip()
        if not combined or not _has_job_signal(combined, href):
            continue
        detail_url = urljoin(page_url, href)
        if not _same_host_or_relative(detail_url, page_url):
            continue
        title = _guess_title_from_block(text, surrounding)
        if not title:
            continue
        jobs[detail_url] = ListingJob(
            title=title,
            detail_url=detail_url,
            listing_page_url=page_url,
            location=_extract_location(combined),
            department=_extract_labeled(combined, "department"),
            posting_date=_extract_date_text(combined),
            apply_url=detail_url,
        )
    return list(jobs.values()), next_pages


def parse_maharah_posts(html: str, page_url: str) -> tuple[list[ListingJob], list[str]]:
    soup = BeautifulSoup(html, "html.parser")
    posts: dict[str, ListingJob] = {}
    for anchor in soup.select("a[href]"):
        title = _clean(anchor.get_text(" ", strip=True))
        href = anchor.get("href") or ""
        detail_url = urljoin(page_url, href)
        if not _same_host_or_relative(detail_url, page_url):
            continue
        block = _clean(
            anchor.find_parent(["article", "div", "li", "section"]).get_text(" ", strip=True)
            if anchor.find_parent(["article", "div", "li", "section"])
            else title
        )
        if not _looks_like_maharah_job_link(href):
            continue
        if detail_url.rstrip("/") == page_url.rstrip("/"):
            continue
        if not title or len(title) < 4 or title.lower() in {"apply now", "apply", "job application form"}:
            title = _guess_title_from_block("", block)
        if not title or _looks_like_noise_link(title):
            continue
        posts[detail_url] = ListingJob(
            title=title,
            detail_url=detail_url,
            listing_page_url=page_url,
            posting_date=_extract_date_text(block),
            department=_extract_labeled(block, "department"),
            location=_extract_labeled(block, "location"),
            apply_url=detail_url,
        )
    next_pages = _extract_listing_next_pages(
        soup,
        page_url,
        text_markers={"next", "2", "3", "4", "5", "6", "7", "8", "9", "10"},
        href_markers=("page=", "/jobs/page/", "?page="),
    )
    return list(posts.values()), list(dict.fromkeys(next_pages))


class SuccessFactorsConnector(BaseSourceConnector):
    connector_key = "successfactors"
    flavor = "generic"
    company = ""
    conservative = False

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        pages: list[FetchedPage] = []
        seen_listing_pages: set[str] = set()
        seen_details: set[str] = set()
        queue = [source.base_url]
        detail_limit = PREVIEW_DETAIL_LIMIT if crawl_mode == "preview_only" else MAX_DETAIL_PAGES

        with _OfficialSiteBrowser() as browser:
            while queue and len(seen_listing_pages) < MAX_PAGES and len(pages) < detail_limit:
                listing_url = queue.pop(0)
                if listing_url in seen_listing_pages or not is_allowed(listing_url, settings.crawler_user_agent):
                    continue
                seen_listing_pages.add(listing_url)
                rendered = browser.fetch(listing_url, ready_selectors=_successfactors_listing_selectors())
                if rendered is None:
                    continue
                jobs, next_pages = parse_successfactors_listing(rendered.html, rendered.final_url, flavor=self.flavor)
                for next_page in next_pages:
                    if next_page not in seen_listing_pages and next_page not in queue:
                        queue.append(next_page)
                for job in jobs:
                    if job.detail_url in seen_details or len(pages) >= detail_limit:
                        continue
                    seen_details.add(job.detail_url)
                    if not is_allowed(job.detail_url, settings.crawler_user_agent):
                        continue
                    rendered_detail = browser.fetch(job.detail_url, ready_selectors=_detail_ready_selectors())
                    if rendered_detail is None:
                        continue
                    time.sleep(0.1)
                    page = parse_successfactors_detail(
                        rendered_detail.html,
                        rendered_detail.final_url,
                        job,
                        company=self.company,
                        flavor=self.flavor,
                    )
                    if self.conservative:
                        page.metadata["conservative_suitability"] = True
                    pages.append(page)
                if crawl_mode == "preview_only":
                    break

        self.last_discovery_diagnostics = {
            "listing_pages_visited": len(seen_listing_pages),
            "detail_pages_followed": len(seen_details),
            "pages_selected_for_ai": len(pages),
            "crawl_engine": "playwright",
        }
        return pages


class AlfanarSuccessFactorsConnector(SuccessFactorsConnector):
    connector_key = "successfactors_alfanar"
    flavor = "alfanar"
    company = "alfanar"


class AramcoSuccessFactorsConnector(SuccessFactorsConnector):
    connector_key = "successfactors_aramco"
    flavor = "aramco"
    company = "Aramco"
    conservative = True


class TamimiCareersConnector(BaseSourceConnector):
    connector_key = "tamimi_careers"

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        pages, diagnostics = _discover_static_detail_pages(
            source,
            parse_tamimi_listing,
            connector_key=self.connector_key,
            company="Abdulmohsen Al-Tamimi Group",
            detected_item_type="job",
            preview=crawl_mode == "preview_only",
        )
        self.last_discovery_diagnostics = diagnostics
        return pages


class MaharahPostsConnector(BaseSourceConnector):
    connector_key = "maharah_posts"

    def discover_items(self, source: Source, crawl_mode: str = "active_only") -> list[FetchedPage]:
        pages, diagnostics = _discover_static_detail_pages(
            source,
            parse_maharah_posts,
            connector_key=self.connector_key,
            company="Maharah",
            detected_item_type="job",
            preview=crawl_mode == "preview_only",
        )
        self.last_discovery_diagnostics = diagnostics
        return pages


class _OfficialSiteBrowser:
    def __enter__(self) -> "_OfficialSiteBrowser":
        try:
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
        except PlaywrightError as exc:
            raise RuntimeError(
                "Official job site crawling now requires Playwright Chromium. "
                "Install browser binaries in the API/worker image before running these connectors."
            ) from exc

        self._context = self._browser.new_context(
            user_agent=settings.crawler_user_agent,
            java_script_enabled=True,
            ignore_https_errors=True,
            locale="en-US",
        )
        self._context.set_default_navigation_timeout(NAVIGATION_TIMEOUT_MS)
        self._context.set_default_timeout(READY_TIMEOUT_MS)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self._context.close()
        self._browser.close()
        self._playwright.stop()

    def fetch(self, url: str, *, ready_selectors: list[str] | None = None) -> RenderedPage | None:
        page = self._context.new_page()
        try:
            self._goto_with_fallback(page, url)
            self._dismiss_overlays(page)
            self._wait_for_any(page, ready_selectors or [])
            self._auto_scroll(page)
            try:
                page.wait_for_load_state("networkidle", timeout=5_000)
            except PlaywrightTimeoutError:
                pass
            page.wait_for_timeout(RENDER_SETTLE_MS)
            return RenderedPage(
                requested_url=url,
                final_url=page.url,
                html=page.content(),
                title=_clean(page.title()) or None,
            )
        except Exception as exc:
            if not isinstance(exc, PlaywrightTimeoutError):
                partial = self._partial_rendered_page(page, url)
                if partial is not None:
                    logger.warning(
                        "official_site_fetch_partial",
                        extra={"url": url, "error": str(exc)},
                    )
                    return partial
            logger.warning(
                "official_site_fetch_failed",
                extra={"url": url, "error": str(exc)},
            )
            return None
        finally:
            page.close()

    def _goto_with_fallback(self, page: Page, url: str) -> None:
        errors: list[str] = []
        for wait_until, timeout_ms in (
            ("commit", 15_000),
            ("domcontentloaded", 20_000),
            ("load", NAVIGATION_TIMEOUT_MS),
        ):
            try:
                page.goto(url, wait_until=wait_until, timeout=timeout_ms)
                return
            except PlaywrightTimeoutError as exc:
                errors.append(f"{wait_until}: {exc}")
        raise RuntimeError("; ".join(errors) or f"Unable to load {url}")

    def _wait_for_any(self, page: Page, selectors: list[str]) -> None:
        for selector in selectors:
            try:
                page.locator(selector).first.wait_for(state="visible", timeout=READY_TIMEOUT_MS)
                return
            except Exception:
                continue

    def _dismiss_overlays(self, page: Page) -> None:
        for selector in _CONSENT_SELECTORS:
            try:
                locator = page.locator(selector).first
                if locator.is_visible(timeout=800):
                    locator.click(timeout=1_000)
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

    def _auto_scroll(self, page: Page) -> None:
        try:
            page.evaluate(
                """() => new Promise(resolve => {
                    let total = 0;
                    const step = 700;
                    const timer = setInterval(() => {
                        window.scrollBy(0, step);
                        total += step;
                        const done = total >= document.body.scrollHeight || total > 10000;
                        if (done) {
                            clearInterval(timer);
                            window.scrollTo(0, 0);
                            resolve(true);
                        }
                    }, 150);
                })"""
            )
        except Exception:
            pass

    def _partial_rendered_page(self, page: Page, url: str) -> RenderedPage | None:
        try:
            html = page.content()
        except Exception:
            return None
        text = _clean(html)
        if len(text) < 500:
            return None
        return RenderedPage(
            requested_url=url,
            final_url=page.url or url,
            html=html,
            title=_clean(page.title()) or None,
        )


def _discover_static_detail_pages(
    source: Source,
    parser,
    *,
    connector_key: str,
    company: str,
    detected_item_type: str,
    preview: bool,
) -> tuple[list[FetchedPage], dict[str, int | str]]:
    pages: list[FetchedPage] = []
    queue = [source.base_url]
    seen_pages: set[str] = set()
    seen_details: set[str] = set()
    detail_limit = PREVIEW_DETAIL_LIMIT if preview else MAX_DETAIL_PAGES

    with _OfficialSiteBrowser() as browser:
        while queue and len(seen_pages) < MAX_PAGES and len(pages) < detail_limit:
            listing_url = queue.pop(0)
            if listing_url in seen_pages or not is_allowed(listing_url, settings.crawler_user_agent):
                continue
            seen_pages.add(listing_url)
            rendered = browser.fetch(listing_url, ready_selectors=_generic_listing_selectors())
            if rendered is None:
                continue
            jobs, next_pages = parser(rendered.html, rendered.final_url)
            for next_page in next_pages:
                if next_page not in seen_pages and next_page not in queue:
                    queue.append(next_page)
            for job in jobs:
                if job.detail_url in seen_details or len(pages) >= detail_limit:
                    continue
                seen_details.add(job.detail_url)
                if not is_allowed(job.detail_url, settings.crawler_user_agent):
                    continue
                rendered_detail = browser.fetch(job.detail_url, ready_selectors=_detail_ready_selectors())
                if rendered_detail is None:
                    continue
                time.sleep(0.1)
                pages.append(
                    _static_detail_page(
                        rendered_detail.html,
                        rendered_detail.final_url,
                        job,
                        connector_key=connector_key,
                        company=company,
                        detected_item_type=detected_item_type,
                    )
                )
            if preview:
                break
    diagnostics: dict[str, int | str] = {
        "listing_pages_visited": len(seen_pages),
        "detail_pages_followed": len(seen_details),
        "pages_selected_for_ai": len(pages),
        "crawl_engine": "playwright",
    }
    return pages, diagnostics


def _static_detail_page(
    html: str,
    detail_url: str,
    listing: ListingJob,
    *,
    connector_key: str,
    company: str,
    detected_item_type: str,
) -> FetchedPage:
    soup = BeautifulSoup(html, "html.parser")
    for node in soup.select("script, style, nav, header, footer"):
        node.decompose()
    title_node = soup.select_one("h1") or soup.select_one("h2") or soup.select_one("title")
    title = _clean(title_node.get_text(" ", strip=True) if title_node else listing.title) or listing.title
    if _is_generic_detail_title(title):
        title = listing.title
    body = _clean_multiline_text(soup.get_text("\n", strip=True))
    apply_url = _find_apply_url(soup, detail_url)
    if detected_item_type == "job" and not apply_url:
        apply_url = listing.apply_url or detail_url
    if detected_item_type == "occupation_intelligence" and not _has_apply_signal(body):
        apply_url = None
    content_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()[:64]
    return FetchedPage(
        url=detail_url,
        canonical_url=_canonical(detail_url, soup),
        title=title,
        raw_html=html,
        raw_text=body,
        content_type="html",
        original_apply_url=apply_url,
        metadata={
            "structured_job": detected_item_type == "job" or bool(apply_url),
            "official_detail_page": detected_item_type == "job" or bool(apply_url),
            "source_item_key": listing.source_job_id or detail_url,
            "source_job_id": listing.source_job_id,
            "company": company,
            "location_raw": listing.location,
            "department": listing.department,
            "posting_date_text": listing.posting_date,
            "detected_item_type": "job" if apply_url else detected_item_type,
            "content_hash": content_hash,
            "rendered": True,
            "crawl_engine": "playwright",
            "section_parser_required": detected_item_type == "job" or bool(apply_url),
            "connector_key": connector_key,
            "listing_page_url": listing.listing_page_url,
            "requested_detail_url": listing.detail_url,
            "final_rendered_url": detail_url,
            "listing_card_title": listing.title,
        },
    )


def _parse_successfactors_row_text(title: str, row_text: str, *, flavor: str) -> dict:
    rest = _clean(row_text.replace(title, " ", 1))
    source_job_id = _extract_req_id(rest) if flavor == "aramco" else None
    date_text = _extract_date_text(rest)
    if flavor == "aramco":
        location = "Saudi Arabia" if re.search(r"\bSA\b", rest) else _extract_location(rest)
        department = None
        if source_job_id:
            after = rest.split(source_job_id, 1)[-1]
            department = _clean(re.sub(r"\bSA\b", " ", after))
        return {"source_job_id": source_job_id, "location": location, "department": department}
    exp = next(
        (
            item
            for item in ["Fresher", "Professional", "Management", "Executive"]
            if item.lower() in rest.lower()
        ),
        None,
    )
    return {"location": _extract_location(rest), "experience_level": exp, "posting_date": date_text}


def _successfactors_listing_selectors() -> list[str]:
    return [
        "a[href*='/job/']",
        "a[href*='/careersection/']",
        "table a[href]",
        "main",
        "body",
    ]


def _generic_listing_selectors() -> list[str]:
    return [
        ".card-body-title",
        ".latest-news-item",
        "a[href]",
        "article",
        "main",
        "body",
    ]


def _detail_ready_selectors() -> list[str]:
    return [
        "h1",
        "h2",
        "main",
        "article",
        "body",
    ]


def _looks_like_job_link(href: str, title: str) -> bool:
    href_l = href.lower()
    title_l = title.lower()
    if not href or href.startswith("#"):
        return False
    if any(term in title_l for term in ["login", "profile", "alert", "search", "reset", "language"]):
        return False
    return "/job/" in href_l or "/careersection/" in href_l or bool(re.search(r"/job/[^/]+/\d+", href_l))


def _has_job_signal(text: str, href: str) -> bool:
    text_l = text.lower()
    href_l = href.lower()
    return any(
        term in text_l or term in href_l
        for term in [
            "apply",
            "career",
            "job",
            "vacancy",
            "supervisor",
            "engineer",
            "rigger",
            "scaffold",
            "worker",
            "driver",
        ]
    )


def _has_worker_or_post_signal(text: str, href: str) -> bool:
    text_l = text.lower() + " " + href.lower()
    return "/post" in text_l or any(
        term in text_l
        for term in [
            "worker",
            "driver",
            "waiter",
            "farm",
            "construction",
            "hotel",
            "restaurant",
            "maintenance",
            "factory",
            "warehouse",
            "welder",
            "occupation",
            "career",
        ]
    )


def _looks_like_maharah_job_link(href: str) -> bool:
    href_l = href.lower()
    if not href or href.startswith("#"):
        return False
    if any(term in href_l for term in ["/web/login", "/web/signup", "/website/info", "/contact-us"]):
        return False
    return "/jobs/apply/" in href_l


def _has_apply_signal(text: str) -> bool:
    return any(
        term in text.lower()
        for term in [
            "apply now",
            "apply for",
            "application form",
            "submit your cv",
            "send your cv",
            "vacancy",
            "job opening",
        ]
    )


def _find_apply_url(soup: BeautifulSoup, page_url: str) -> str | None:
    for anchor in soup.select("a[href]"):
        text = _clean(anchor.get_text(" ", strip=True)).lower()
        href = anchor.get("href") or ""
        if "apply" in text or "apply" in href.lower() or "career" in href.lower():
            return urljoin(page_url, href)
    return None


def _canonical(url: str, soup: BeautifulSoup) -> str:
    node = soup.select_one("link[rel='canonical'][href]")
    return urljoin(url, node.get("href")) if node else url


def _extract_req_id(text: str) -> str | None:
    match = re.search(r"\b(?:Req(?:uisition)?\s*ID[:\s]*)?(\d{4,8})\b", text, re.I)
    return match.group(1) if match else None


def _extract_date_text(text: str) -> str | None:
    patterns = [
        r"\b\d{1,2}\s+[A-Z][a-z]{2,8}\s+20\d{2}\b",
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
        r"\b20\d{2}-\d{1,2}-\d{1,2}\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


def _extract_location(text: str) -> str | None:
    known = ["Saudi Arabia", "Riyadh", "Jeddah", "Dammam", "Dubai", "United Arab Emirates", "Amman", "Jordan", "SA"]
    for item in known:
        if re.search(rf"\b{re.escape(item)}\b", text, re.I):
            return "Saudi Arabia" if item == "SA" else item
    return None


def _extract_labeled(text: str, label: str) -> str | None:
    match = re.search(rf"{label}\s*[:\-]\s*([^\n|]+)", text, re.I)
    return _clean(match.group(1)) if match else None


def _guess_title_from_block(anchor_text: str, block_text: str) -> str | None:
    text_value = (
        anchor_text
        if len(anchor_text) > 3 and anchor_text.lower() not in {"view", "apply", "view & apply", "read more"}
        else block_text
    )
    text_value = re.split(r"\b(?:department|location|posted|apply|view)\b", text_value, flags=re.I)[0]
    return _clean(text_value)[:180] or None


def _extract_listing_next_pages(
    soup: BeautifulSoup,
    page_url: str,
    *,
    text_markers: set[str],
    href_markers: tuple[str, ...],
) -> list[str]:
    next_pages: list[str] = []
    for anchor in soup.select("a[href]"):
        href = (anchor.get("href") or "").strip()
        if not href:
            continue
        text = _clean(anchor.get_text(" ", strip=True)).lower()
        href_l = href.lower()
        if text in text_markers or any(marker in href_l for marker in href_markers):
            next_page = urljoin(page_url, href)
            if next_page.rstrip("/") != page_url.rstrip("/") and _same_host_or_relative(next_page, page_url):
                next_pages.append(next_page)
    return list(dict.fromkeys(next_pages))


def _looks_like_noise_link(title: str) -> bool:
    lowered = title.lower()
    return lowered in {
        "login",
        "sign up",
        "signup",
        "apply now",
        "apply",
        "job application form",
        "back",
        "next",
    }


def _is_generic_detail_title(title: str | None) -> bool:
    normalized = _clean(title).lower()
    return normalized in {
        "",
        "career details",
        "career detail",
        "job details",
        "job detail",
        "details",
        "view details",
    }


def _same_host_or_relative(url: str, base_url: str) -> bool:
    base_host = urlparse(base_url).netloc.lower().removeprefix("www.")
    host = urlparse(url).netloc.lower().removeprefix("www.")
    return not host or host == base_host or host.endswith("." + base_host)


def _clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def _clean_multiline_text(value: str | None) -> str:
    lines = [_clean(line) for line in (value or "").splitlines()]
    return "\n".join(line for line in lines if line)
