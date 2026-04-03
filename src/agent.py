import asyncio
import logging
import os
import pathlib
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

# Ensure the parent directory 'src' is in the system path for absolute imports
sys.path.append(str(pathlib.Path(__file__).parent))

from livekit import rtc  # noqa: F401
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    UserStateChangedEvent,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import groq, sarvam, silero

# Import tools from reorganized structure
try:
    from tools.search_tools import PropertyTools
except ImportError:
    # Handle direct script execution vs module run case
    from .tools.search_tools import PropertyTools

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
    llm = groq.LLM(model="llama-3.3-70b-versatile")
    property_tools = PropertyTools()

    broker_agent = Agent(
        instructions=(
            "Aap ek professional Rajasthan property broker hain. Hamesha Hindi mein baat karein.\n"
            "CONSTRAINTS:\n"
            "1. Jab aap search_properties tool call karte hain, toh sirf tool dwara diye gaye result ko natural Hindi mein bole.\n"
            "2. Kabhi bhi internal process, function names, ya 'searching data' jaisi baatein user se na kahein.\n"
            "3. Teknikal numbers ya JSON format kabhi mat bole. "
            "4. Apni baat hamesha polite aur helpful rakhein."
        ),
        stt=stt,
        llm=llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        tools=[property_tools.search_properties],
        min_endpointing_delay=0.6,
    )

    session = AgentSession(
        user_away_timeout=10,
    )

    # State management
    _user_had_spoken = False
    _is_agent_busy = False
    _goodbye_task: asyncio.Task | None = None

    @session.on("user_input_transcribed")
    def on_user_spoke(ev):
        nonlocal _user_had_spoken, _is_agent_busy
        if ev.is_final and ev.transcript.strip():
            _user_had_spoken = True
            _is_agent_busy = True
            logger.info(f'[USER SAID] "{ev.transcript}"')
            print("User said:", ev.transcript)

    @session.on("conversation_item_added")
    def on_item(ev):
        nonlocal _is_agent_busy
        if getattr(ev.item, "role", None) == "assistant":
            _is_agent_busy = False
            content = getattr(ev.item, "text_content", None) or getattr(
                ev.item, "content", None
            )
            if content:
                logger.info(f'[AGENT REPLY] "{content}"')

    @session.on("user_state_changed")
    def on_user_state_changed(ev: UserStateChangedEvent):
        nonlocal _goodbye_task
        if ev.new_state == "away" and _user_had_spoken and not _is_agent_busy:
            logger.info("[SILENCE] Triggering session end in 10s")
            _goodbye_task = asyncio.create_task(_end_session())
        elif _goodbye_task and not _goodbye_task.done():
            _goodbye_task.cancel()
            _goodbye_task = None
            logger.info("[SILENCE] Resumed — goodbye cancelled")

    async def _end_session():
        try:
            speech = session.say(
                "Aapka dhanyavaad. Rajasthan Property Agent se baat karne ke liye shukriya. Aapka din shubh ho.",
                allow_interruptions=False,
            )
            await speech.join()
            await ctx.room.disconnect()
        except asyncio.CancelledError:
            pass

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    await session.start(agent=broker_agent, room=ctx.room)

    session.say(
        "Namaste! Main aapka Rajasthan property broker hoon. "
        "Jaipur, Jodhpur ya Udaipur, batayein kaun se shehar mein aapke liye property dekhoon?",
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
