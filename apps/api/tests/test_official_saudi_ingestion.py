from app.ingestion.connectors.official_saudi import (
    ListingJob,
    parse_maharah_posts,
    parse_successfactors_detail,
    parse_successfactors_listing,
    parse_tamimi_listing,
)
from app.ingestion.job_classification import classify_bangladesh_suitability, classify_category, is_relevant_for_active_job


def test_alfanar_successfactors_listing_parse():
    html = """
    <table>
      <tr><td><a href="/alfanar/job/Riyadh-Maintenance-Technician/123">Maintenance Technician</a></td>
      <td>Riyadh, Saudi Arabia</td><td>Professional</td><td>13 May 2026</td></tr>
    </table>
    <a href="?startrow=16">2</a>
    """
    jobs, next_pages = parse_successfactors_listing(html, "https://jobs.alfanar.com/alfanar/go/All-Openings/4442101/", flavor="alfanar")
    assert jobs[0].title == "Maintenance Technician"
    assert jobs[0].location == "Saudi Arabia"
    assert jobs[0].experience_level == "Professional"
    assert next_pages


def test_aramco_successfactors_listing_parse_req_id():
    html = """
    <table>
      <tr><td><a href="/expat_uk/job/SA-Electrical-Technician/17685">Electrical Technician</a></td>
      <td>17685</td><td>SA</td><td>Maintenance Dept</td></tr>
    </table>
    """
    jobs, _ = parse_successfactors_listing(html, "https://careers.aramco.com/expat_uk/go/For-European-Candidates/7717923", flavor="aramco")
    assert jobs[0].source_job_id == "17685"
    assert jobs[0].location == "Saudi Arabia"
    assert "Maintenance" in (jobs[0].department or "")


def test_successfactors_detail_parse_apply_url():
    html = """
    <html><head><link rel="canonical" href="https://example.test/job/123"></head>
    <body><h1>Welder Technician</h1><a href="/apply/123">Apply now</a>
    Requirements: diploma, 2 years experience. Accommodation provided.</body></html>
    """
    page = parse_successfactors_detail(
        html,
        "https://example.test/job/123",
        ListingJob(title="Welder Technician", detail_url="https://example.test/job/123", source_job_id="123"),
        company="Example",
        flavor="alfanar",
    )
    assert page.metadata["structured_job"] is True
    assert page.metadata["source_job_id"] == "123"
    assert page.original_apply_url == "https://example.test/apply/123"


def test_tamimi_listing_parse_worker_role():
    html = '<div><h3>Electrical Supervisor</h3><p>Location: Dammam</p><a href="/job/electrical-supervisor">View & Apply</a></div>'
    jobs, _ = parse_tamimi_listing(html, "https://tamimi.sa/careers.php")
    assert jobs
    assert jobs[0].detail_url == "https://tamimi.sa/job/electrical-supervisor"


def test_maharah_post_handling_worker_intelligence():
    html = '<article><a href="/en/post/waiter-workers">Waiter workers in Saudi Arabia</a><p>Hospitality worker guide</p></article>'
    posts, _ = parse_maharah_posts(html, "https://maharah.com/en/post/")
    assert posts[0].title == "Waiter workers in Saudi Arabia"
    relevant, reason = is_relevant_for_active_job(
        title=posts[0].title,
        body="Guide for waiter workers",
        apply_url=None,
        detected_item_type="occupation_intelligence",
    )
    assert relevant is False
    assert reason == "occupation_intelligence_without_apply_path"


def test_category_classifier_worker_categories():
    category = classify_category(title="Hotel waiter", body="Restaurant worker", sector=None)
    assert category.platform_category_bn == "ট্যুরিজম ও হসপিটালিটি"
    category = classify_category(title="Civil foreman", body="Construction scaffolding", sector=None)
    assert category.platform_category_bn == "কনস্ট্রাকশন"


def test_bangladesh_suitability_no_guessing_and_review():
    result = classify_bangladesh_suitability(
        title="Senior Corporate Strategy Advisor",
        body="Requires bachelor degree and 12 years experience.",
        apply_url="https://example.test/apply",
        source_trust_level="official_partner",
        source_connector_key="successfactors_aramco",
        extraction_confidence=0.7,
    )
    assert result.bangladesh_applicability == "low"
    assert result.needs_review is True

    worker = classify_bangladesh_suitability(
        title="Cleaner worker",
        body="No salary listed. Apply now. Requirements: basic English.",
        apply_url="https://example.test/apply",
        source_trust_level="official_partner",
        source_connector_key="tamimi_careers",
        extraction_confidence=0.72,
    )
    assert worker.bangladesh_applicability in {"high", "medium"}
    assert "missing_salary" in worker.warnings
