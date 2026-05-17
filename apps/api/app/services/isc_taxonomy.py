from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ISCCategoryDefinition:
    key: str
    bn: str
    en: str
    search_terms: tuple[str, ...]


ISC_CATEGORY_DEFINITIONS: tuple[ISCCategoryDefinition, ...] = (
    ISCCategoryDefinition(
        key="informal_isc",
        bn="ইনফরমাল সেক্টর",
        en="Informal Sector",
        search_terms=("general", "labor", "helper", "driver", "cleaner", "domestic", "security"),
    ),
    ISCCategoryDefinition(
        key="ict_isc",
        bn="আইসিটি",
        en="ICT",
        search_terms=("it", "software", "developer", "tech", "digital", "programmer", "network"),
    ),
    ISCCategoryDefinition(
        key="agrofood_isc",
        bn="অ্যাগ্রোফুড",
        en="Agrofood",
        search_terms=("food processing", "agriculture", "farm", "fishery", "food", "dairy"),
    ),
    ISCCategoryDefinition(
        key="jute_isc",
        bn="জুট সেক্টর",
        en="Jute Sector",
        search_terms=("jute", "fiber", "yarn"),
    ),
    ISCCategoryDefinition(
        key="ceramic_isc",
        bn="সিরামিক",
        en="Ceramic",
        search_terms=("ceramic", "tile", "pottery", "glass"),
    ),
    ISCCategoryDefinition(
        key="leather_isc",
        bn="লেদার ও লেদার গুডস",
        en="Leather & Leather Goods",
        search_terms=("leather", "footwear", "tannery", "shoe"),
    ),
    ISCCategoryDefinition(
        key="light_eng_isc",
        bn="লাইট ইঞ্জিনিয়ারিং",
        en="Light Engineering",
        search_terms=("engineering", "mechanic", "lathe", "machinist", "fitter", "welder"),
    ),
    ISCCategoryDefinition(
        key="rgt_isc",
        bn="রেডিমেড গার্মেন্টস ও টেক্সটাইল",
        en="Readymade Garments & Textile",
        search_terms=("garments", "textile", "sewing", "fabric", "apparel", "tailoring"),
    ),
    ISCCategoryDefinition(
        key="pharma_isc",
        bn="ফার্মাসিউটিক্যাল",
        en="Pharmaceutical",
        search_terms=("pharmaceutical", "medicine", "laboratory", "pharmacy", "medical"),
    ),
    ISCCategoryDefinition(
        key="furniture_isc",
        bn="ফার্নিচার",
        en="Furniture",
        search_terms=("furniture", "carpentry", "wood", "cabinet"),
    ),
    ISCCategoryDefinition(
        key="plastics_isc",
        bn="প্লাস্টিকস",
        en="Plastics",
        search_terms=("plastic", "polymer", "molding", "packaging"),
    ),
    ISCCategoryDefinition(
        key="tourism_isc",
        bn="ট্যুরিজম ও হসপিটালিটি",
        en="Tourism & Hospitality",
        search_terms=("hotel", "hospitality", "restaurant", "tourism", "cook", "waiter", "chef"),
    ),
    ISCCategoryDefinition(
        key="creative_media_isc",
        bn="ক্রিয়েটিভ মিডিয়া",
        en="Creative Media",
        search_terms=("media", "graphic", "video", "design", "creative", "photography"),
    ),
    ISCCategoryDefinition(
        key="construction_isc",
        bn="কনস্ট্রাকশন",
        en="Construction",
        search_terms=("construction", "civil", "mason", "welder", "carpenter", "plumber", "electrician"),
    ),
    ISCCategoryDefinition(
        key="agriculture_isc",
        bn="এগ্রিকালচার",
        en="Agriculture",
        search_terms=("agriculture", "farming", "crop", "livestock", "poultry"),
    ),
)

ISC_CATEGORY_LOOKUP: dict[str, ISCCategoryDefinition] = {
    category.key: category for category in ISC_CATEGORY_DEFINITIONS
}

ISC_TO_SEARCH_TERMS: dict[str, list[str]] = {
    category.key: list(category.search_terms) for category in ISC_CATEGORY_DEFINITIONS
}


def count_isc_term_hits(*texts: str | None, category_key: str) -> int:
    category = ISC_CATEGORY_LOOKUP.get(category_key)
    if category is None:
        return 0
    combined = normalize_isc_text(" ".join(filter(None, texts)))
    return sum(1 for term in category.search_terms if term in combined)


def determine_isc_category_key(*texts: str | None) -> str | None:
    combined = normalize_isc_text(" ".join(filter(None, texts)))
    if not combined:
        return None

    best_key: str | None = None
    best_hits = 0
    for category in ISC_CATEGORY_DEFINITIONS:
        hits = sum(1 for term in category.search_terms if term in combined)
        if hits > best_hits:
            best_hits = hits
            best_key = category.key

    return best_key if best_hits > 0 else None


def normalize_isc_text(value: str) -> str:
    return " ".join((value or "").lower().split())
