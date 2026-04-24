from app.ingestion.schemas import ExtractionBase
from app.ingestion.validators import parse_deadline, validate_extraction


def test_validate_extraction_requires_title() -> None:
    extraction = ExtractionBase(record_type="job", title=None)
    errors = validate_extraction(extraction)
    assert "Missing title" in errors


def test_validate_extraction_url_scheme() -> None:
    extraction = ExtractionBase(record_type="job", title="Role", application_url="ftp://example.com")
    errors = validate_extraction(extraction)
    assert "Invalid application URL" in errors


def test_parse_deadline() -> None:
    deadline = parse_deadline("31 December 2026")
    assert deadline is not None
    assert deadline.year == 2026
