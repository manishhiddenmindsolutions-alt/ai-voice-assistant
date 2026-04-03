import json
import logging
import pathlib
import sys

from livekit.agents import llm

# Ensure parent src is in path for absolute imports within src
sys.path.append(str(pathlib.Path(__file__).parent.parent))
from utils.city_matcher import fuzzy_match_city

logger = logging.getLogger("voice-agent")


# =========================
# PROPERTY DATA LOADER
# =========================
def _load_property_data() -> list[dict]:
    # Look in the data folder relative to this file
    json_path = pathlib.Path(__file__).parent.parent / "data" / "property.json"
    try:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        logger.info(f"Loaded {len(data)} properties from {json_path.name}")
        return data
    except Exception as e:
        logger.error(f"Could not load property data: {e}")
        return []


PROPERTY_DATA = _load_property_data()


# =========================
# PROPERTY TOOLS
# =========================
class PropertyTools:
    @llm.function_tool(
        description=(
            "Search real estate properties in Rajasthan cities: "
            "udaipur, jaipur, jodhpur, kota, ajmer, bikaner. "
            "Pass budget values IN LAKH directly — do NOT convert to Rupees. "
            "Example: user says '20 lakh se 40 lakh' means min_lakh=20, max_lakh=40."
        )
    )
    async def search_properties(
        self,
        city: str,
        min_lakh: str = "0",
        max_lakh: str = "100",
    ) -> str:
        """Find the best property areas in a Rajasthan city within a budget."""
        try:
            min_lakh_val = int(float(str(min_lakh)))
            max_lakh_val = int(float(str(max_lakh)))
        except (ValueError, TypeError):
            return "Budget values must be numbers in lakhs."

        # Resolve city using fuzzy matching
        city_resolved = fuzzy_match_city(city)
        if not city_resolved:
            return f"Humein '{city}' ke baare mein jaankari nahi hai. Kripya Rajashtan ke bade shehar batayein."

        # Handle Rupees to Lakh auto-conversion
        if min_lakh_val > 1000:
            min_lakh_val = min_lakh_val // 100_000
        if max_lakh_val > 1000:
            max_lakh_val = max_lakh_val // 100_000

        min_rupees = min_lakh_val * 100_000
        max_rupees = max_lakh_val * 100_000

        logger.info(
            f"[TOOL CALL] city='{city_resolved}' budget={min_lakh_val}L-{max_lakh_val}L"
        )

        matches = [
            p
            for p in PROPERTY_DATA
            if p["city"] == city_resolved and min_rupees <= p["avg_price"] <= max_rupees
        ]

        if not matches:
            return (
                f"{city_resolved.title()} mein {min_lakh_val} se {max_lakh_val} lakh ke beech "
                "koi property nahi mili. Kripya budget badhaiye."
            )

        matches.sort(key=lambda x: x["growth"], reverse=True)
        top = matches[:3]  # Increased to 3 options for the larger dataset
        options = [f"{p['area']} ({int(p['avg_price'] / 100_000)} lakh)" for p in top]

        result = (
            f"{city_resolved.title()} mein {len(matches)} options mile. "
            f"Behtareen results hain: {', '.join(options)}. "
            f"Inmein se {top[0]['area']} ki growth sabse achhi hai."
        )

        logger.info(f"[TOOL RESULT] {len(matches)} matches found")
        return result
