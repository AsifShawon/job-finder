from pathlib import Path


def test_search_jobs_migration_contains_new_storage_contract() -> None:
    migration = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20260502_0013_search_html_jobs.py"
    text = migration.read_text(encoding="utf-8")

    assert "source_item_key" in text
    assert "crawl_run_id" in text
    assert "search_results_limit" in text
    assert "uq_opportunity_source_item_key" in text
