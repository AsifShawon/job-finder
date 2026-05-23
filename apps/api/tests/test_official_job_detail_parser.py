from app.ingestion.extractor import (
    build_official_job_ai_input_payload,
    is_raw_metadata_summary,
    official_parsed_payload_to_fallback_extraction,
)
from app.ingestion.official_job_detail_parser import parse_official_job_detail


def test_alfanar_parser_extracts_clean_section_data() -> None:
    html = """
    <html>
      <body>
        <h1>ENGINEER, SITE ELECTRICAL</h1>
        <div>Location: Riyadh, Saudi Arabia</div>
        <h2>Job Purpose</h2>
        <p>Manage site electrical works and ensure compliance with approved drawings.</p>
        <h2>Project Execution</h2>
        <ul>
          <li>Supervise electrical installations on site</li>
          <li>Coordinate testing and commissioning activities</li>
        </ul>
        <h2>Technical Skills</h2>
        <ul>
          <li>Strong knowledge of MV and LV power distribution and T&amp;C</li>
          <li>Experience with AutoCAD, MS Office and Revit</li>
        </ul>
        <h2>Academic Qualification</h2>
        <p>Bachelor Degree in Electrical Engineering</p>
        <h2>Work Experience</h2>
        <p>4 to 6 years of work experience</p>
        <a href="/apply/123">Apply now</a>
      </body>
    </html>
    """

    parsed = parse_official_job_detail(
        html,
        "",
        {
            "company": "alfanar",
            "source_job_id": "123",
            "listing_card_title": "ENGINEER, SITE ELECTRICAL",
        },
        "successfactors_alfanar",
        "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Electrical/123",
    )

    assert parsed.title == "ENGINEER, SITE ELECTRICAL"
    assert parsed.company == "alfanar"
    assert parsed.country == "Saudi Arabia"
    assert parsed.city == "Riyadh"
    assert parsed.job_purpose == "Manage site electrical works and ensure compliance with approved drawings."
    assert "Supervise electrical installations on site" in parsed.responsibilities
    assert parsed.education == "Bachelor Degree in Electrical Engineering"
    assert parsed.work_experience == "4 to 6 years of work experience"
    assert "Experience with AutoCAD, MS Office and Revit" in parsed.technical_skills
    assert parsed.apply_url == "https://jobs.alfanar.com/apply/123"
    assert parsed.parser_confidence >= 0.7


def test_alfanar_parser_ignores_empty_anchor_text_and_keeps_apply_link() -> None:
    html = """
    <html>
      <body>
        <h1>Site Engineer - SAS | alfanar Electric</h1>
        <div>Location: Riyadh, Saudi Arabia</div>
        <a href="#menu"><span class="fa fa-bars"></span></a>
        <a href="/help"><img src="/help.png" alt="" /></a>
        <h2>Job Purpose</h2>
        <p>Monitor site operations and coordinate field execution.</p>
        <h2>Key Accountability Areas</h2>
        <ul>
          <li>Monitor day-to-day site activities to ensure alignment with project schedules.</li>
          <li>Coordinate with engineers, supervisors, and external parties.</li>
        </ul>
        <h2>Role Accountability</h2>
        <ul><li>Provide a periodic report detailing execution of planned tasks.</li></ul>
        <h2>Technical Skills</h2>
        <ul><li>Knowledge of technical drawings and QA processes.</li></ul>
        <h2>Academic Qualification</h2>
        <p>Bachelor Degree in Electrical Engineering</p>
        <h2>Work Experience</h2>
        <p>4 to 6 years of work experience</p>
        <a href="/apply/1265996701">Apply Now</a>
      </body>
    </html>
    """

    parsed = parse_official_job_detail(
        html,
        "",
        {
            "company": "alfanar",
            "source_job_id": "1265996701",
            "listing_card_title": "Site Engineer - SAS | alfanar Electric",
        },
        "successfactors_alfanar",
        "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Engineer-SAS-alfanar-Electric/1265996701/",
    )

    assert parsed.title == "Site Engineer - SAS | alfanar Electric"
    assert parsed.country == "Saudi Arabia"
    assert parsed.city == "Riyadh"
    assert parsed.job_purpose == "Monitor site operations and coordinate field execution."
    assert "Monitor day-to-day site activities to ensure alignment with project schedules." in parsed.key_accountabilities
    assert "Provide a periodic report detailing execution of planned tasks." in parsed.role_accountabilities
    assert "Knowledge of technical drawings and QA processes." in parsed.technical_skills
    assert parsed.education == "Bachelor Degree in Electrical Engineering"
    assert parsed.work_experience == "4 to 6 years of work experience"
    assert parsed.apply_url == "https://jobs.alfanar.com/apply/1265996701"
    assert parsed.parser_confidence >= 0.7


