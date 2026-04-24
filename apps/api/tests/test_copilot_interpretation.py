from app.services.copilot_service import interpret_query


def test_interpret_query_visa_country() -> None:
    result = interpret_query("warehouse jobs in canada with visa support")
    assert result.country == "canada"
    assert result.visa_support is True
    assert result.record_type == "job"
