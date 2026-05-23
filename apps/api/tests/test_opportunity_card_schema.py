from app.schemas.opportunity import PublishedOpportunityCard, RecommendationCard
from app.api.v1.endpoints.opportunities import get_opportunity
from app.services.search_service import get_opportunity_categories, get_opportunity_quick_access
from app.services.isc_taxonomy import ISC_CATEGORY_DEFINITIONS
from unittest.mock import MagicMock


def test_published_opportunity_card_includes_experience_years() -> None:
    card = PublishedOpportunityCard(
        id=1,
        title="Senior Planner",
        opportunity_type="overseas_job",
        country="Saudi Arabia",
        destination_country="Saudi Arabia",
        employer_or_organization="Example Group",
        isc_category_key="construction_isc",
        experience_min_years=15,
        source_page_url="https://example.com/job/1",
        source_url="https://example.com/job/1",
    )

    dumped = card.model_dump()

    assert dumped["experience_min_years"] == 15
    assert dumped["isc_category_key"] == "construction_isc"


def test_recommendation_card_keeps_experience_years_for_card_ui() -> None:
    card = RecommendationCard(
        id=2,
        title="Site Supervisor",
        country="Saudi Arabia",
        experience_min_years=None,
        source_url="https://example.com/job/2",
    )

    dumped = card.model_dump()

    assert "experience_min_years" in dumped
    assert dumped["experience_min_years"] is None


def test_public_detail_mapping_includes_bilingual_fields() -> None:
    opp = MagicMock()
    opp.id = 1
    opp.title = "Cleaner worker"
    opp.title_bn = "ক্লিনার কর্মী"
    opp.title_en = "Cleaner worker"
    opp.opportunity_type = "overseas_job"
    opp.country = "Saudi Arabia"
    opp.destination_country = "Saudi Arabia"
    opp.employer_or_organization = "Tamimi"
    opp.sector = "Operations"
    opp.isc_category_key = "informal_isc"
    opp.platform_category_bn = "ইনফরমাল সেক্টর"
    opp.platform_category_en = "Informal Sector"
    opp.salary_min = None
    opp.salary_max = None
    opp.salary_currency = "SAR"
    opp.salary_text = "SAR 1200"
    opp.salary_text_bn = "SAR 1200"
    opp.salary_text_en = "SAR 1200"
    opp.deadline = None
    opp.source_page_url = "https://tamimi.sa/job/cleaner-worker"
    opp.document_url = None
    opp.original_apply_url = "https://tamimi.sa/job/cleaner-worker"
    opp.content_type = "html"
    opp.source_name = "Tamimi Official Careers"
    opp.source_trust_badge = "অফিসিয়াল পার্টনার"
    opp.can_apply_from_bd = True
    opp.requires_existing_work_permit = False
    opp.open_to_international_candidates = True
    opp.open_to_authorized_workers_only = False
    opp.lmia_status = "none"
    opp.eligibility_status = "eligible"
    opp.target_audience_tags = []
    opp.risk_flags = []
    opp.trust_score = 0.9
    opp.bangladesh_applicability = "high"
    opp.rural_user_fit_score = 0.8
    opp.actionability_score = 0.9
    opp.overall_rank_score = 0.9
    opp.published_at = None
    opp.summary_bn = "বাংলাদেশ থেকে আবেদন করা যাবে।"
    opp.summary_en = "Open to Bangladeshi applicants."
    opp.job_title = "Cleaner worker"
    opp.job_title_bn = "ক্লিনার কর্মী"
    opp.job_title_en = "Cleaner worker"
    opp.skill_level = None
    opp.education_min = None
    opp.experience_min_years = None
    opp.extraction_warnings = []
    opp.location_text = "Dammam, Saudi Arabia"
    opp.location_text_bn = "দাম্মাম, সৌদি আরব"
    opp.location_text_en = "Dammam, Saudi Arabia"
    opp.posted_date = None
    opp.eligibility_text = "Open to Bangladeshi applicants."
    opp.eligibility_text_bn = "বাংলাদেশি প্রার্থীরা আবেদন করতে পারবেন।"
    opp.eligibility_text_en = "Open to Bangladeshi applicants."
    opp.required_documents = "Passport, CV"
    opp.required_documents_bn = "পাসপোর্ট, সিভি"
    opp.required_documents_en = "Passport, CV"
    opp.application_process = "Apply online"
    opp.application_process_bn = "অনলাইনে আবেদন করুন"
    opp.application_process_en = "Apply online"
    opp.education_requirement = None
    opp.education_requirement_bn = None
    opp.education_requirement_en = None
    opp.experience_requirement = None
    opp.experience_requirement_bn = None
    opp.experience_requirement_en = None
    opp.language_requirement = "Basic English"
    opp.language_requirement_bn = "মৌলিক ইংরেজি"
    opp.language_requirement_en = "Basic English"
    opp.age_requirement = None
    opp.gender_requirement = None
    opp.visa_or_work_permit_info = "Employer handles visa."
    opp.visa_or_work_permit_info_bn = "নিয়োগকর্তা ভিসা ব্যবস্থা করবে।"
    opp.visa_or_work_permit_info_en = "Employer handles visa."
    opp.journey_steps = ["Apply online"]
    opp.journey_steps_bn = ["অনলাইনে আবেদন করুন"]
    opp.journey_steps_en = ["Apply online"]
    opp.documents_needed = ["পাসপোর্ট"]
    opp.documents_needed_bn = ["পাসপোর্ট"]
    opp.documents_needed_en = ["Passport"]
    opp.typical_salary_bdt = None
    opp.extraction_confidence = 0.86
    opp.connector_key = "tamimi_careers"
    opp.created_at = None
    opp.updated_at = None
    opp.source_id = 11
    opp.employer = "Tamimi"
    opp.organization = "Operations"
    opp.city = "Dammam"
    opp.application_url = "https://tamimi.sa/job/cleaner-worker"
    opp.funding_type = None
    opp.visa_support = True
    opp.record_type = "job"
    opp.source = MagicMock(trust_tier="official_partner")
    opp.requirements_json = {"items": ["Basic fitness required"]}
    opp.benefits_json = {"items": ["Accommodation"]}
    opp.language_requirements_json = {"items": ["English"]}
    opp.mirror_urls = ["https://tamimi.sa/job/cleaner-worker?lang=en"]
    opp.status = "published"
    opp.is_active = True
    opp.admin_status = "auto_approved"

    db = MagicMock()
    db.scalar.return_value = opp

    detail = get_opportunity(1, db=db)

    assert detail.title_en == "Cleaner worker"
    assert detail.location_text_bn == "দাম্মাম, সৌদি আরব"
    assert detail.eligibility_text_en == "Open to Bangladeshi applicants."
    assert detail.journey_steps_en == ["Apply online"]
    assert detail.mirror_urls == ["https://tamimi.sa/job/cleaner-worker?lang=en"]


