import difflib
import logging

logger = logging.getLogger("voice-agent")

# =========================
# CITY RESOLUTION
# =========================
VALID_CITIES = ["udaipur", "jaipur", "jodhpur", "kota", "ajmer", "bikaner"]

# phonetic / common mistranscription aliases
CITY_ALIASES = {
    "udaypur": "udaipur",
    "uday pur": "udaipur",
    "jaypur": "jaipur",
    "jai pur": "jaipur",
    "jodh pur": "jodhpur",
    "aj mere": "ajmer",
    "bee kaner": "bikaner",
}


def fuzzy_match_city(city_query: str) -> str | None:
    """Resolve city name using exact match, alias map, or fuzzy matching."""
    if not city_query:
        return None

    query = city_query.strip().lower()

    # 1. Exact match
    if query in VALID_CITIES:
        return query

    # 2. Alias map
    if query in CITY_ALIASES:
        return CITY_ALIASES[query]

    # 3. Fuzzy match (difflib)
    matches = difflib.get_close_matches(query, VALID_CITIES, n=1, cutoff=0.6)
    if matches:
        logger.info(f"[MATCHER] Fuzzy matched '{city_query}' to '{matches[0]}'")
        return matches[0]

    return None
