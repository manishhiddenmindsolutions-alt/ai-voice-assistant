import os
import logging
import aiohttp
import json
import datetime
import urllib.parse as urlparse
from urllib.parse import urlencode
from typing import Dict, Any, List, Optional, Annotated
from pydantic import Field
from livekit.agents import llm
from livekit.plugins import sarvam, groq, openai, deepgram, silero
from livekit.agents.types import NOT_GIVEN, NotGivenOr, APIConnectOptions, DEFAULT_API_CONNECT_OPTIONS

try:
    from livekit.plugins import elevenlabs
except ImportError:
    elevenlabs = None

try:
    from livekit.plugins import cartesia
except ImportError:
    cartesia = None

logger = logging.getLogger("agent-factory")

# ---------------------------------------------------------------------------
# Sarvam language normalization
#
# Bulbul v3 supported languages (from official docs):
#   en-IN, hi-IN, bn-IN, ta-IN, te-IN, gu-IN, kn-IN,
#   ml-IN, mr-IN, pa-IN, od-IN
#
# Common problems this map solves:
#   - Bare ISO codes:   "en"    -> "en-IN"
#   - Wrong region:     "en-US" -> "en-IN"
#   - Odia alternate:   "or"    -> "od-IN"
# ---------------------------------------------------------------------------
SARVAM_SUPPORTED_LANGS = {
    "en-IN", "hi-IN", "bn-IN", "ta-IN", "te-IN",
    "gu-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "od-IN",
}

# Bare ISO-639-1 codes -> Sarvam BCP-47
SARVAM_LANG_MAP = {
    "en": "en-IN",
    "hi": "hi-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "pa": "pa-IN",
    "od": "od-IN",
    "or": "od-IN",   # alternate ISO code for Odia
}

# Non-IN region variants -> remap to IN (e.g. en-US, en-GB all -> en-IN)
SARVAM_REGION_REMAP = {
    "en": "en-IN",
    "hi": "hi-IN",
    "bn": "bn-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "pa": "pa-IN",
    "od": "od-IN",
    "or": "od-IN",
}

def normalize_sarvam_lang(lang: str) -> str:
    """
    Normalize any language code to a Sarvam-compatible BCP-47 code.

    Examples:
        "en"    -> "en-IN"   (bare ISO code)
        "en-US" -> "en-IN"   (wrong region remapped to IN)
        "en-GB" -> "en-IN"   (wrong region remapped to IN)
        "hi-IN" -> "hi-IN"   (already correct, passed through)
        "hi-IN" -> "hi-IN"
        ""      -> "en-IN"   (safe default)
        None    -> "en-IN"   (safe default)
    """
    if not lang:
        return "en-IN"

    lang = lang.strip()

    # Already a valid Sarvam code — pass through immediately
    if lang in SARVAM_SUPPORTED_LANGS:
        return lang

    # BCP-47 with wrong region (e.g. "en-US", "en-GB", "hi-PK")
    # -> extract base language and remap to -IN variant
    if "-" in lang:
        base = lang.split("-")[0].lower()
        remapped = SARVAM_REGION_REMAP.get(base)
        if remapped:
            return remapped
        # Unknown language entirely — fall back to English IN
        return "en-IN"

    # Bare ISO-639-1 code (e.g. "en", "hi")
    return SARVAM_LANG_MAP.get(lang.lower(), "en-IN")


