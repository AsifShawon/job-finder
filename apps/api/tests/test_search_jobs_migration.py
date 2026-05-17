from pathlib import Path


def test_search_jobs_migration_contains_new_storage_contract() -> None:
    migration = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20260502_0013_search_html_jobs.py"
    text = migration.read_text(encoding="utf-8")

    assert "source_item_key" in text
    assert "crawl_run_id" in text
    assert "search_results_limit" in text
    assert "uq_opportunity_source_item_key" in text


def test_isc_category_migration_contains_listing_index() -> None:
    migration = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20260516_0018_isc_categories.py"
    text = migration.read_text(encoding="utf-8")

    assert "isc_category_key" in text
    assert "ix_opportunity_isc_category_listing" in text


def test_raw_document_diagnostics_migration_exists() -> None:
    migration = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20260517_0019_raw_document_extraction_diagnostics.py"
    text = migration.read_text(encoding="utf-8")

    assert "extraction_diagnostics_json" in text
    assert "raw_documents" in text
