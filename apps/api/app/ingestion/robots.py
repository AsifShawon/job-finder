from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

# Cache parsers per robots_url for the lifetime of the worker process.
# None sentinel = no robots.txt (allow all).
_robots_cache: dict[str, RobotFileParser | None] = {}


def _get_robots_parser(robots_url: str) -> RobotFileParser | None:
    if robots_url in _robots_cache:
        return _robots_cache[robots_url]
    parser = RobotFileParser()
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(robots_url)
            if response.status_code >= 400:
                _robots_cache[robots_url] = None
                return None
            parser.parse(response.text.splitlines())
    except Exception:
        _robots_cache[robots_url] = None
        return None
    _robots_cache[robots_url] = parser
    return parser


def is_allowed(url: str, user_agent: str) -> bool:
    parsed = urlparse(url)
    robots_url = urljoin(f"{parsed.scheme}://{parsed.netloc}", "/robots.txt")
    parser = _get_robots_parser(robots_url)
    if parser is None:
        return True
    return parser.can_fetch(user_agent, url)
