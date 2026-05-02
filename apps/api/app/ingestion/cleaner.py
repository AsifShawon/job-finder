import hashlib

import trafilatura
from bs4 import BeautifulSoup

from app.ingestion.schemas import FetchedPage

_PDF_CONTENT_TYPES = {"pdf", "image_pdf"}


def _build_html_context(page: FetchedPage) -> str:
    if not page.raw_html:
        return ""
    soup = BeautifulSoup(page.raw_html, "html.parser")
    parts: list[str] = []
    if page.title:
        parts.append(f"Page Title: {page.title}")

    headings = [
        text.strip()
        for text in (node.get_text(" ", strip=True) for node in soup.select("h1, h2, h3"))
        if text.strip()
    ]
    if headings:
        parts.append("Headings:\n" + "\n".join(f"- {heading}" for heading in headings[:8]))

    key_links = []
    for anchor in soup.select("a[href]")[:40]:
        text = anchor.get_text(" ", strip=True)
        href = anchor.get("href", "").strip()
        if not text or not href:
            continue
        key_links.append(f"- {text}: {href}")
    if key_links:
        parts.append("Key Links:\n" + "\n".join(key_links[:12]))

    pdf_links = [
        href for href in (anchor.get("href", "").strip() for anchor in soup.select("a[href]"))
        if href.lower().split("?")[0].endswith(".pdf")
    ]
    if pdf_links:
        parts.append("PDF Links:\n" + "\n".join(f"- {href}" for href in pdf_links[:5]))

    return "\n\n".join(parts)


def clean_page(page: FetchedPage) -> dict:
    if page.content_type in _PDF_CONTENT_TYPES:
        # PDF pages: combine the rendered HTML (detail-page metadata in English)
        # with the extracted PDF text (Bengali circular content).
        # trafilatura extracts the readable text from the HTML — this is the
        # reliable source of job title, country, deadline, and employer name.
        html_context = trafilatura.extract(page.raw_html or "") or ""

        # If HTML extraction came back empty, build a metadata prefix from the
        # structured fields the connector already extracted (title, country, etc.)
        if not html_context:
            meta = page.metadata or {}
            parts: list[str] = []
            if page.title:
                parts.append(f"Title: {page.title}")
            if meta.get("country"):
                parts.append(f"Destination Country: {meta['country']}")
            if meta.get("closing_date"):
                parts.append(f"Application Deadline: {meta['closing_date']}")
            if page.original_apply_url:
                parts.append(f"Application URL: {page.original_apply_url}")
            if meta.get("source"):
                parts.append(f"Source: {meta['source']}")
            html_context = "\n".join(parts)

        pdf_text = page.raw_text or ""
        body_text = "\n\n".join(filter(None, [html_context, pdf_text]))
    else:
        text_source = page.raw_html or page.raw_text or ""
        extracted = trafilatura.extract(text_source) or page.raw_text or ""
        html_context = _build_html_context(page)
        body_text = "\n\n".join(part for part in [html_context, extracted] if part)

    return {
        "title": page.title,
        "body_text": body_text,
        "canonical_url": page.canonical_url or page.url,
        "apply_link": (page.metadata or {}).get("apply_link") or page.canonical_url or page.url,
        "content_hash": hashlib.sha256(body_text.encode("utf-8")).hexdigest(),
    }
