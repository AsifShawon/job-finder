from collections.abc import Callable

from app.ingestion.parsers.default_parser import parse_default
from app.ingestion.schemas import FetchedPage

ParserFunc = Callable[[FetchedPage], dict]

PARSER_REGISTRY: dict[str, ParserFunc] = {
    "default": parse_default,
    "bd_bmet_default": parse_default,
    "scholarship_generic": parse_default,
    "policy_news_default": parse_default,
}


def get_parser(parser_key: str) -> ParserFunc:
    return PARSER_REGISTRY.get(parser_key, parse_default)
