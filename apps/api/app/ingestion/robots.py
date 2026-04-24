from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx


def is_allowed(url: str, user_agent: str) -> bool:
    parsed = urlparse(url)
    robots_url = urljoin(f"{parsed.scheme}://{parsed.netloc}", "/robots.txt")
    parser = RobotFileParser()
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(robots_url)
            if response.status_code >= 400:
                return True
            parser.parse(response.text.splitlines())
        return parser.can_fetch(user_agent, url)
    except Exception:
        return True
