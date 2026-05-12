from types import SimpleNamespace

from app.services.copilot_chat_service import _build_title
from app.services.rag_service import ConversationTurn, _build_history_context, _parse_answer_payload


def test_build_title_truncates_long_first_question() -> None:
    title = _build_title("How can I apply for a warehouse job in Canada with visa support and accommodation included?")
    assert len(title) <= 80
    assert title.endswith("…")


def test_build_history_context_limits_to_recent_turns() -> None:
    history = [ConversationTurn(role="user" if i % 2 == 0 else "assistant", content=f"message {i}") for i in range(10)]
    rendered = _build_history_context(history)
    assert "message 0" not in rendered
    assert "message 9" in rendered


def test_parse_answer_payload_extracts_follow_ups_from_json() -> None:
    matches = [SimpleNamespace(country="Canada")]
    answer, follow_ups = _parse_answer_payload(
        '{"answer":"Try [#12] first.","suggested_follow_ups":["What documents are needed?","Can I apply from Bangladesh?"]}',
        locale="en",
        matches=matches,
    )
    assert answer == "Try [#12] first."
    assert follow_ups == ["What documents are needed?", "Can I apply from Bangladesh?"]
