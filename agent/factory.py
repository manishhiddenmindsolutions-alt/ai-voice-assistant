"""
agent/factory.py — LiveKit Agents 1.6.x

Creates a configured livekit.agents.Agent from the JSON metadata blob
dispatched by the backend. The worker entrypoint should do:

    from factory import create_agent, create_vad

    async def entrypoint(ctx: JobContext):
        config = json.loads(ctx.job.metadata)
        agent  = create_agent(config)
        session = AgentSession(vad=create_vad(config))
        await session.start(ctx.room, agent=agent)
        await session.generate_reply()        # speaks first_message if set
"""

import os
import re
import json
import logging
import datetime
import urllib.parse as urlparse
from urllib.parse import urlencode
from typing import Annotated, Any, Dict, List, Optional

import aiohttp
from pydantic import Field

from livekit.agents import (
    Agent,
    NOT_GIVEN,
    NotGivenOr,
    APIConnectOptions,
    DEFAULT_API_CONNECT_OPTIONS,
    function_tool,
)
from livekit.agents import llm, stt as agents_stt, tts as agents_tts, vad as agents_vad
from livekit.plugins import groq, openai, deepgram, silero

try:
    from livekit.plugins import sarvam
except ImportError:
    sarvam = None  # type: ignore

try:
    from livekit.plugins import elevenlabs
except ImportError:
    elevenlabs = None  # type: ignore

try:
    from livekit.plugins import cartesia
except ImportError:
    cartesia = None  # type: ignore

logger = logging.getLogger("agent-factory")


# ---------------------------------------------------------------------------
# Sarvam language normalisation
# ---------------------------------------------------------------------------
SARVAM_SUPPORTED_LANGS = {
    "en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN",
    "gu-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "od-IN",
}

_SARVAM_BASE_MAP: Dict[str, str] = {
    "en": "en-IN", "hi": "hi-IN", "bn": "bn-IN",
    "ta": "ta-IN", "te": "te-IN", "gu": "gu-IN",
    "kn": "kn-IN", "ml": "ml-IN", "mr": "mr-IN",
    "pa": "pa-IN", "od": "od-IN", "or": "od-IN",
}


def normalize_sarvam_lang(lang: str) -> str:
    """Normalise any language tag to a Sarvam-supported BCP-47 code."""
    if not lang:
        return "en-IN"
    lang = lang.strip()
    if lang in SARVAM_SUPPORTED_LANGS:
        return lang
    if "-" in lang:
        base = lang.split("-")[0].lower()
        return _SARVAM_BASE_MAP.get(base, "en-IN")
    return _SARVAM_BASE_MAP.get(lang.lower(), "en-IN")


# ---------------------------------------------------------------------------
# Native tool handlers (Google Calendar / Sheets)
# ---------------------------------------------------------------------------
class NativeToolHandler:
    @staticmethod
    async def schedule_calendar_event(
        integration_token: str,
        calendar_id: str,
        summary: str,
        start_time: str,
        duration_mins: int = 30,
    ) -> str:
        try:
            from dateutil import parser as date_parser

            start = date_parser.parse(start_time)
            if start.tzinfo is None:
                start = start.replace(tzinfo=datetime.datetime.now().astimezone().tzinfo)

            start_utc = start.astimezone(datetime.timezone.utc)
            end_utc = start_utc + datetime.timedelta(minutes=duration_mins)

            payload = {
                "summary": summary,
                "start": {"dateTime": start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"), "timeZone": "UTC"},
                "end":   {"dateTime": end_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),   "timeZone": "UTC"},
            }
            url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers={"Authorization": f"Bearer {integration_token}"},
                    json=payload,
                ) as resp:
                    if resp.status < 300:
                        return f"Success: Event '{summary}' scheduled for {start_time}."
                    data = await resp.json()
                    return f"Failed: {data.get('error', {}).get('message', 'Unknown Error')}"
        except Exception as exc:
            return f"Scheduling Error: {exc}"

    @staticmethod
    async def append_to_sheet(
        integration_token: str,
        spreadsheet_id: str,
        range_name: str,
        values: List[Any],
    ) -> str:
        try:
            flat: List[str] = []
            if isinstance(values, dict):
                flat = [str(v).strip() for v in values.values()]
            elif isinstance(values, list):
                for item in values:
                    if isinstance(item, dict):
                        flat.extend(str(v).strip() for v in item.values())
                    elif isinstance(item, list):
                        flat.extend(str(v).strip() for v in item)
                    else:
                        flat.append(str(item).strip())
            else:
                flat = [str(values).strip()]

            encoded_range = urlparse.quote(range_name)
            url = (
                f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
                f"/values/{encoded_range}:append?valueInputOption=RAW"
            )
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers={"Authorization": f"Bearer {integration_token}"},
                    json={"values": [flat]},
                ) as resp:
                    if resp.status < 300:
                        return "Success: Data logged to spreadsheet."
                    try:
                        data = await resp.json()
                        msg = data.get("error", {}).get("message", "Unknown Error")
                    except Exception:
                        msg = await resp.text()
                    return f"Sheets Error (Status {resp.status}): {msg}"
        except Exception as exc:
            return f"Logging Error: {exc}"