class NativeToolHandler:
    """Handles logic for integrated Super-Tools (Calendar, Sheets, etc.)"""

    @staticmethod
    async def schedule_calendar_event(
        integration_token: str,
        calendar_id: str,
        summary: str,
        start_time: str,
        duration_mins: int = 30,
    ):
        """Creates an event in Google Calendar."""
        try:
            from dateutil import parser as date_parser

            start = date_parser.parse(start_time)
            if start.tzinfo is None:
                local_now = datetime.datetime.now().astimezone()
                start = start.replace(tzinfo=local_now.tzinfo)

            start_utc = start.astimezone(datetime.timezone.utc)
            end = start_utc + datetime.timedelta(minutes=duration_mins)
            logger.info(
                f"Scheduling event '{summary}' for {start_time}. "
                f"UTC: {start_utc.isoformat()}. End: {end.isoformat()}"
            )

            payload = {
                "summary": summary,
                "start": {
                    "dateTime": start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "timeZone": "UTC",
                },
                "end": {
                    "dateTime": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "timeZone": "UTC",
                },
            }
            logger.info(f"Token: {integration_token[:10]}...")
            logger.info(f"Calendar ID: {calendar_id}")
            logger.info(f"Summary: {summary}")
            logger.info(f"Start Time: {start_time}")
            logger.info(f"Duration: {duration_mins}")

            async with aiohttp.ClientSession() as session:
                url = (
                    f"https://www.googleapis.com/calendar/v3/calendars"
                    f"/{calendar_id}/events"
                )
                async with session.post(
                    url,
                    headers={"Authorization": f"Bearer {integration_token}"},
                    json=payload,
                ) as resp:
                    if resp.status < 300:
                        return f"Success: Event '{summary}' scheduled for {start_time}."
                    data = await resp.json()
                    return (
                        f"Failed to schedule: "
                        f"{data.get('error', {}).get('message', 'Unknown Error')}"
                    )
        except Exception as e:
            return f"Scheduling Error: {str(e)}"

    @staticmethod
    async def append_to_sheet(
        integration_token: str,
        spreadsheet_id: str,
        range_name: str,
        values: List[Any],
    ):
        """Appends a row to a Google Sheet."""
        try:
            flat_values = []
            if isinstance(values, dict):
                flat_values = list(values.values())
            elif isinstance(values, list):
                for item in values:
                    if isinstance(item, dict):
                        flat_values.extend(list(item.values()))
                    elif isinstance(item, list):
                        flat_values.extend(item)
                    else:
                        flat_values.append(item)
            else:
                flat_values = [values]

            flat_values = [str(v).strip() for v in flat_values]
            payload = {"values": [flat_values]}

            import urllib.parse
            encoded_range = urllib.parse.quote(range_name)
            url = (
                f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}"
                f"/values/{encoded_range}:append?valueInputOption=RAW"
            )

            logger.info(
                f"--- [FORGE DEBUG] Appending to sheet. URL: {url}, Payload: {payload}"
            )

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers={"Authorization": f"Bearer {integration_token}"},
                    json=payload,
                ) as resp:
                    if resp.status < 300:
                        return "Success: Data logged to spreadsheet."

                    try:
                        data = await resp.json()
                        error_msg = data.get("error", {}).get("message", "Unknown Error")
                    except Exception:
                        error_msg = await resp.text()

                    logger.error(
                        f"--- [FORGE ERROR] Google Sheets API responded with "
                        f"status {resp.status}: {error_msg}"
                    )
                    return f"Sheets Error (Status {resp.status}): {error_msg}"
        except Exception as e:
            logger.exception(f"--- [FORGE ERROR] Exception in append_to_sheet: {e}")
            return f"Logging Error: {str(e)}"


