from __future__ import annotations

from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

# (tag, attribute) pairs where PDF links can appear
_PDF_TAG_ATTRS = [
    ("a", "href"),
    ("iframe", "src"),
    ("embed", "src"),
    ("object", "data"),
]


def extract_pdf_links(soup: BeautifulSoup, page_url: str, *, max_links: int = 5) -> list[str]:
    """Return up to *max_links* absolute PDF URLs found in *soup*.

    Scans <a href>, <iframe src>, <embed src>, and <object data> tags.
    A link is treated as a PDF when:
      - the URL path ends with .pdf, OR
      - the element has type="application/pdf" or type="application/x-pdf".
    """
    found: list[str] = []
    seen: set[str] = set()

    for tag_name, attr in _PDF_TAG_ATTRS:
        for el in soup.find_all(tag_name, attrs={attr: True}):
            raw: str = el.get(attr, "") or ""
            raw = raw.strip()
            if not raw:
                continue

            absolute = urljoin(page_url, raw)
            parsed = urlparse(absolute)
            if parsed.scheme not in {"http", "https"}:
                continue

            if absolute in seen:
                continue

            if _is_pdf(absolute, el):
                found.append(absolute)
                seen.add(absolute)
                if len(found) >= max_links:
                    return found

    return found


def _is_pdf(url: str, el) -> bool:  # type: ignore[no-untyped-def]
    if urlparse(url).path.lower().endswith(".pdf"):
        return True
    mime = (el.get("type") or "").lower()
    return mime in {"application/pdf", "application/x-pdf"}