# ---------------------------------------------------------------------------
# Dynamic webhook caller
# ---------------------------------------------------------------------------
async def _call_webhook(tool_cfg: Dict[str, Any], query: str) -> str:
    url = tool_cfg.get("url", "")
    method = tool_cfg.get("method", "POST").upper()
    config = tool_cfg.get("config", {})

    # Build payload
    payload: Any = {"query": query, **config}
    body_template = tool_cfg.get("body_template")
    if body_template:
        try:
            tmpl = body_template.replace("{{query}}", query).replace("{{input}}", query)
            for k, v in config.items():
                tmpl = tmpl.replace(f"{{{{{k}}}}}", str(v))
            payload = json.loads(tmpl)
        except Exception as exc:
            logger.warning(f"Body template parse failed for {url}: {exc}")

    # Headers + auth
    headers = {**tool_cfg.get("headers", {})}
    api_key = tool_cfg.get("apiKey")
    if api_key:
        if api_key.startswith("Bearer ") or len(api_key) > 40:
            headers["Authorization"] = api_key if api_key.startswith("Bearer ") else f"Bearer {api_key}"
        else:
            headers["X-API-Key"] = api_key

    # Query-string construction
    url_parts = list(urlparse.urlparse(url))
    qp = dict(urlparse.parse_qsl(url_parts[4]))
    if method == "GET" and not qp.get("q") and not qp.get("query"):
        qp["q"] = query
    url_parts[4] = urlencode(qp)
    final_url = urlparse.urlunparse(url_parts)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.request(
                method=method,
                url=final_url,
                headers=headers,
                json=payload if method != "GET" else None,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status >= 400:
                    return f"Error: tool returned status {resp.status}."
                try:
                    data = await resp.json()
                except Exception:
                    data = await resp.text()
                return str(data)[:1000]
    except Exception as exc:
        return f"Error: tool unreachable — {exc}"


# ---------------------------------------------------------------------------
# OpenRouter LLM — intercepts tool_choice="none" to avoid 404s
# ---------------------------------------------------------------------------
class OpenRouterLLM(openai.LLM):
    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool] | None = None,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[llm.ToolChoice] = NOT_GIVEN,
        extra_kwargs: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
    ) -> llm.LLMStream:
        # tool_choice="none" causes OpenRouter 404; clear tools instead
        if tool_choice == "none":
            logger.info("OpenRouterLLM: intercepting tool_choice='none', clearing tools.")
            tools = None
            tool_choice = NOT_GIVEN

        return super().chat(
            chat_ctx=chat_ctx,
            tools=tools,
            conn_options=conn_options,
            parallel_tool_calls=parallel_tool_calls,
            tool_choice=tool_choice,
            extra_kwargs=extra_kwargs,
        )


# ---------------------------------------------------------------------------
# VAD factory
# ---------------------------------------------------------------------------
def create_vad(config: Dict[str, Any], prewarmed_vad=None) -> agents_vad.VAD:
    """
    Returns a VAD instance.  Pass prewarmed_vad from proc.userdata when the
    settings are default so the expensive Silero load is skipped.
    """
    vad_cfg = config.get("vad", {})
    speech_dur  = vad_cfg.get("min_speech_duration",  0.3)
    silence_dur = vad_cfg.get("min_silence_duration", 0.8)
    threshold   = vad_cfg.get("activation_threshold", 0.5)

    defaults = (speech_dur == 0.3 and silence_dur == 0.8 and threshold == 0.5)
    if prewarmed_vad and defaults:
        logger.info("VAD: using prewarmed instance.")
        return prewarmed_vad

    logger.info(f"VAD: loading new instance ({speech_dur}/{silence_dur}/{threshold}).")
    return silero.VAD.load(
        min_speech_duration=speech_dur,
        min_silence_duration=silence_dur,
        activation_threshold=threshold,
    )