class DynamicTools:
    """Manages dynamic HTTP-based tools for the AI agent."""

    def __init__(self, tools_config: List[Dict[str, Any]]):
        self._tools = tools_config

    async def _call_webhook(self, tool_cfg: Dict[str, Any], query: str):
        url = tool_cfg.get("url")
        method = tool_cfg.get("method", "POST").upper()
        logger.info(f"--- [DIAGNOSTIC] Calling Neural Tool: {method} {url}")

        config = tool_cfg.get("config", {})
        payload = {"query": query, **config}

        body_template = tool_cfg.get("body_template")
        if body_template:
            try:
                temp_str = body_template
                temp_str = temp_str.replace("{{query}}", query)
                temp_str = temp_str.replace("{{input}}", query)
                for k, v in config.items():
                    temp_str = temp_str.replace(f"{{{{{k}}}}}", str(v))
                payload = json.loads(temp_str)
            except Exception as e:
                logger.warning(f"Failed to parse body template for {url}: {e}")

        all_headers = {**tool_cfg.get("headers", {})}
        api_key = tool_cfg.get("apiKey")
        if api_key:
            if api_key.startswith("Bearer ") or len(api_key) > 40:
                all_headers["Authorization"] = (
                    api_key if api_key.startswith("Bearer ") else f"Bearer {api_key}"
                )
            else:
                all_headers["X-API-Key"] = api_key

        try:
            url_parts = list(urlparse.urlparse(url))
            query_params = dict(urlparse.parse_qsl(url_parts[4]))

            if api_key and not any(
                k.lower() in ["authorization", "x-api-key"] for k in all_headers.keys()
            ):
                if "key" not in query_params and "apiKey" not in query_params:
                    query_params["key"] = api_key

            if method == "GET":
                if not query_params.get("q") and not query_params.get("query"):
                    query_params["q"] = query

            url_parts[4] = urlencode(query_params)
            final_url = urlparse.urlunparse(url_parts)

            async with aiohttp.ClientSession() as session:
                async with session.request(
                    method=method,
                    url=final_url,
                    headers=all_headers,
                    json=payload if method != "GET" else None,
                    timeout=8,
                ) as resp:
                    if resp.status >= 400:
                        return (
                            f"Error: The tool returned status {resp.status}. "
                            "Please inform the user."
                        )
                    try:
                        data = await resp.json()
                    except Exception:
                        data = await resp.text()
                    return str(data)[:1000]
        except Exception as e:
            logger.error(f"!!! [FORGE ERROR] Tool '{url}' is unreachable: {e}")
            return f"Error: Tool is currently unreachable. Reason: {str(e)}"


def create_vad(config: Dict[str, Any], prewarmed_vad=None):
    """Returns a VAD configuration based on user-defined sensitivity."""
    vad_cfg = config.get("vad", {})

    default_speech_dur = 0.3
    default_silence_dur = 0.8
    default_threshold = 0.5

    current_speech_dur = vad_cfg.get("min_speech_duration", 0.3)
    current_silence_dur = vad_cfg.get("min_silence_duration", 0.8)
    current_threshold = vad_cfg.get("activation_threshold", 0.5)

    if (
        prewarmed_vad
        and current_speech_dur == default_speech_dur
        and current_silence_dur == default_silence_dur
        and current_threshold == default_threshold
    ):
        logger.info("Using prewarmed VAD instance.")
        return prewarmed_vad

    logger.info(
        f"Initializing new VAD instance (non-default settings: "
        f"{current_speech_dur}/{current_silence_dur}/{current_threshold})."
    )
    return silero.VAD.load(
        min_speech_duration=current_speech_dur,
        min_silence_duration=current_silence_dur,
        activation_threshold=current_threshold,
    )


class OpenRouterLLM(openai.LLM):
    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: list[llm.Tool] | None = None,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[llm.ToolChoice] = NOT_GIVEN,
        response_format: NotGivenOr[Any] = NOT_GIVEN,
        extra_kwargs: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
    ) -> llm.LLMStream:

        tool_names = []
        if tools:
            for t in tools:
                if hasattr(t, "info") and hasattr(t.info, "name"):
                    tool_names.append(t.info.name)
        msg_count = len(chat_ctx.items) if chat_ctx else 0
        logger.info(
            f"OpenRouterLLM.chat: tool_choice={tool_choice!r}, "
            f"tools={tool_names}, msgs={msg_count}"
        )

        # Intercept tool_choice == "none" to prevent OpenRouter 404 errors.
        if tool_choice == "none":
            logger.info(
                "OpenRouterLLM: Intercepting tool_choice='none', "
                "clearing tools to avoid OpenRouter 404."
            )
            tools = None
            tool_choice = NOT_GIVEN

        return super().chat(
            chat_ctx=chat_ctx,
            tools=tools,
            conn_options=conn_options,
            parallel_tool_calls=parallel_tool_calls,
            tool_choice=tool_choice,
            response_format=response_format,
            extra_kwargs=extra_kwargs,
        )


