from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

settings = get_settings()

_bucket: dict[str, deque[datetime]] = defaultdict(deque)
_lock = Lock()


def _parse_rule(rule: str) -> tuple[int, timedelta]:
    value, unit = rule.split("/")
    limit = int(value)
    if unit == "minute":
        return limit, timedelta(minutes=1)
    if unit == "second":
        return limit, timedelta(seconds=1)
    if unit == "hour":
        return limit, timedelta(hours=1)
    return limit, timedelta(minutes=1)


def enforce_copilot_rate_limit(request: Request) -> None:
    limit, window = _parse_rule(settings.rate_limit_copilot)
    now = datetime.now(UTC)
    key = request.client.host if request.client else "unknown"

    with _lock:
        q = _bucket[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Copilot rate limit exceeded",
            )
        q.append(now)