# ---------------------------------------------------------------------------
# Internal builders
# ---------------------------------------------------------------------------
def _build_stt(config: Dict[str, Any]) -> agents_stt.STT:
    lang     = config.get("language") or "en"
    provider = config.get("stt", {}).get("provider", "groq")
    api_key  = config.get("stt", {}).get("apiKey") or ""

    logger.info(f"[STT] provider={provider} lang={lang}")
    try:
        if provider == "sarvam" and sarvam is not None:
            norm = normalize_sarvam_lang(lang)
            return sarvam.STT(
                api_key=api_key or os.getenv("SARVAM_API_KEY"),
                model="saaras:v3",
                language=norm,
            )
        if provider == "deepgram":
            return deepgram.STT(
                api_key=api_key or os.getenv("DEEPGRAM_API_KEY"),
                language=lang,
            )
        # default: groq
        return groq.STT(
            api_key=api_key or os.getenv("GROQ_API_KEY"),
            model="whisper-large-v3",
            language=lang,
        )
    except Exception as exc:
        logger.error(f"[STT] init failed ({provider}): {exc} — falling back to groq")
        return groq.STT()


def _build_llm(config: Dict[str, Any]) -> llm.LLM:
    provider    = config.get("llm", {}).get("provider", "groq")
    model       = config.get("llm", {}).get("model", "")
    temperature = config.get("llm", {}).get("temperature", 0.7)
    api_key     = config.get("llm", {}).get("apiKey") or ""

    logger.info(f"[LLM] provider={provider} model={model}")
    try:
        if provider == "cerebras":
            return openai.LLM(
                api_key=api_key or os.getenv("CEREBRAS_API_KEY"),
                base_url="https://api.cerebras.ai/v1",
                model=model or "llama-3.3-70b",
                temperature=temperature,
            )
        if provider == "openai":
            return openai.LLM(
                api_key=api_key or os.getenv("OPENAI_API_KEY"),
                model=model or "gpt-4o-mini",
                temperature=temperature,
            )
        if provider == "openrouter":
            return OpenRouterLLM(
                api_key=api_key or os.getenv("OPENROUTER_API_KEY"),
                base_url="https://openrouter.ai/api/v1",
                model=model or "meta-llama/llama-3.3-70b-instruct",
                temperature=temperature,
                extra_headers={
                    "HTTP-Referer": "https://livekit.io",
                    "X-Title": "LiveKit Voice Agent",
                },
            )
        if provider == "gemini":
            return openai.LLM(
                api_key=api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"),
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                model=model or "gemini-2.5-flash",
                temperature=temperature,
            )
        if provider in ("together_ai", "together"):
            return openai.LLM(
                api_key=api_key or os.getenv("TOGETHER_API_KEY") or os.getenv("TOGETHER_AI_KEY"),
                base_url="https://api.together.xyz/v1",
                model=model or "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                temperature=temperature,
            )
        if provider == "deepseek":
            return openai.LLM(
                api_key=api_key or os.getenv("DEEPSEEK_API_KEY"),
                base_url="https://api.deepseek.com/v1",
                model=model or "deepseek-chat",
                temperature=temperature,
            )
        if provider == "anthropic":
            try:
                from livekit.plugins import anthropic as anthropic_plugin
                return anthropic_plugin.LLM(
                    api_key=api_key or os.getenv("ANTHROPIC_API_KEY"),
                    model=model or "claude-3-5-sonnet-latest",
                )
            except Exception as exc:
                logger.error(f"[LLM] Anthropic plugin failed: {exc}")
                return groq.LLM()
        # default: groq
        return groq.LLM(
            api_key=api_key or os.getenv("GROQ_API_KEY"),
            model=model or "llama-3.3-70b-versatile",
            temperature=temperature,
        )
    except Exception as exc:
        logger.error(f"[LLM] init failed ({provider}): {exc} — falling back to groq")
        return groq.LLM()


