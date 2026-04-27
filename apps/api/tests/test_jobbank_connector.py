from types import SimpleNamespace

from app.ingestion.connectors.jobbank_connector import JobBankConnector


def test_parse_search_results_html_extracts_listings() -> None:
    html = """
    <article id="article-49387418" class="action-buttons">
      <a href="/jobsearch/jobpostingtfw/49387418;jsessionid=ABC.jobsearch74?source=searchresults" class="resultJobItem">
        <h3 class="title">
          <span class="noctitle"> welder </span>
        </h3>
        <ul class="list-unstyled">
          <li class="date">April 23, 2026</li>
          <li class="business">Enfield Formwork Ltd.</li>
          <li class="location"><span class="fas fa-map-marker-alt"></span> Abbotsford (BC)</li>
          <li class="salary"><span class="fa fa-dollar"></span> Salary $37.50 to $40.00 hourly (to be negotiated)</li>
          <li class="source">Job Bank</li>
        </ul>
      </a>
    </article>
    """

    connector = JobBankConnector()
    pages = connector._parse_search_results_html(
        html,
        SimpleNamespace(base_url="https://www.jobbank.gc.ca/jobsearch/jobsearch?fsrc=32"),
    )

    assert len(pages) == 1
    page = pages[0]
    assert page.title == "welder"
    assert page.canonical_url.startswith("https://www.jobbank.gc.ca/jobsearch/jobpostingtfw/49387418")
    assert page.metadata["job_id"] == "49387418"
    assert page.metadata["linkout"] is True
    assert "Enfield Formwork Ltd." in page.raw_text
    assert "Abbotsford (BC)" in page.raw_text


def test_parse_xml_feed_remains_supported() -> None:
    xml = """
    <rss><channel>
      <item>
        <title>Welder</title>
        <link>https://www.jobbank.gc.ca/jobsearch/jobpostingtfw/123?source=searchresults</link>
        <description>Example description</description>
      </item>
    </channel></rss>
    """

    connector = JobBankConnector()
    pages = connector._parse_xml_feed(xml, SimpleNamespace(base_url="https://www.jobbank.gc.ca/feed.xml"))

    assert len(pages) == 1
    assert pages[0].title == "Welder"
    assert pages[0].canonical_url == "https://www.jobbank.gc.ca/jobsearch/jobpostingtfw/123?source=searchresults"