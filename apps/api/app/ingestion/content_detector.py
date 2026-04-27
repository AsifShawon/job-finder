from urllib.parse import urlparse

_PDF_MIME = ("application/pdf", "application/x-pdf")


def detect(url: str, content_type_header: str | None = None) -> str:
    """Return 'pdf', 'html', or 'unknown' based on URL extension + HTTP header.

    Header takes precedence over URL extension when present.
    """
    if content_type_header:
        ct = content_type_header.lower().split(";")[0].strip()
        if any(ct.startswith(m) for m in _PDF_MIME):
            return "pdf"
        if "html" in ct:
            return "html"

    path = urlparse(url).path.lower()
    if path.endswith(".pdf"):
        return "pdf"

    return "unknown"