def _build_tts(config: Dict[str, Any], stt_lang: str) -> agents_tts.TTS:
    provider = config.get("tts", {}).get("provider", "sarvam")
    model    = config.get("tts", {}).get("model", "")
    voice    = config.get("tts", {}).get("voice", "")
    api_key  = config.get("tts", {}).get("apiKey") or ""

    logger.info(f"[TTS] provider={provider}")
    try:
        if provider == "openai":
            return openai.TTS(
                api_key=api_key or os.getenv("OPENAI_API_KEY"),
                model=model or "tts-1",
                voice=voice or "alloy",
            )
        if provider == "elevenlabs" and elevenlabs is not None:
            return elevenlabs.TTS(
                api_key=api_key or os.getenv("ELEVENLABS_API_KEY"),
                model=model or "eleven_monolingual_v1",
                voice_id=voice or "21m00Tcm4TlvDq8ikWAM",
            )
        if provider == "cartesia" and cartesia is not None:
            return cartesia.TTS(
                api_key=api_key or os.getenv("CARTESIA_API_KEY"),
                model=model or "sonic-english",
                voice=voice or "pf_rachel",
            )
        # default: Sarvam Bulbul
        if sarvam is None:
            raise ImportError("livekit-plugins-sarvam not installed")
        norm_lang = normalize_sarvam_lang(stt_lang)
        logger.info(f"[TTS] Sarvam lang: '{stt_lang}' → '{norm_lang}'")
        tts_instance = sarvam.TTS(
            api_key=api_key or os.getenv("SARVAM_API_KEY"),
            target_language_code=norm_lang,
            speaker=voice or "shubh",
            model="bulbul:v3",
        )
        # Patch stale WebSocket connection pool
        try:
            if hasattr(tts_instance, "_pool"):
                tts_instance._pool._max_session_duration = 45.0
                tts_instance._pool._mark_refreshed_on_get = True
        except Exception as patch_err:
            logger.warning(f"[TTS] Sarvam pool patch skipped: {patch_err}")
        return tts_instance
    except Exception as exc:
        logger.error(f"[TTS] init failed ({provider}): {exc} — falling back to openai tts-1")
        return openai.TTS(model="tts-1", voice="alloy")


def _build_tools(config: Dict[str, Any]) -> list[llm.FunctionTool]:
    """
    Converts the tools list from the dispatch metadata into a list of
    livekit FunctionTool objects, then appends the RAG search tool if an
    agent_id is present.
    """
    tools_cfg: List[Dict[str, Any]] = config.get("tools", [])
    agent_tools: list[llm.FunctionTool] = []

    # ── Dynamic tools from config ──────────────────────────────────────────
    for t_cfg in tools_cfg:
        if not isinstance(t_cfg, dict):
            logger.warning(f"[Tools] Skipping non-dict tool config: {t_cfg}")
            continue

        raw_type  = t_cfg.get("tool_type") or t_cfg.get("type", "WEBHOOK")
        tool_type = raw_type.upper()
        raw_name  = t_cfg.get("name", "unknown_tool")
        name      = raw_name.lower().replace(" ", "_")
        desc      = t_cfg.get("description", "").strip() or _default_desc(tool_type, name)

        if tool_type == "CALENDAR":
            tool = _make_calendar_tool(t_cfg, name, desc)
        elif tool_type == "SHEETS":
            tool = _make_sheets_tool(t_cfg, name, desc)
        else:
            # WEBHOOK / N8N / anything else
            tool = _make_webhook_tool(t_cfg, name, desc)

        agent_tools.append(tool)

    # ── RAG search tool ────────────────────────────────────────────────────
    agent_id = config.get("id") or config.get("agentId")
    if agent_id:
        rag_tool = _make_rag_tool(
            agent_id=agent_id,
            backend_url=os.getenv("INTERNAL_BACKEND_URL", "http://localhost:8000"),
        )
        agent_tools.append(rag_tool)
        logger.info(f"[RAG] registered rag_system tool for agent_id={agent_id}")

    logger.info(f"[Tools] total registered: {len(agent_tools)}")
    return agent_tools


# ---------------------------------------------------------------------------
# Tool builder helpers
# ---------------------------------------------------------------------------
def _default_desc(tool_type: str, name: str) -> str:
    if tool_type == "CALENDAR":
        return "Schedule meetings, appointments, or events on Google Calendar."
    if tool_type == "SHEETS":
        return "Log data, leads, or notes into a Google Sheets spreadsheet."
    return f"Execute action: {name}"


