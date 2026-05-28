"""
FreeSWITCH Media Gateway — Premium Vapi / ElevenLabs-like Real-time Voice Architecture.
Supports low-latency RMS Voice Activity Detection (VAD), instant Barge-in/Interruption,
dynamic BYOK key decryption, full conversational history, and direct raw PCM streaming.
"""
import asyncio
import logging
import json
import io
import math
import struct
import wave
import aiohttp
from typing import Dict, Any, List, Optional
# pyre-ignore[missing-import]
from fastapi import WebSocket
import os

# pyrefly: ignore [missing-import]
from app.db.session import AsyncSessionLocal
# pyrefly: ignore [missing-import]
from app.models.orm import AgentORM, ProviderConnectionORM, CallORM
# pyrefly: ignore [missing-import]
from app.core.security import vault
from sqlalchemy.sql import select

logger = logging.getLogger("freeswitch-media-gateway")


class FreeSWITCHMediaSession:
    """Manages an active real-time call session using a Vapi/ElevenLabs-style pipeline."""

    def __init__(self, websocket: WebSocket, agent_id: str):
        self.websocket = websocket
        self.agent_id = agent_id
        self.is_active = True
        
        # Conversation State
        self.history: List[Dict[str, str]] = []
        self.instructions: str = "You are a helpful customer service representative."
        self.config: Dict[str, Any] = {}
        self.provider_keys: Dict[str, str] = {}
        
        # Audio & VAD State
        self.speech_buffer = io.BytesIO()
        self.user_speaking = False
        self.silence_time = 0.0
        self.agent_speaking = False
        self.active_playback_task: Optional[asyncio.Task] = None
        
        # VAD Config
        self.vad_threshold = 800.0  # RMS voice detection threshold
        self.silence_timeout = 0.8  # Silence duration to declare end of turn (seconds)
        self.sample_rate = 8000     # Default standard telephony rate

    async def initialize(self):
        """Resolves the agent configurations, decrypts secure BYOK keys, and triggers initial greeting."""
        logger.info(f"⚡ [HMS Gateway] Initializing premium ElevenLabs/Vapi-like session for agent: {self.agent_id}")
        
        async with AsyncSessionLocal() as db:
            # 1. Fetch Agent Model
            agent_result = await db.execute(
                select(AgentORM).where(AgentORM.id == self.agent_id)
            )
            agent = agent_result.scalar_one_or_none()
            
            if not agent:
                logger.error(f"Agent {self.agent_id} not found. Running with baseline default system persona.")
                self.config = {
                    "language": "hi-IN",
                    "agentName": "System Agent",
                    "llm": {"provider": "groq", "model": "llama-3.3-70b-versatile"},
                    "tts": {"provider": "sarvam", "voice": "shubh"},
                    "stt": {"provider": "groq"}
                }
                user_id = "default"
            else:
                self.config = agent.config or {}
                # Sync core ORM values into config
                self.config.update({
                    "agentName": agent.agent_name,
                    "language": agent.language or "hi-IN",
                    "prompt": agent.prompt,
                })
                user_id = agent.user_id

            # 2. Setup System Persona instructions
            agent_name = self.config.get("agentName", "Voice Agent")
            lang_name = "Hindi" if self.config.get("language") == "hi-IN" else "English"
            self.instructions = (
                f"Your name is {agent_name}. You are a professional customer voice agent on a live phone call.\n"
                f"You MUST always speak clearly and naturally. Speak in {lang_name} at all times.\n"
                f"Keep your responses concise, conversational, and direct (max 2-3 sentences per turn) since it's a telephone conversation.\n"
                f"Instructions: {self.config.get('prompt', 'Help the caller professionally.')}"
            )
            
            # Initialize history
            self.history.append({"role": "system", "content": self.instructions})

            # 3. Decrypt Vaulted BYOK API Keys for this User
            result_conn = await db.execute(
                select(ProviderConnectionORM).where(ProviderConnectionORM.user_id == user_id)
            )
            for conn in result_conn.scalars().all():
                try:
                    decrypted_key = vault.decrypt(conn.api_key)
                    self.provider_keys[conn.provider] = decrypted_key
                    logger.info(f"🗝️ Successfully decrypted credentials for: {conn.provider}")
                except Exception as e:
                    logger.error(f"Failed to decrypt credentials for {conn.provider}: {e}")

        # 4. Schedule Initial Greeting Task
        asyncio.create_task(self.trigger_initial_greeting())

    async def trigger_initial_greeting(self):
        """Streams a pleasant introductory greeting once the telephone SIP handshake is completed."""
        await asyncio.sleep(2.0)  # Sleep briefly to let FreeSWITCH fully establish the media path
        
        greeting_text = (
            "नमस्कार! मैं आपका कस्टमर असिस्टेंट हूँ। मैं आपकी क्या मदद कर सकता हूँ?" 
            if self.config.get("language") == "hi-IN" 
            else "Hello! I am your AI assistant. How can I help you today?"
        )
        logger.info(f"🔊 Streaming initial greeting: '{greeting_text}'")
        
        # Queue greeting audio synthesis and streaming
        self.active_playback_task = asyncio.create_task(self.synthesize_and_stream(greeting_text))

    def calculate_rms(self, audio_data: bytes) -> float:
        """Calculates Root Mean Square (RMS) energy to detect voice levels in linear PCM frames."""
        if not audio_data:
            return 0.0
        count = len(audio_data) // 2
        if count == 0:
            return 0.0
        samples = struct.unpack(f"<{count}h", audio_data[:count*2])
        sum_squares = sum(s * s for s in samples)
        return math.sqrt(sum_squares / count)

    async def handle_inbound_audio(self, data: bytes):
        """
        Receives binary 16-bit linear PCM audio frames, executing real-time VAD
        and instant interruption/barge-in of the active agent playback stream.
        """
        if not self.is_active:
            return

        rms = self.calculate_rms(data)
        chunk_dur = len(data) / (2 * self.sample_rate)

        if rms > self.vad_threshold:
            # Voice detected
            if not self.user_speaking:
                self.user_speaking = True
                self.silence_time = 0.0
                logger.info(f"🎙️ [VAD] User Speech Detected (RMS: {int(rms)}). Triggers Barge-in check...")
                
                # Interrupt Agent playback instantly
                if self.agent_speaking or self.active_playback_task:
                    logger.info("⚡ [Barge-in Interrupt] User began speaking. Stopping agent playback.")
                    if self.active_playback_task:
                        self.active_playback_task.cancel()
                        self.active_playback_task = None
                    self.agent_speaking = False
            
            # Record user voice stream
            self.speech_buffer.write(data)
        else:
            # Silence detected
            if self.user_speaking:
                self.speech_buffer.write(data)
                self.silence_time += chunk_dur
                
                if self.silence_time >= self.silence_timeout:
                    self.user_speaking = False
                    logger.info("🤫 [VAD] Silence timeout reached. User finished speaking. Processing turn...")
                    
                    self.speech_buffer.seek(0)
                    raw_audio = self.speech_buffer.read()
                    self.speech_buffer = io.BytesIO()
                    
                    # Run STT-LLM-TTS pipeline in a background task
                    self.active_playback_task = asyncio.create_task(self.process_user_turn(raw_audio))

    async def process_user_turn(self, raw_audio: bytes):
        """Executes full ElevenLabs/Vapi pipeline: WAV encapsulation -> STT -> LLM -> TTS -> Outbound PCM Stream."""
        try:
            # 1. WAV Container Encapsulation in-memory
            wav_buf = io.BytesIO()
            with wave.open(wav_buf, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(self.sample_rate)
                wav_file.writeframes(raw_audio)
            wav_bytes = wav_buf.getvalue()

            # 2. Speech-to-Text (STT) via Groq or fallback
            stt_provider = self.config.get("stt", {}).get("provider", "groq")
            stt_key = self.provider_keys.get(stt_provider) or os.getenv("GROQ_API_KEY")
            
            if not stt_key:
                logger.error("No STT api key found. Please connect your accounts.")
                await self.synthesize_and_stream("Please configure your API keys in the settings panel.")
                return

            logger.info(f"⚡ [HMS STT] Transcribing voice frame via {stt_provider}...")
            user_text = await self.transcribe_audio(wav_bytes, stt_key)
            
            # Filter out empty/noise utterances
            if not user_text.strip() or len(user_text.strip()) < 2:
                logger.info("⚠️ [HMS STT] Ignoring silent/noise transcription.")
                return
                
            logger.info(f"👤 User: '{user_text}'")
            self.history.append({"role": "user", "content": user_text})

            # 3. LLM Chat Completion via Groq / OpenRouter / OpenAI
            llm_provider = self.config.get("llm", {}).get("provider", "groq")
            llm_key = self.provider_keys.get(llm_provider) or os.getenv("GROQ_API_KEY")
            
            logger.info(f"🧠 [HMS LLM] Fetching response from {llm_provider}...")
            response_text = await self.query_chat_completion(self.history, llm_key)
            logger.info(f"🤖 Agent: '{response_text}'")
            self.history.append({"role": "assistant", "content": response_text})

            # 4. Text-to-Speech & Stream Playback
            await self.synthesize_and_stream(response_text)

        except asyncio.CancelledError:
            logger.info("🗑️ Active pipeline turn cancelled by user interruption.")
        except Exception as e:
            logger.error(f"❌ HMS Media Gateway Pipeline Error: {e}", exc_info=True)

    async def transcribe_audio(self, wav_bytes: bytes, api_key: str) -> str:
        """Sends WAV frame to Groq Whisper REST endpoint for transcription."""
        headers = {"Authorization": f"Bearer {api_key}"}
        data = aiohttp.FormData()
        data.add_field("file", wav_bytes, filename="audio.wav", content_type="audio/wav")
        data.add_field("model", "whisper-large-v3")
        data.add_field("language", self.config.get("language", "hi-IN")[:2])
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.groq.com/openai/v1/audio/transcriptions", 
                headers=headers, 
                data=data
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    return result.get("text", "")
                else:
                    err_txt = await resp.text()
                    logger.error(f"STT API Error: {err_txt}")
                    return ""

    async def query_chat_completion(self, messages: list, api_key: str) -> str:
        """Sends chat logs to LLM endpoint (Groq / OpenRouter / OpenAI)."""
        provider = self.config.get("llm", {}).get("provider", "groq")
        model = self.config.get("llm", {}).get("model", "llama-3.3-70b-versatile")
        
        if provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}"}
        elif provider == "openrouter":
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://hms.ai",
                "X-Title": "HMS Voice Portal"
            }
        elif provider == "gemini":
            url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}"}
        else:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}"}
            
        payload = {
            "model": model,
            "messages": messages,
            "temperature": self.config.get("llm", {}).get("temperature", 0.7)
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    return result["choices"][0]["message"]["content"]
                else:
                    err_txt = await resp.text()
                    logger.error(f"LLM API Error: {err_txt}")
                    return "I'm sorry, I'm having trouble processing that right now."

    async def synthesize_and_stream(self, text: str):
        """Synthesizes text into 16-bit linear PCM audio and streams it to FreeSWITCH WebSocket."""
        try:
            tts_provider = self.config.get("tts", {}).get("provider", "sarvam")
            tts_key = self.provider_keys.get(tts_provider) or os.getenv("SARVAM_API_KEY")
            voice = self.config.get("tts", {}).get("voice", "shubh")
            
            if not tts_key:
                logger.error(f"No TTS API key configured for {tts_provider}.")
                return

            pcm_bytes = b""
            logger.info(f"🔊 [HMS TTS] Synthesizing speech via {tts_provider}...")
            
            if tts_provider == "openai":
                url = "https://api.openai.com/v1/audio/speech"
                headers = {"Authorization": f"Bearer {tts_key}"}
                payload = {
                    "model": "tts-1",
                    "input": text,
                    "voice": voice,
                    "response_format": "pcm"
                }
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, headers=headers, json=payload) as resp:
                        if resp.status == 200:
                            pcm_bytes = await resp.read()
            elif tts_provider == "elevenlabs":
                voice_id = voice or "21m00Tcm4TlvDq8ikWAM"
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                headers = {"xi-api-key": tts_key}
                payload = {
                    "text": text,
                    "model_id": "eleven_monolingual_v1",
                    "output_format": "pcm_16000"
                }
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, headers=headers, json=payload) as resp:
                        if resp.status == 200:
                            pcm_bytes = await resp.read()
            else:  # sarvam bulbul:v3
                url = "https://api.sarvam.ai/text-to-speech"
                headers = {"api-key": tts_key}
                payload = {
                    "inputs": [text],
                    "target_language_code": self.config.get("language", "hi-IN"),
                    "speaker": voice,
                    "model": "bulbul:v3",
                    "audio_format": "pcm"
                }
                async with aiohttp.ClientSession() as session:
                    async with session.post(url, headers=headers, json=payload) as resp:
                        if resp.status == 200:
                            result = await resp.json()
                            import base64
                            audio_b64 = result.get("audios", [""])[0]
                            pcm_bytes = base64.b64decode(audio_b64)

            if not pcm_bytes:
                logger.error("TTS Speech Synthesis returned empty audio bytes.")
                return

            # Stream back to FreeSWITCH in standard 20ms chunks (640 bytes at 16000Hz or 320 bytes at 8000Hz)
            chunk_size = 640
            self.agent_speaking = True
            logger.info(f"🔊 [HMS Gateway] Streaming {len(pcm_bytes)} PCM bytes back to FreeSWITCH...")
            
            for i in range(0, len(pcm_bytes), chunk_size):
                if not self.is_active or not self.agent_speaking:
                    break
                chunk = pcm_bytes[i:i+chunk_size]
                await self.websocket.send_bytes(chunk)
                await asyncio.sleep(0.02)  # Stream real-time frame pacing
                
            self.agent_speaking = False
            logger.info("🔊 Outbound TTS audio streaming complete.")

        except asyncio.CancelledError:
            logger.info("🗑️ Active synthesis/streaming playback cancelled by barge-in.")
            self.agent_speaking = False
        except Exception as e:
            logger.error(f"TTS streaming error: {e}")
            self.agent_speaking = False

    def close(self):
        """Gracefully terminates the Media Gateway session."""
        self.is_active = False
        self.agent_speaking = False
        if self.active_playback_task:
            self.active_playback_task.cancel()
        self.speech_buffer.close()
        logger.info(f"🚪 FreeSWITCH Media Session successfully closed for agent: {self.agent_id}")
