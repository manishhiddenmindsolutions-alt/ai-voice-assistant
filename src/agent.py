import asyncio
import json
import logging
import os
import pathlib
from datetime import datetime
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv
from livekit import rtc  # noqa: F401
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    UserStateChangedEvent,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import groq, sarvam, silero

# =========================
# SETUP — Console + File Logging
# =========================
load_dotenv(".env.local")

BASE_DIR = pathlib.Path(__file__).parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "agent.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
_file_handler = RotatingFileHandler(
    LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
)
_file_handler.setFormatter(
    logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
)
logging.getLogger().addHandler(_file_handler)

logger = logging.getLogger("voice-agent")
logger.info(f"=== Agent starting | log: {LOG_FILE} ===")


# =========================
# PROPERTY DATA
# =========================
def _load_property_data() -> list[dict]:
    json_path = pathlib.Path(__file__).parent / "property.json"
    try:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        logger.info(f"Loaded {len(data)} properties from property.json")
        return data
    except Exception as e:
        logger.error(f"Could not load property.json: {e}")
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

        city_lower = city.strip().lower()

        # Handle Rupees to Lakh auto-conversion
        if min_lakh_val > 1000:
            min_lakh_val = min_lakh_val // 100_000
        if max_lakh_val > 1000:
            max_lakh_val = max_lakh_val // 100_000

        min_rupees = min_lakh_val * 100_000
        max_rupees = max_lakh_val * 100_000

        logger.info(
            f"[TOOL CALL] city='{city_lower}' budget={min_lakh_val}L-{max_lakh_val}L"
        )

        matches = [
            p
            for p in PROPERTY_DATA
            if p["city"] == city_lower and min_rupees <= p["avg_price"] <= max_rupees
        ]

        if not matches:
            return (
                f"{city.title()} mein {min_lakh_val} se {max_lakh_val} lakh ke beech "
                "koi property nahi mili. Kripya budget badhaiye ya doosra shehar batayein."
            )

        matches.sort(key=lambda x: x["growth"], reverse=True)
        top = matches[:2]
        options = [
            f"{p['area']} {int(p['avg_price'] / 100_000)} lakh mein" for p in top
        ]

        if len(options) == 1:
            result = f"{city_lower.title()} mein {options[0]} ek achha option hai."
        else:
            result = f"{city_lower.title()} mein {len(options)} option mile: {' aur '.join(options)}."

        logger.info(f"[TOOL RESULT] {result}")
        return result


# =========================
# PREWARM
# =========================
def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(
        activation_threshold=0.35,  # Catch even soft starts
        deactivation_threshold=0.25,  # Don't cut off natural trailing words
        min_silence_duration=1.2,  # 1.2s patience for natural breaks
        prefix_padding_duration=0.8,  # Essential for Bluetooth — catch first 800ms
    )


# =========================
# ENTRYPOINT
# =========================
async def entrypoint(ctx: JobContext):
    session_id = datetime.now().strftime("%H%M%S")
    logger.info(f"=== Session {session_id} starting ===")

    stt = sarvam.STT(
        api_key=os.getenv("SARVAM_API_KEY"),
        language="hi-IN",
        model="saaras:v3",
    )
    tts = sarvam.TTS(
        api_key=os.getenv("SARVAM_API_KEY"),
        model="bulbul:v3",
        speaker="shubh",
        target_language_code="hi-IN",
    )
    llm_plugin = groq.LLM(model="llama-3.3-70b-versatile")
    property_tools = PropertyTools()

    broker_agent = Agent(
        instructions=(
            "Aap ek professional Rajasthan property broker hain. Hamesha Hindi mein baat karein.\n"
        "CONSTRAINTS:\n"
        "1. Jab aap search_properties tool call karte hain, toh sirf tool dwara diye gaye result ko natural Hindi mein bole.\n"
        "2. Kabhi bhi internal process, function names, ya 'searching data' jaisi baatein user se na kahein.\n"
        "3. Agar result mil jaye, toh seedha batayein. Example: 'Kota mein mere paas do options hain...'\n"
        "4. Technical numbers ya JSON format kabhi mat bole.\n"
        "5. Apni baat hamesha polite aur short rakhein."
        ),
        stt=stt,
        llm=llm_plugin,
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        tools=[property_tools.search_properties],
        min_endpointing_delay=0.6,  # Wait for STT to settle
    )

    session = AgentSession(
        user_away_timeout=10,  # 10s total silence before away
    )

    # State
    _user_has_spoken = False
    _conversation_active = False
    _goodbye_task: asyncio.Task | None = None

    @session.on("user_input_transcribed")
    def on_user_spoke(ev):
        nonlocal _user_has_spoken, _conversation_active
        if ev.is_final and ev.transcript.strip():
            _user_has_spoken = True
            _conversation_active = True
            logger.info(f'[USER SAID] "{ev.transcript}"')
            print("User said:", ev.transcript)

    @session.on("conversation_item_added")
    def on_item(ev):
        nonlocal _conversation_active
        if getattr(ev.item, "role", None) == "assistant":
            _conversation_active = False
            content = getattr(ev.item, "text_content", None) or getattr(
                ev.item, "content", None
            )
            if content:
                logger.info(f'[AGENT REPLY] "{content}"')

    @session.on("user_state_changed")
    def on_user_state_changed(ev: UserStateChangedEvent):
        nonlocal _goodbye_task
        if ev.new_state == "away" and _user_has_spoken and not _conversation_active:
            logger.info("[SILENCE] Ending session after 10s")
            _goodbye_task = asyncio.create_task(_end_session_after_thanks())
        elif _goodbye_task and not _goodbye_task.done():
            _goodbye_task.cancel()
            _goodbye_task = None
            logger.info("[SILENCE] Resumed — cancelled goodbye")

    async def _end_session_after_thanks():
        try:
            speech = session.say(
                "Dhanyavaad! Aapka din shubh ho.", allow_interruptions=False
            )
            await speech.join()
            await ctx.room.disconnect()
        except asyncio.CancelledError:
            pass

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    await session.start(agent=broker_agent, room=ctx.room)

    session.say(
        "Namaste! Main aapka Rajasthan property broker hoon. "
        "Kaun se shehar mein property chahiye?",
        allow_interruptions=True,
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="rajasthan-property-broker",
        )
    )