def _make_calendar_tool(t_cfg: Dict[str, Any], name: str, desc: str) -> llm.FunctionTool:
    calendar_id = t_cfg.get("config", {}).get("calendarId", "primary")
    token = t_cfg.get("apiKey", "")

    async def _fn(
        summary: Annotated[
            str,
            Field(description="Brief title of the meeting, e.g. 'Appointment: Manish with Dr. Vikas'"),
        ],
        start_time: Annotated[
            str,
            Field(description="ISO 8601 start datetime with UTC offset, e.g. '2026-06-03T14:30:00+05:30'"),
        ],
        duration_mins: Annotated[
            int,
            Field(description="Duration in minutes. Defaults to 30."),
        ] = 30,
    ) -> str:
        """Schedule a new meeting or appointment on Google Calendar."""
        logger.info(f"[CALENDAR] tool={name} summary={summary} start={start_time}")
        result = await NativeToolHandler.schedule_calendar_event(
            token, calendar_id, summary, start_time, duration_mins
        )
        logger.info(f"[CALENDAR] result={result}")
        return result

    _fn.__name__ = name
    return function_tool(_fn, name=name, description=desc)


def _make_sheets_tool(t_cfg: Dict[str, Any], name: str, desc: str) -> llm.FunctionTool:
    raw_id = t_cfg.get("config", {}).get("spreadsheetId", "")
    # Accept full URL or bare ID
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9\-_]+)", raw_id)
    sheet_id = match.group(1) if match else raw_id.strip()
    sheet_range = t_cfg.get("config", {}).get("range", "Sheet1!A1")
    token = t_cfg.get("apiKey", "")

    async def _fn(
        data_row: Annotated[
            Optional[List[str]],
            Field(description="Values to append, e.g. ['John Doe', 'john@example.com', 'Interested']"),
        ] = None,
        **kwargs: Any,
    ) -> str:
        """Log information or lead details to a Google Sheets row."""
        logger.info(f"[SHEETS] tool={name} data_row={data_row} kwargs={kwargs}")
        values: List[Any] = []
        if data_row:
            values.extend(data_row if isinstance(data_row, list) else [data_row])
        if kwargs:
            values.extend(kwargs.values())
        if not values:
            return "Failed: no data values provided."
        result = await NativeToolHandler.append_to_sheet(token, sheet_id, sheet_range, values)
        logger.info(f"[SHEETS] result={result}")
        return result

    _fn.__name__ = name
    return function_tool(_fn, name=name, description=desc)


def _make_webhook_tool(t_cfg: Dict[str, Any], name: str, desc: str) -> llm.FunctionTool:
    async def _fn(
        query: Annotated[str, Field(description="The search query or action command to send.")],
    ) -> str:
        """Send a query or command to an external service."""
        logger.info(f"[WEBHOOK] tool={name} query={query}")
        result = await _call_webhook(t_cfg, query)
        logger.info(f"[WEBHOOK] result={result[:200]}")
        return result

    _fn.__name__ = name
    return function_tool(_fn, name=name, description=desc)


def _make_rag_tool(agent_id: str, backend_url: str) -> llm.FunctionTool:
    async def rag_system(
        query: Annotated[
            str,
            Field(description="Specific question or topic to look up in the reference documents."),
        ],
    ) -> str:
        """Search uploaded PDF/text reference files or knowledge base for relevant information."""
        logger.info(f"[RAG] agent={agent_id} query={query!r}")
        try:
            url = (
                f"{backend_url}/api/v1/knowledge/search"
                f"?agent_id={agent_id}&query={urlparse.quote(query)}&limit=4"
            )
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=8)) as resp:
                    if resp.status != 200:
                        err = await resp.text()
                        return f"Search Error (Status {resp.status}): {err}"
                    data = await resp.json()
                    if not data:
                        return "No relevant information found in the knowledge base."
                    chunks = [
                        f"Source: {item.get('filename')}\n{item.get('text')}\n---"
                        for item in data
                    ]
                    text = "\n\n".join(chunks)
                    logger.info(f"[RAG] returning {len(data)} results ({len(text)} chars)")
                    return text
        except Exception as exc:
            logger.error(f"[RAG] exception: {exc}")
            return f"Search Error: {exc}"

    return function_tool(
        rag_system,
        name="rag_system",
        description=(
            "Search reference documents, guidelines, or uploaded PDFs in the knowledge base. "
            "Always call this before answering factual questions about services, pricing, or policies."
        ),
    )


