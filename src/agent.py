import asyncio
import logging
import os
import pathlib
import sys
from datetime import datetime
from logging.handlers import RotatingFileHandler

from dotenv import load_dotenv

sys.path.append(str(pathlib.Path(__file__).parent))

from livekit import rtc  # noqa
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
    inference
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import google, groq, noise_cancellation, sarvam, silero

from tools.search_tools import PropertyTools


# =========================
# SETUP LOGGING
# =========================
load_dotenv(".env.local")

BASE_DIR = pathlib.Path(__file__).parent.parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voice-agent")


# =========================
# PREWARM (VAD)
# =========================
def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load(
        activation_threshold=0.6,
        deactivation_threshold=0.35,
        min_silence_duration=0.6,
        prefix_padding_duration=0.8,
    )
    proc.userdata["nc"] = noise_cancellation.BVC()


# =========================
# ENTRYPOINT
# =========================
async def entrypoint(ctx: JobContext):
    logger.info("=== Agent starting ===")

    # ===== INIT =====
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

    llm = groq.LLM(
        model="llama-3.3-70b-versatile",
    )
    property_tools = PropertyTools()

    # =========================
    # AGENT PROMPT (Rajasthan Property Specialist)
    # =========================
    AGENT_INSTRUCTIONS = """
Aap ek Rajasthan property broker hain (Jaipur, Udaipur, Jodhpur specialist).

👉 User ki requirement (city, budget, type) samajhkar unhe best options batayein.

🧠 Rules:
    Aap ek Rajasthan property broker hain (Jaipur, Udaipur, Jodhpur specialist).

    👉 User ki requirement (city, budget, type) samajhkar unhe best options batayein.

    🧠 Rules:
    - Agar user city bole → ALWAYS tool use karein
    - Kabhi guess na karein
    - Agar unclear ho:
      "Kya aap Kota kehna chahte hain?"

    🏠 Response:
    - Sirf relevant information dein
    - Simple Hindi use karein
    - Short aur clear jawab dein

    🛠️ Tool:
    - Property search ke liye tool MUST use karein
    - Tool result ko normal Hindi me explain karein
    - JSON ya technical data na dikhayein

    ❌ Avoid:
    - Guessing
    - Long explanation
    - English-heavy replies

    ✅ Always:
    - Clear, helpful, human-like jawab
    """

    # ===== AGENT =====
    agent = Agent(
        instructions=AGENT_INSTRUCTIONS,
        stt=stt,
        llm=llm,
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        tools=[property_tools.search_properties],
        min_endpointing_delay=1.0,
    )

    session = AgentSession()

    # =========================
    # STATE
    # =========================
    inactivity_task: asyncio.Task | None = None
    _is_closing = False

    # =========================
    # TIMEOUT FUNCTION
    # =========================
    async def inactivity_timeout():
        nonlocal _is_closing
        try:
            await asyncio.sleep(20)
            _is_closing = True
            logger.info("[TIMEOUT] Closing session")

            # 🔥 Stop further agent processing
            session.interrupt_all()

            speech = session.say(
                "Lagta hai aap abhi busy hain. Dhanyavaad!",
                allow_interruptions=False,
            )
            await speech.wait_for_playout()

            await asyncio.sleep(0.5)

            # Remove users
            for p in ctx.room.remote_participants.values():
                try:
                    await ctx.room.remove_participant(p.identity)
                except:
                    pass

            # 🔥 FINAL disconnect
            await ctx.room.disconnect()
        except asyncio.CancelledError:
            pass
    # =========================
    # USER SPEAK EVENT
    # =========================
    @session.on("user_input_transcribed")
    def on_user_spoke(ev):
        nonlocal inactivity_task, _is_closing
        if _is_closing:
            return

        # Add debug logging for all transcripts
        if ev.transcript.strip():
            logger.info(f'[STT] {"Final" if ev.is_final else "Partial"}: "{ev.transcript}"')

        if ev.is_final and ev.transcript.strip():
            # RESET TIMER
            if inactivity_task:
                inactivity_task.cancel()
            inactivity_task = asyncio.create_task(inactivity_timeout())

    # =========================
    # AGENT RESPONSE EVENT
    # =========================
    @session.on("conversation_item_added")
    def on_agent_response(ev):
        nonlocal inactivity_task, _is_closing
        if _is_closing:
            return

        if getattr(ev.item, "role", None) == "assistant":
            # RESET TIMER AFTER RESPONSE
            if inactivity_task:
                inactivity_task.cancel()
            inactivity_task = asyncio.create_task(inactivity_timeout())

    # =========================
    # TRACK SUBSCRIBED (BVC NC)
    # =========================
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(
        track: rtc.Track,
        publication: rtc.TrackPublication,
        participant: rtc.RemoteParticipant,
    ):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Applying Noise Cancellation to {participant.identity}'s track")
            options = ctx.proc.userdata["nc"]
            
            # Correct LiveKit NC initialization: Filter(id, plugin_path, dependencies)
            transformer = rtc.AudioFilter(
                options.id, 
                noise_cancellation.plugin_path(), 
                noise_cancellation.dependencies_path()
            )
            # Apply the specific model (BVC) options
            transformer.options(options.options)
            
            track.add_transformer(transformer)

    # =========================
    # CONNECT
    # =========================
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    await session.start(agent=agent, room=ctx.room)

    # =========================
    # GREETING
    # =========================
    session.say(
        "Namaste! Main aapka Rajasthan property broker hoon. "
        "Batayein kaun se shehar mein property chahiye?",
        allow_interruptions=True,
    )


# =========================
# RUN
# =========================
if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="rajasthan-property-broker",
        )
    )