def create_components(config: Dict[str, Any]):
    """Creates all AI components (STT, TTS, LLM) from configuration."""

    # ------------------------------------------------------------------
    # 1. STT (Groq, Sarvam, or Deepgram)
    # ------------------------------------------------------------------
    stt_lang = config.get("language") or "en"
    stt_provider = config.get("stt", {}).get("provider", "groq")
    try:
        logger.info(f"[INIT] STT Provider: {stt_provider}, Lang: {stt_lang}")
        if stt_provider == "sarvam":
            sarvam_stt_lang = normalize_sarvam_lang(stt_lang)
            logger.info(f"[INIT] Sarvam STT language resolved: '{stt_lang}' -> '{sarvam_stt_lang}'")
            stt = sarvam.STT(
                api_key=config.get("stt", {}).get("apiKey") or os.getenv("SARVAM_API_KEY"),
                model="saaras:v3",
                language=sarvam_stt_lang,
            )
        elif stt_provider == "deepgram":
            stt = deepgram.STT(
                api_key=config.get("stt", {}).get("apiKey") or os.getenv("DEEPGRAM_API_KEY"),
                language=stt_lang,
            )
        else:
            stt = groq.STT(
                api_key=config.get("stt", {}).get("apiKey") or os.getenv("GROQ_API_KEY"),
                model="whisper-large-v3",
                language=stt_lang,
            )
    except Exception as e:
        logger.error(f"[INIT] STT Initialization failed: {e}")
        stt = groq.STT()

    # ------------------------------------------------------------------
    # 2. LLM (Groq, Cerebras, OpenAI, OpenRouter, Gemini, etc.)
    # ------------------------------------------------------------------
    llm_provider = config.get("llm", {}).get("provider", "groq")
    try:
        logger.info(f"[INIT] LLM Provider: {llm_provider}")
        if llm_provider == "cerebras":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("CEREBRAS_API_KEY"),
                base_url="https://api.cerebras.ai/v1",
                model=config.get("llm", {}).get("model", "llama-3.3-70b"),
                temperature=config.get("llm", {}).get("temperature", 0.7),
            )
        elif llm_provider == "openai":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("OPENAI_API_KEY"),
                model=config.get("llm", {}).get("model", "gpt-4o-mini"),
                temperature=config.get("llm", {}).get("temperature", 0.7),
            )
        elif llm_provider == "openrouter":
            default_headers = {
                "HTTP-Referer": "https://livekit.io",
                "X-Title": "LiveKit Voice Agent",
            }
            agent_llm = OpenRouterLLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("OPENROUTER_API_KEY"),
                base_url="https://openrouter.ai/api/v1",
                model=config.get("llm", {}).get(
                    "model", "meta-llama/llama-3.3-70b-instruct"
                ),
                temperature=config.get("llm", {}).get("temperature", 0.7),
                extra_headers=default_headers,
            )
        elif llm_provider == "gemini":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey")
                or os.getenv("GOOGLE_API_KEY")
                or os.getenv("GEMINI_API_KEY"),
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                model=config.get("llm", {}).get("model", "gemini-2.5-flash"),
                temperature=config.get("llm", {}).get("temperature", 0.7),
            )
        elif llm_provider in ["together_ai", "together"]:
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey")
                or os.getenv("TOGETHER_API_KEY")
                or os.getenv("TOGETHER_AI_KEY"),
                base_url="https://api.together.xyz/v1",
                model=config.get("llm", {}).get(
                    "model", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
                ),
                temperature=config.get("llm", {}).get("temperature", 0.7),
            )
        elif llm_provider == "deepseek":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("DEEPSEEK_API_KEY"),
                base_url="https://api.deepseek.com/v1",
                model=config.get("llm", {}).get("model", "deepseek-chat"),
                temperature=config.get("llm", {}).get("temperature", 0.7),
            )
        elif llm_provider == "anthropic":
            try:
                from livekit.plugins import anthropic as anthropic_plugin

                agent_llm = anthropic_plugin.LLM(
                    api_key=config.get("llm", {}).get("apiKey")
                    or os.getenv("ANTHROPIC_API_KEY"),
                    model=config.get("llm", {}).get("model", "claude-3-5-sonnet-latest"),
                )
            except Exception as err:
                logger.error(f"Failed to load Anthropic plugin: {err}")
                agent_llm = groq.LLM()
        else:
            agent_llm = groq.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("GROQ_API_KEY"),
                model=config.get("llm", {}).get("model", "llama-3.3-70b-versatile"),
                temperature=config.get("llm", {}).get("temperature", 0.7),
            )
    except Exception as e:
        logger.error(f"[INIT] LLM Initialization failed for {llm_provider}: {e}")
        agent_llm = groq.LLM()

    # ------------------------------------------------------------------
    # 3. TTS (Sarvam Bulbul, OpenAI, ElevenLabs, or Cartesia)
    # ------------------------------------------------------------------
    tts_provider = config.get("tts", {}).get("provider", "sarvam")
    try:
        logger.info(f"[INIT] TTS Provider: {tts_provider}")
        if tts_provider == "openai":
            agent_tts = openai.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("OPENAI_API_KEY"),
                model=config.get("tts", {}).get("model", "tts-1"),
                voice=config.get("tts", {}).get("voice", "alloy"),
            )
        elif tts_provider == "elevenlabs" and elevenlabs is not None:
            agent_tts = elevenlabs.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("ELEVENLABS_API_KEY"),
                model=config.get("tts", {}).get("model", "eleven_monolingual_v1"),
                voice_id=config.get("tts", {}).get("voice", "21m00Tcm4TlvDq8ikWAM"),
            )
        elif tts_provider == "cartesia" and cartesia is not None:
            agent_tts = cartesia.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("CARTESIA_API_KEY"),
                model=config.get("tts", {}).get("model", "sonic-english"),
                voice=config.get("tts", {}).get("voice", "pf_rachel"),
            )
        else:
            # ---------------------------------------------------------------
            # Sarvam TTS — FIX: normalize language code to BCP-47 format.
            # A bare "en" or "hi" causes a 422 from the Sarvam WebSocket API.
            # ---------------------------------------------------------------
            sarvam_lang = normalize_sarvam_lang(stt_lang)
            logger.info(
                f"[INIT] Sarvam TTS language resolved: '{stt_lang}' -> '{sarvam_lang}'"
            )
            agent_tts = sarvam.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("SARVAM_API_KEY"),
                target_language_code=sarvam_lang,
                speaker=config.get("tts", {}).get("voice", "shubh"),
                model="bulbul:v3",
            )
            # Patch stale connection pool issue for Sarvam WebSocket
            try:
                if hasattr(agent_tts, "_pool"):
                    agent_tts._pool._max_session_duration = 45.0
                    agent_tts._pool._mark_refreshed_on_get = True
                    logger.info(
                        "Successfully patched Sarvam TTS connection pool "
                        "to prevent stale sessions."
                    )
            except Exception as patch_err:
                logger.warning(
                    f"Could not patch Sarvam TTS connection pool: {patch_err}"
                )
    except Exception as e:
        logger.error(
            f"TTS Initialization failed: {e}. Falling back to stable OpenAI TTS."
        )
        agent_tts = openai.TTS(model="tts-1", voice="alloy")

    # ------------------------------------------------------------------
    # 4. TOOLS (Neural Forge Fulfillment)
    # ------------------------------------------------------------------
    agent_tools = []
    tools_cfg = config.get("tools", [])
    logger.info(f"--- [FORGE TOOL DIAG] Raw tools_cfg count: {len(tools_cfg)}")
    for i, tc in enumerate(tools_cfg):
        if isinstance(tc, dict):
            logger.info(
                f"--- [FORGE TOOL DIAG] Tool[{i}]: name={tc.get('name','?')}, "
                f"type={tc.get('tool_type', tc.get('type','?'))}, "
                f"has_apiKey={bool(tc.get('apiKey'))}, "
                f"config={tc.get('config',{})}"
            )
        else:
            logger.info(
                f"--- [FORGE TOOL DIAG] Tool[{i}]: RAW_VALUE (not dict) = {tc}"
            )
    dt = DynamicTools(tools_cfg)

    for t_cfg in tools_cfg:
        if not isinstance(t_cfg, dict):
            logger.warning(
                f"Skipping invalid tool configuration (not a dict): {t_cfg}"
            )
            continue

        tool_type = t_cfg.get("tool_type") or t_cfg.get("type", "WEBHOOK")
        tool_type = tool_type.upper()

        raw_name = t_cfg.get("name", "UnknownTool")
        name = raw_name.lower().replace(" ", "_")

        desc = t_cfg.get("description", "")
        if not desc or desc.strip() == "":
            if tool_type == "CALENDAR":
                desc = "Schedule meetings, appointments, or book events on Google Calendar."
            elif tool_type == "SHEETS":
                desc = "Log details, leads, or records directly into Google Sheets."
            else:
                desc = f"Execute action: {name}"

        if tool_type == "CALENDAR":
            calendar_id = t_cfg.get("config", {}).get("calendarId", "primary")
            token = t_cfg.get("apiKey")

            def create_calendar_cmd(cid, tk, n):
                async def calendar_fn(
                    summary: Annotated[
                        str,
                        Field(
                            description=(
                                "Brief title/summary of the meeting or appointment, "
                                "e.g., 'Appointment: Manish with Dr. Vikas'"
                            )
                        ),
                    ],
                    start_time: Annotated[
                        str,
                        Field(
                            description=(
                                "The starting date and time of the appointment in strict "
                                "ISO 8601 format, e.g., '2026-06-03T14:30:00+05:30' "
                                "(UTC/Offset mandatory). Calculate offset from current time."
                            )
                        ),
                    ],
                    duration_mins: Annotated[
                        int,
                        Field(
                            description="Duration of the appointment in minutes. Defaults to 30."
                        ),
                    ] = 30,
                ):
                    """Schedule a new meeting or event."""
                    logger.info(
                        f"--- [FORGE DEBUG] Agent executing CALENDAR tool: {n} "
                        f"(Summary: {summary}, Start: {start_time})"
                    )
                    res = await NativeToolHandler.schedule_calendar_event(
                        tk, cid, summary, start_time, duration_mins
                    )
                    logger.info(f"--- [FORGE DEBUG] CALENDAR result: {res}")
                    return res

                calendar_fn.__name__ = n
                return calendar_fn

            tool = llm.function_tool(
                create_calendar_cmd(calendar_id, token, name),
                name=name,
                description=desc,
            )

        elif tool_type == "SHEETS":
            raw_sheet_id = t_cfg.get("config", {}).get("spreadsheetId")
            sheet_id = raw_sheet_id.strip() if raw_sheet_id else ""
            if "spreadsheets/d/" in sheet_id:
                import re

                match = re.search(r"/spreadsheets/d/([a-zA-Z0-9\-_]+)", sheet_id)
                if match:
                    sheet_id = match.group(1)
            sheet_range = t_cfg.get("config", {}).get("range", "Sheet1!A1")
            token = t_cfg.get("apiKey")

            def create_sheet_cmd(sid, sr, tk, n):
                async def sheet_fn(
                    data_row: Annotated[
                        Optional[List[str]],
                        Field(
                            description=(
                                "A list of values to append to the spreadsheet row. "
                                "Example: ['John Doe', 'john@example.com', 'Interested']"
                            )
                        ),
                    ] = None,
                    **kwargs: Any,
                ):
                    """Log information, lead details, or conversation notes to a spreadsheet row.
                    You can pass a list of values in 'data_row', or pass key-value pairs
                    representing columns (e.g. name='John', email='john@example.com').
                    """
                    logger.info(
                        f"--- [FORGE DEBUG] Agent executing SHEETS tool: {n} "
                        f"(Data: {data_row}, Kwargs: {kwargs})"
                    )
                    values_to_log = []
                    if data_row:
                        if isinstance(data_row, list):
                            values_to_log.extend(data_row)
                        else:
                            values_to_log.append(data_row)
                    if kwargs:
                        values_to_log.extend(list(kwargs.values()))
                    if not values_to_log:
                        return "Failed: No data values were provided to log to the spreadsheet."
                    res = await NativeToolHandler.append_to_sheet(tk, sid, sr, values_to_log)
                    logger.info(f"--- [FORGE DEBUG] SHEETS result: {res}")
                    return res

                sheet_fn.__name__ = n
                return sheet_fn

            tool = llm.function_tool(
                create_sheet_cmd(sheet_id, sheet_range, token, name),
                name=name,
                description=desc,
            )

        elif tool_type == "N8N":
            def create_n8n_cmd(cfg, n):
                async def n8n_fn(query: str):
                    """Orchestrate a multi-service workflow via n8n bridge."""
                    logger.info(
                        f"--- [FORGE DEBUG] Agent executing N8N tool: {n} (Query: {query})"
                    )
                    res = await dt._call_webhook(cfg, query)
                    logger.info(f"--- [FORGE DEBUG] N8N result: {res[:200]}...")
                    return res

                n8n_fn.__name__ = n
                return n8n_fn

            tool = llm.function_tool(
                create_n8n_cmd(t_cfg, name), name=name, description=desc
            )

        else:  # DEFAULT: WEBHOOK
            def create_webhook_cmd(cfg, n):
                async def tool_fn(query: str):
                    """Pass a search query or a specific action command to this tool."""
                    logger.info(
                        f"--- [FORGE DEBUG] Agent executing WEBHOOK tool: {n} (Query: {query})"
                    )
                    res = await dt._call_webhook(cfg, query)
                    logger.info(f"--- [FORGE DEBUG] WEBHOOK result: {res[:200]}...")
                    return res

                tool_fn.__name__ = n
                return tool_fn

            tool = llm.function_tool(
                create_webhook_cmd(t_cfg, name), name=name, description=desc
            )

        agent_tools.append(tool)

    # ------------------------------------------------------------------
    # 4.5. KNOWLEDGE BASE RAG SYSTEM
    # ------------------------------------------------------------------
    agent_id = config.get("id") or config.get("agentId")
    if agent_id:
        backend_url = os.getenv("INTERNAL_BACKEND_URL", "http://localhost:8000")

        def create_search_knowledge_cmd(aid, b_url):
            async def rag_system(
                query: Annotated[
                    str,
                    Field(
                        description=(
                            "The specific question, topic, or search term to lookup "
                            "in the reference documents or PDF knowledge base."
                        )
                    ),
                ]
            ) -> str:
                """Search the agent's uploaded PDF/text reference files or knowledge base
                for relevant facts, policies, guidelines, or instructions."""
                logger.info(
                    f"--- [RAG SEARCH] Querying knowledge base for agent {aid}: '{query}' ---"
                )
                try:
                    url = (
                        f"{b_url}/api/v1/knowledge/search"
                        f"?agent_id={aid}&query={urlparse.quote(query)}&limit=4"
                    )
                    async with aiohttp.ClientSession() as session:
                        async with session.get(url, timeout=8) as resp:
                            if resp.status == 200:
                                data = await resp.json()
                                if not data:
                                    logger.info(
                                        f"--- [RAG RESULT] Empty list returned for "
                                        f"agent {aid} query '{query}' ---"
                                    )
                                    return "No relevant information found in the knowledge base."
                                formatted_results = []
                                for item in data:
                                    formatted_results.append(
                                        f"Source document: {item.get('filename')}\n"
                                        f"Content excerpt:\n{item.get('text')}\n---"
                                    )
                                result_text = "\n\n".join(formatted_results)
                                logger.info(
                                    f"--- [RAG RESULT] Returning {len(data)} results "
                                    f"({len(result_text)} chars) to LLM ---"
                                )
                                return result_text
                            else:
                                err_text = await resp.text()
                                logger.warning(
                                    f"--- [RAG ERROR] API call returned non-200 status "
                                    f"{resp.status}: {err_text} ---"
                                )
                                return f"Search Error (Status {resp.status}): {err_text}"
                except Exception as e:
                    logger.error(
                        f"--- [RAG EXCEPTION] Failed to query knowledge base: {e} ---"
                    )
                    return f"Search Error: {str(e)}"

            return rag_system

        knowledge_tool = llm.function_tool(
            create_search_knowledge_cmd(agent_id, backend_url),
            name="rag_system",
            description=(
                "Use this tool to search through reference documents, guidelines, "
                "health manuals, or text/PDF files uploaded to your knowledge base."
            ),
        )
        agent_tools.append(knowledge_tool)
        logger.info(
            f"--- [RAG SYSTEM] Registered 'rag_system' tool for agent_id: {agent_id} ---"
        )

    # ------------------------------------------------------------------
    # 5. INSTRUCTIONS
    # ------------------------------------------------------------------
    agent_name = config.get("agentName") or config.get("agent_name") or "VoiceForge"
    lang_name = (
        "Hindi"
        if stt_lang == "hi-IN"
        else "English"
        if stt_lang.startswith("en")
        else stt_lang
    )

    current_time = datetime.datetime.now().astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")

    base_instructions = (
        f"Your name is {agent_name}. The current date and time is {current_time}. "
        f"{config.get('prompt', 'You are a helpful assistant.')}"
    )
    base_instructions += (
        f"\n\nCRITICAL: You MUST respond in {lang_name} at all times. "
        "Do not switch to others unless explicitly asked."
    )

    if agent_id:
        base_instructions += "\n\n--- KNOWLEDGE BASE REFERENCE INSTRUCTIONS ---\n"
        base_instructions += (
            "You have access to a reference knowledge base containing PDF and text "
            "reference documents. Whenever the user asks questions about specific products, "
            "guides, terms, health advice, or details contained in your uploaded documents, "
            "you MUST use the `rag_system` tool to look up the relevant information before "
            "answering. Do not speculate or guess if you do not know the answer—search the "
            "knowledge base first."
        )
        base_instructions += (
            "\nOnly call `rag_system` when the user asks a specific factual question "
            "that would be answered by reference documents. Do NOT call it for general "
            "conversation, greetings, or short unclear inputs."
        )
        base_instructions += (
            "\nNEVER mention tool names, function names, or internal system details "
            "in your spoken responses. Do not say 'rag_system', 'function=', or any "
            "technical tool reference out loud to the user."
        )

    if agent_tools:
        tool_names = []
        for t in agent_tools:
            if hasattr(t, "info") and hasattr(t.info, "name"):
                tool_names.append(t.info.name)
            elif hasattr(t, "name"):
                tool_names.append(t.name)
            elif isinstance(t, dict):
                tool_names.append(t.get("name", "UnknownTool"))

        base_instructions += "\n\n--- NEURAL FORGE CAPABILITIES ---\n"
        base_instructions += (
            f"You have reached the Forge. You have DIRECT ACCESS to the following "
            f"neural tools: {', '.join(tool_names)}.\n"
        )
        base_instructions += "CRITICAL INSTRUCTIONS:\n"
        base_instructions += (
            "1. USE PROVIDED TOOLS: You MUST use the tools which are provided to you to "
            "answer the user's requests. If the user asks for ANY action (like scheduling, "
            "logging, or searching), you MUST execute the relevant tool IMMEDIATELY. Do not "
            "just talk about doing it—DO IT. NEVER proactively schedule meetings or invoke "
            "tools on startup or in response to empty turns or silence.\n"
        )
        base_instructions += (
            "2. LANGUAGE AGNOSTIC: Even if the user speaks in Hindi, you must identify "
            "the intent and call the English-named tools.\n"
        )
        base_instructions += (
            "3. DATA RETRIEVAL: Use tools to fetch real-time info before answering. "
            "If a tool fails, explain why clearly but remain professional.\n"
        )   
        base_instructions += (
            "4. CALENDAR FORMATTING: If scheduling an event, you MUST provide `start_time` "
            "in strict ISO 8601 format (e.g., '2026-05-18T14:30:00Z'). Calculate dates "
            "accurately based on the current date provided above."
        )

    logger.info(
        f"--- [FORGE TOOL DIAG] Final registered agent_tools count: {len(agent_tools)}. "
        f"Tool instructions appended: {bool(agent_tools)}"
    )

    return {
        "stt": stt,
        "llm": agent_llm,
        "tts": agent_tts,
        "tools": agent_tools,
        "instructions": base_instructions,
    }