# ---------------------------------------------------------------------------
# Instructions builder
# ---------------------------------------------------------------------------
def _build_instructions(config: Dict[str, Any], tools: list[llm.FunctionTool]) -> str:
    agent_name = config.get("agentName") or config.get("agent_name") or "VoiceForge"
    lang_code  = config.get("language") or "en"
    lang_name  = (
        "Hindi"   if lang_code.startswith("hi") else
        "Tamil"   if lang_code.startswith("ta") else
        "Telugu"  if lang_code.startswith("te") else
        "Bengali" if lang_code.startswith("bn") else
        "Kannada" if lang_code.startswith("kn") else
        "Malayalam" if lang_code.startswith("ml") else
        "Marathi" if lang_code.startswith("mr") else
        "Gujarati" if lang_code.startswith("gu") else
        "Punjabi" if lang_code.startswith("pa") else
        "English"
    )
    now = datetime.datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
    agent_id = config.get("id") or config.get("agentId")

    instructions = (
        f"Your name is {agent_name}. The current date and time is {now}.\n"
        f"{config.get('prompt', 'You are a helpful assistant.')}\n\n"
        f"CRITICAL: Always respond in {lang_name}. Do not switch languages unless explicitly asked."
    )

    # RAG instructions
    if agent_id:
        instructions += (
            "\n\n--- KNOWLEDGE BASE INSTRUCTIONS ---\n"
            "You have a `rag_system` tool connected to uploaded reference documents.\n"
            "1. ALWAYS call `rag_system` before answering ANY factual question about services, "
            "products, pricing, policies, or any topic the user asks about. Do NOT answer from memory first.\n"
            "2. If `rag_system` returns results, base your answer ONLY on those results.\n"
            "3. If `rag_system` returns nothing, say you don't have that information and ask the user to clarify.\n"
            "4. NEVER skip `rag_system` just because a question seems simple or general.\n"
            "5. Only skip `rag_system` for pure conversational exchanges like greetings or acknowledgments.\n"
            "6. NEVER say 'rag_system', 'function=', or any tool name out loud to the user."
        )

    # Tool instructions
    if tools:
        tool_names = [
            t.info.name if hasattr(t, "info") else getattr(t, "name", "unknown")
            for t in tools
        ]
        instructions += (
            "\n\n--- CAPABILITIES ---\n"
            f"You have direct access to these tools: {', '.join(tool_names)}.\n"
            "RULES:\n"
            "1. USE TOOLS: When the user asks for an action (schedule, log, search), "
            "call the relevant tool immediately — do not just talk about doing it. "
            "NEVER invoke tools on startup or in response to silence.\n"
            "2. LANGUAGE AGNOSTIC: Even if the user speaks in Hindi or another language, "
            "identify the intent and call English-named tools.\n"
            "3. DATA RETRIEVAL: Fetch real-time info via tools before answering. "
            "If a tool fails, explain clearly but remain professional.\n"
            "4. CALENDAR FORMAT: Provide `start_time` in strict ISO 8601 format "
            "(e.g., '2026-05-18T14:30:00+05:30'). Calculate dates from the current time above."
        )

    return instructions


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def create_agent(config: Dict[str, Any]) -> Agent:
    """
    Build and return a fully configured livekit.agents.Agent from the
    dispatch metadata blob.

    Usage in your worker entrypoint:

        async def entrypoint(ctx: JobContext):
            config  = json.loads(ctx.job.metadata)
            agent   = create_agent(config)
            session = AgentSession(vad=create_vad(config, ctx.proc.userdata.get("vad")))
            await session.start(ctx.room, agent=agent)

            first_msg = config.get("first_message", "")
            if first_msg:
                await session.generate_reply(instructions=first_msg)
    """
    stt_lang = config.get("language") or "en"

    stt_component  = _build_stt(config)
    llm_component  = _build_llm(config)
    tts_component  = _build_tts(config, stt_lang)
    tools          = _build_tools(config)
    instructions   = _build_instructions(config, tools)

    logger.info(
        f"[Factory] Agent built — "
        f"stt={type(stt_component).__name__} "
        f"llm={type(llm_component).__name__} "
        f"tts={type(tts_component).__name__} "
        f"tools={len(tools)}"
    )

    return Agent(
        instructions=instructions,
        stt=stt_component,
        llm=llm_component,
        tts=tts_component,
        tools=tools,
    )