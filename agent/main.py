import asyncio
import logging
import json
import pathlib
import ssl
import aiohttp
from dotenv import load_dotenv
import os

# --- SSL BYPASS (CRITICAL FOR WINDOWS DEV) ---
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

from livekit import rtc
from livekit.agents import cli, JobContext, WorkerOptions, AutoSubscribe, JobProcess, llm
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import silero

# Local Imports
# pyrefly: ignore [missing-import]
from factory import create_components, create_vad

# --- CONFIG ---
_AGENT_DIR = pathlib.Path(__file__).parent
_ROOT = _AGENT_DIR.parent
dotenv_path = _ROOT / ".env.local"
load_dotenv(dotenv_path if dotenv_path.exists() else None)

# --- LOGGING ---
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

file_handler = logging.FileHandler(_ROOT / "agent.log")
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

logging.basicConfig(level=logging.INFO, handlers=[file_handler, console_handler])
logger = logging.getLogger("voice-forge-agent")
logger.setLevel(logging.INFO)

# API endpoint for transcript logging
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

async def log_transcript(session_id: str, role: str, content: str):
    """Sends transcript to the backend API."""
    url = f"{BACKEND_URL}/api/v1/calls/sessions/{session_id}/transcripts"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json={"role": role, "content": content}) as resp:
                if resp.status != 200:
                    logger.warning(f"Failed to log transcript: {resp.status}")
    except Exception as e:
        logger.warning(f"Error logging transcript: {e}")

def prewarm(proc: JobProcess):
    """Preloads heavy models into process memory."""
    logger.info("Prewarming Agent Process: Loading VAD model...")
    proc.userdata["vad"] = silero.VAD.load(
        min_speech_duration=0.3,
        min_silence_duration=0.8,
        activation_threshold=0.5
    )

class VoiceForgeAgent(Agent):
    def __init__(self, *args, on_farewell_detected=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.on_farewell_detected = on_farewell_detected

    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        from livekit.agents.llm.tool_context import StopResponse
        transcript = new_message.text_content.strip()
        # Filter out anything that contains no alphanumeric characters (to handle empty/noise turns)
        clean_transcript = "".join(c for c in transcript if c.isalnum())
        if not clean_transcript:
            logger.info("--- [HMS DEBUG] Ignoring empty/silent user turn to prevent preemptive tool execution. ---")
            raise StopResponse()
        
        # Check if the user said farewell or thanks
        user_text = transcript.lower()
        farewell_keywords = ["bye", "goodbye", "thank you", "thank u", "thanks", "dhanyawad", "shukriya", "alvida", "exit", "close call"]
        if any(keyword in user_text for keyword in farewell_keywords):
            logger.info("--- [HMS DEBUG] User farewell detected. Invoking farewell handler callback. ---")
            if self.on_farewell_detected:
                self.on_farewell_detected()
            raise StopResponse()
        
        await super().on_user_turn_completed(turn_ctx, new_message)

async def entrypoint(ctx: JobContext):
    """Main entry point for the HMS Voice Agent."""
    logger.info(f"--- [START] Job {ctx.job.id} for room {ctx.room.name} ---")

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)
    
    # Wait for at least one participant to be present
    if not ctx.room.remote_participants:
        logger.info("Waiting for participant to join...")
        try:
            await ctx.wait_for_participant()
        except RuntimeError as e:
            logger.warning(f"Stop waiting: {e}")
            return
    
    # Parse Metadata for configuration
    config = {}
    if ctx.job.metadata:
        try:
            config = json.loads(ctx.job.metadata)
            logger.info(f"--- [HMS DEBUG] Parsed Config: {json.dumps({k: ('***' if k == 'apiKey' else v) for k, v in config.items()})} ---")
        except Exception as e:
            logger.warning(f"Failed to parse metadata: {e}")


    # Initialize components
    data = create_components(config)
    prewarmed_vad = ctx.proc.userdata.get("vad")
    vad = create_vad(config, prewarmed_vad) 

    def handle_farewell():
        async def ask_and_disconnect():
            await asyncio.sleep(0.2)
            stt_lang = config.get("language") or "en"
            if stt_lang == "hi-IN":
                msg = "Should we close the communication? Kya hum call cut krde?"
            else:
                msg = "Should we close the communication?"
            logger.info(f"--- [HMS SESSION TERMINATION] Saying: {msg} ---")
            await session.say(msg, allow_interruptions=False)
            await asyncio.sleep(4.5)
            logger.info("--- [HMS SESSION TERMINATION] Disconnecting room session now. ---")
            await ctx.disconnect()
        asyncio.create_task(ask_and_disconnect())

    # Initialize Agent and Session
    agent = VoiceForgeAgent(
        instructions=data.get("instructions", "You are a helpful assistant."),
        tools=data.get("tools", []),
        on_farewell_detected=handle_farewell
    )

    session = AgentSession(
        stt=data["stt"],
        llm=data["llm"],
        tts=data["tts"],
        vad=vad
    )

    # --- Event Callbacks ---
    @session.on("user_speech_committed")
    def _on_user_speech(msg: llm.ChatMessage):
        logger.info(f"User: {msg.content}")
        asyncio.create_task(log_transcript(ctx.room.name, "user", msg.content))

    @session.on("agent_speech_committed")
    def _on_agent_speech(msg: llm.ChatMessage):
        logger.info(f"Agent: {msg.content}")
        asyncio.create_task(log_transcript(ctx.room.name, "agent", msg.content))
        
        # Smart Session Auto-Termination: Check if the agent is bidding farewell (fallback)
        content_lower = (msg.content or "").lower()
        farewells = [
            "bye", "goodbye", "thank you", "thank u", "thanks", "take care", 
            "have a great", "have a nice", "see you", 
            "dhanyawad", "shukriya", "alvida", "phir milenge"
        ]
        if any(f in content_lower for f in farewells):
            logger.info("--- [HMS FALLBACK SESSION TERMINATION] Farewell phrase detected. Scheduling auto-disconnect. ---")
            async def disconnect_later():
                # Allow 5 seconds for the TTS audio stream to play back fully to the user
                await asyncio.sleep(5)
                logger.info("--- [HMS FALLBACK SESSION TERMINATION] Disconnecting room session now. ---")
                await ctx.disconnect()
            asyncio.create_task(disconnect_later())

    # --- Start Agent Session ---
    logger.info("Starting Agent Session...")
    await session.start(agent, room=ctx.room)
    
    # Greet the user immediately
    logger.info("Agent session started. Sending greeting...")
    await session.say("Hello me apki kese help kr skta hu?", allow_interruptions=True)

    # Keep alive while connected
    while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
        await asyncio.sleep(1)

if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            agent_name="voice-forge-agent-v5",
        )
    )