def test_apply_url_falls_back_when_only_empty_anchors_exist() -> None:
    html = """
    <html>
      <body>
        <h1>Site Engineer - SAS | alfanar Electric</h1>
        <a href="#menu"><span class="fa fa-bars"></span></a>
        <a href="/help"><img src="/help.png" alt="" /></a>
      </body>
    </html>
    """

    parsed = parse_official_job_detail(
        html,
        "",
        {
            "company": "alfanar",
            "original_apply_url": "https://jobs.alfanar.com/apply/fallback-1",
            "listing_card_title": "Site Engineer - SAS | alfanar Electric",
        },
        "successfactors_alfanar",
        "https://jobs.alfanar.com/alfanar/job/Riyadh-Site-Engineer-SAS-alfanar-Electric/1265996701/",
    )

    assert parsed.apply_url == "https://jobs.alfanar.com/apply/fallback-1"


def test_tamimi_parser_filters_noise_and_detects_transferable_iqama() -> None:
    html = """
    <html>
      <body>
        <h1>Scaffolding Erectors</h1>
        <h2>Department</h2>
        <p>Projects Department</p>
        <h2>Location</h2>
        <p>Jubail, Saudi Arabia</p>
        <h2>Transferable iqama</h2>
        <p>Transferable iqama required</p>
        <h2>Qualifications</h2>
        <ul><li>Ability to erect scaffolding safely</li></ul>
        <h2>Job Description</h2>
        <ul><li>Assemble and dismantle scaffolding structures</li></ul>
      </body>
    </html>
    """
    raw_text = "\n".join(
        [
            "Scaffolding Erectors",
            "Start apply with LinkedIn",
            "Apply Now",
            "Please wait",
            "Transferable iqama required",
            "Assemble and dismantle scaffolding structures",
        ]
    )

    parsed = parse_official_job_detail(
        html,
        raw_text,
        {"company": "Tamimi", "source_job_id": "77"},
        "tamimi_careers",
        "https://tamimi.sa/job/scaffolding-erectors",
    )

    assert parsed.title == "Scaffolding Erectors"
    assert parsed.department == "Projects Department"
    assert parsed.country == "Saudi Arabia"
    assert parsed.city == "Jubail"
    assert parsed.work_permit_or_iqama == "Transferable iqama required"
    assert "Assemble and dismantle scaffolding structures" in parsed.job_purpose
    assert "Ability to erect scaffolding safely" in parsed.qualifications
    assert "Start apply with LinkedIn" in parsed.ignored_noise_lines
    assert "Apply Now" in parsed.ignored_noise_lines
    assert "Please wait" in parsed.ignored_noise_lines


