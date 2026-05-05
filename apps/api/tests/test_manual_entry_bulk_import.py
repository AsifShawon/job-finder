from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.api.v1.endpoints.admin import (
    _load_bulk_upload_rows,
    _manual_bulk_bool,
    _manual_bulk_list,
    _manual_entry_template_headers,
    _normalize_manual_bulk_row,
)


def test_manual_bulk_bool_accepts_common_values() -> None:
    assert _manual_bulk_bool("true") is True
    assert _manual_bulk_bool("YES") is True
    assert _manual_bulk_bool("1") is True
    assert _manual_bulk_bool("false") is False
    assert _manual_bulk_bool("No") is False
    assert _manual_bulk_bool("0") is False
    assert _manual_bulk_bool("") is None


def test_manual_bulk_bool_rejects_invalid_values() -> None:
    with pytest.raises(ValueError):
        _manual_bulk_bool("maybe")


def test_manual_bulk_list_supports_newlines_and_commas() -> None:
    assert _manual_bulk_list("Passport\nCV\nMedical") == ["Passport", "CV", "Medical"]
    assert _manual_bulk_list("Passport, CV, Medical") == ["Passport", "CV", "Medical"]
    assert _manual_bulk_list("") is None


def test_normalize_manual_bulk_row_parses_required_and_optional_fields() -> None:
    payload = _normalize_manual_bulk_row(
        {
            "title": "Welder",
            "source_url": "https://example.com/jobs/1",
            "raw_description": "Full job text",
            "country": "Japan",
            "salary_min": "1200",
            "salary_max": "1500",
            "salary_currency": "jpy",
            "visa_support": "yes",
            "can_apply_from_bd": "1",
            "requirements": "Passport\nCV",
            "journey_steps": "Prepare passport, Apply online",
            "typical_salary_bdt": "110000",
        },
        run_ai_extraction=False,
    )

    assert payload.title == "Welder"
    assert payload.source_url == "https://example.com/jobs/1"
    assert payload.raw_description == "Full job text"
    assert payload.country == "Japan"
    assert payload.salary_min == 1200.0
    assert payload.salary_max == 1500.0
    assert payload.salary_currency == "jpy"
    assert payload.visa_support is True
    assert payload.can_apply_from_bd is True
    assert payload.requirements == ["Passport", "CV"]
    assert payload.journey_steps == ["Prepare passport", "Apply online"]
    assert payload.typical_salary_bdt == 110000
    assert payload.run_ai_extraction is False


def test_normalize_manual_bulk_row_requires_core_columns() -> None:
    with pytest.raises(ValueError):
        _normalize_manual_bulk_row(
            {"title": "Welder", "source_url": "", "raw_description": "Full job text"},
            run_ai_extraction=True,
        )


def test_load_bulk_upload_rows_reads_csv() -> None:
    file = SimpleNamespace(filename="jobs.csv")
    rows = _load_bulk_upload_rows(
        file,
        b"title,source_url,raw_description\nWelder,https://example.com/jobs/1,Full job text\n",
    )

    assert rows == [
        {
            "title": "Welder",
            "source_url": "https://example.com/jobs/1",
            "raw_description": "Full job text",
        }
    ]


def test_load_bulk_upload_rows_reads_xlsx() -> None:
    openpyxl = pytest.importorskip("openpyxl")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["title", "source_url", "raw_description"])
    ws.append(["Welder", "https://example.com/jobs/1", "Full job text"])

    from io import BytesIO

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    file = SimpleNamespace(filename="jobs.xlsx")
    rows = _load_bulk_upload_rows(file, buffer.getvalue())

    assert rows == [
        {
            "title": "Welder",
            "source_url": "https://example.com/jobs/1",
            "raw_description": "Full job text",
        }
    ]


def test_manual_entry_template_headers_include_required_columns() -> None:
    headers = _manual_entry_template_headers()

    assert headers[:3] == ["title", "source_url", "raw_description"]
    assert "journey_steps" in headers
    assert "documents_needed" in headers
    assert "typical_salary_bdt" in headers
