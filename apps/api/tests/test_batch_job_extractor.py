from __future__ import annotations

from app.ingestion.extractor import extract_jobs_structured
from app.ingestion.schemas import JobOpportunityExtraction, PageJobsExtraction


class _FakeStructuredInvoker:
    def invoke(self, prompt: str) -> PageJobsExtraction:
        assert "The page may contain zero, one, or many jobs." in prompt
        return PageJobsExtraction(
            jobs=[
                JobOpportunityExtraction(
                    title="Welder",
                    title_bn="ওয়েল্ডার",
                    summary="Skilled welder role",
                    summary_en="Skilled welder role in Japan.",
                    summary_bn="জাপানে দক্ষ ওয়েল্ডার পদ।",
                    country="Japan",
                    employer="ABC Co",
                    application_url="https://jobs.example.com/apply/1",
                    requirements=["Valid passport required"],
                    extraction_confidence=0.88,
                ),
                JobOpportunityExtraction(
                    title="Driver",
                    title_bn="ড্রাইভার",
                    summary="Driver role",
                    summary_en="Driver role in Japan.",
                    summary_bn="জাপানে ড্রাইভার পদ।",
                    country="Japan",
                    employer="ABC Co",
                    application_url="https://jobs.example.com/apply/2",
                    requirements=["Driving license required"],
                    extraction_confidence=0.84,
                ),
            ]
        )


class _FakeChatGroq:
    def __init__(self, **_kwargs) -> None:
        return None

    def with_structured_output(self, _schema):
        return _FakeStructuredInvoker()


def test_extract_jobs_structured_returns_many_jobs(monkeypatch) -> None:
    monkeypatch.setattr("app.ingestion.extractor.get_ai_provider", lambda _db: "groq")
    monkeypatch.setattr("app.ingestion.extractor.get_ai_api_key", lambda _db: "test-key")
    monkeypatch.setattr("app.ingestion.extractor.get_ai_model", lambda _db: "test-model")
    monkeypatch.setattr("app.ingestion.extractor.ChatGroq", _FakeChatGroq)

    jobs = extract_jobs_structured(
        db=None,
        cleaned={"title": "Current vacancies", "body_text": "Welder and Driver roles available"},
        max_jobs=10,
    )

    assert [job.title for job in jobs] == ["Welder", "Driver"]
    assert all(job.record_type == "job" for job in jobs)
