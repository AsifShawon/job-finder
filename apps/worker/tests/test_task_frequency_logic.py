from datetime import UTC, datetime, timedelta


def should_queue(last_run: datetime | None, frequency_minutes: int) -> bool:
    if last_run is None:
        return True
    delta = datetime.now(UTC) - last_run
    return (delta.total_seconds() / 60) >= frequency_minutes


def test_should_queue_when_never_ran() -> None:
    assert should_queue(None, 60)


def test_should_not_queue_before_frequency() -> None:
    last = datetime.now(UTC) - timedelta(minutes=10)
    assert not should_queue(last, 60)


def test_should_queue_after_frequency() -> None:
    last = datetime.now(UTC) - timedelta(minutes=61)
    assert should_queue(last, 60)