def test_aramco_and_maharah_parsers_capture_source_specific_sections() -> None:
    aramco_html = """
    <html>
      <body>
        <h1>Electrical Technician</h1>
        <div>Location: Dhahran, Saudi Arabia</div>
        <h2>Overview</h2>
        <p>Support refinery electrical maintenance operations.</p>
        <h2>Responsibilities</h2>
        <ul><li>Maintain electrical systems in operating facilities</li></ul>
        <h2>Education</h2>
        <p>Diploma in Electrical Engineering</p>
        <h2>Experience</h2>
        <p>Five years of field maintenance experience</p>
        <h2>Skills</h2>
        <ul><li>Knowledge of industrial safety standards</li></ul>
      </body>
    </html>
    """
    maharah_html = """
    <html>
      <body>
        <h1>Direct Sales Representative</h1>
        <h2>Location</h2>
        <p>Riyadh, Saudi Arabia</p>
        <h2>Description</h2>
        <p>Promote company services to retail customers.</p>
        <h2>Requirements</h2>
        <ul><li>Good communication skills</li></ul>
        <h2>Benefits</h2>
        <ul><li>Commission based incentives</li></ul>
        <a href="https://careers.maharah.com/jobs/apply/direct-sales-representative-15">Apply link</a>
      </body>
    </html>
    """

    aramco = parse_official_job_detail(
        aramco_html,
        "",
        {"company": "Aramco", "source_job_id": "17685"},
        "successfactors_aramco",
        "https://careers.aramco.com/job/17685",
    )
    maharah = parse_official_job_detail(
        maharah_html,
        "",
        {"company": "Maharah", "source_job_id": "15"},
        "maharah_posts",
        "https://careers.maharah.com/jobs/direct-sales-representative-15",
    )

    assert aramco.job_purpose == "Support refinery electrical maintenance operations."
    assert "Maintain electrical systems in operating facilities" in aramco.responsibilities
    assert aramco.education == "Diploma in Electrical Engineering"
    assert aramco.work_experience == "Five years of field maintenance experience"
    assert "Knowledge of industrial safety standards" in aramco.technical_skills

    assert maharah.title == "Direct Sales Representative"
    assert maharah.country == "Saudi Arabia"
    assert maharah.city == "Riyadh"
    assert maharah.job_purpose == "Promote company services to retail customers."
    assert "Good communication skills" in maharah.qualifications
    assert "Commission based incentives" in maharah.benefits
    assert maharah.apply_url == "https://careers.maharah.com/jobs/apply/direct-sales-representative-15"


def test_compact_ai_payload_and_fallback_extraction_stay_clean() -> None:
    html = """
    <html>
      <body>
        <h1>Land Surveyor</h1>
        <div>Location: Dammam, Saudi Arabia</div>
        <h2>Job Description</h2>
        <p>Perform site surveying and measurement work.</p>
        <h2>Experience Required</h2>
        <p>3 years experience in civil projects</p>
        <h2>Qualifications</h2>
        <ul><li>Diploma in Survey Engineering</li></ul>
        <h2>Requirements</h2>
        <ul><li>Knowledge of total station equipment</li></ul>
      </body>
    </html>
    """
    parsed = parse_official_job_detail(
        html,
        "",
        {"company": "Tamimi", "source_job_id": "88"},
        "tamimi_careers",
        "https://tamimi.sa/job/land-surveyor",
    )

    payload = build_official_job_ai_input_payload(parsed)
    extraction = official_parsed_payload_to_fallback_extraction(parsed)

    assert "raw_html" not in payload
    assert "raw_text" not in payload
    assert extraction.record_type == "job"
    assert extraction.title == "Land Surveyor"
    assert "Perform site surveying and measurement work." in (extraction.summary_en or "")
    assert "Knowledge of total station equipment" in extraction.requirements
    assert extraction.source_sections


def test_raw_metadata_summary_guard_blocks_bad_summary_text() -> None:
    assert is_raw_metadata_summary(
        "Official listing metadata:\nSource job ID: 123\nApply URL: https://example.test/apply"
    )
    assert not is_raw_metadata_summary(
        "alfanar is hiring an Engineer, Site Electrical in Riyadh, Saudi Arabia."
    )
