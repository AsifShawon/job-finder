from app.ingestion.schemas import FetchedPage


def parse_default(page: FetchedPage) -> dict:
    text = page.raw_text or page.raw_html or ""
    return {
        "title": page.title,
        "summary": text[:500],
        "body": text,
        "application_url": page.canonical_url or page.url,
    }