def test_get_opportunity_categories_uses_isc_taxonomy_bn_en_labels() -> None:
    db = MagicMock()
    first_key = ISC_CATEGORY_DEFINITIONS[0].key
    db.execute.return_value.all.return_value = [(first_key, 3)]

    items = get_opportunity_categories(db)

    assert len(items) == len(ISC_CATEGORY_DEFINITIONS)
    first = next(item for item in items if item.key == first_key)
    definition = next(defn for defn in ISC_CATEGORY_DEFINITIONS if defn.key == first_key)

    assert first.label_bn == definition.bn
    assert first.label_en == definition.en
    assert first.job_count == 3


def test_get_opportunity_quick_access_uses_taxonomy_labels_and_caps_results() -> None:
    db = MagicMock()
    db.execute.return_value.all.return_value = [
        ("ict_isc", "Saudi Arabia", 4),
        ("construction_isc", "Japan", 6),
        ("tourism_isc", "Malaysia", 5),
        ("light_eng_isc", "Qatar", 3),
        ("agriculture_isc", "UAE", 2),
        ("informal_isc", "Oman", 1),
    ]

    items = get_opportunity_quick_access(db)

    assert len(items) == 5
    assert [item.job_count for item in items] == [6, 5, 4, 3, 2]
    assert items[0].category_key == "construction_isc"
    assert items[0].category_label_en == "Construction"
    assert items[0].category_label_bn
    assert items[0].country == "Japan"


def test_get_opportunity_quick_access_skips_unknown_or_incomplete_rows() -> None:
    db = MagicMock()
    db.execute.return_value.all.return_value = [
        ("ict_isc", "Saudi Arabia", 3),
        (None, "Malaysia", 2),
        ("construction_isc", None, 2),
        ("unknown_key", "Qatar", 9),
    ]

    items = get_opportunity_quick_access(db)

    assert len(items) == 1
    assert items[0].category_key == "ict_isc"
    assert items[0].country == "Saudi Arabia"


def test_get_opportunity_quick_access_sorts_ties_by_category_then_country() -> None:
    db = MagicMock()
    db.execute.return_value.all.return_value = [
        ("tourism_isc", "Malaysia", 2),
        ("construction_isc", "Japan", 2),
        ("construction_isc", "Saudi Arabia", 2),
    ]

    items = get_opportunity_quick_access(db)

    assert [(item.category_key, item.country) for item in items] == [
        ("construction_isc", "Japan"),
        ("construction_isc", "Saudi Arabia"),
        ("tourism_isc", "Malaysia"),
    ]


def test_get_opportunity_quick_access_query_uses_published_constraints_and_coalesced_country() -> None:
    db = MagicMock()
    db.execute.return_value.all.return_value = []

    get_opportunity_quick_access(db)

    stmt = db.execute.call_args.args[0]
    compiled = str(stmt)

    assert "coalesce(opportunities.destination_country, opportunities.country)" in compiled
    assert "opportunities.status = :status_1" in compiled
    assert "opportunities.is_active IS true" in compiled
    assert "opportunities.admin_status NOT IN" in compiled
    assert "opportunities.opportunity_type IN" in compiled
