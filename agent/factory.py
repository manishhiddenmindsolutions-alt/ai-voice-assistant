import os
import logging
import aiohttp
import json
import datetime
import urllib.parse as urlparse
from urllib.parse import urlencode
from typing import Dict, Any, List, Optional, Annotated
from livekit.agents import llm
from livekit.plugins import sarvam, groq, openai, deepgram, silero

try:
    from livekit.plugins import elevenlabs
except ImportError:
    elevenlabs = None

try:
    from livekit.plugins import cartesia
except ImportError:
    cartesia = None

logger = logging.getLogger("agent-factory")

class NativeToolHandler:
    """Handles logic for integrated Super-Tools (Calendar, Sheets, etc.)"""
    
    @staticmethod
    async def schedule_calendar_event(integration_token: str, calendar_id: str, summary: str, start_time: str, duration_mins: int = 30):
        """Creates an event in Google Calendar."""
        try:
            from dateutil import parser as date_parser
            start = date_parser.parse(start_time)
            if start.tzinfo is None:
                local_tz = datetime.datetime.now().astimezone().tzinfo
                start = start.replace(tzinfo=local_tz)
            end = start + datetime.timedelta(minutes=duration_mins)
            logger.info(f"Scheduling event '{summary}' for {start_time}. End: {end}")   
            
            payload = {
                "summary": summary,
                "start": {"dateTime": start.isoformat()},
                "end": {"dateTime": end.isoformat()}
            }
            logger.info(f"Token: {integration_token}")
            logger.info(f"Calendar ID: {calendar_id}")
            logger.info(f"Summary: {summary}")
            logger.info(f"Start Time: {start_time}")
            logger.info(f"Duration: {duration_mins}")
            
            async with aiohttp.ClientSession() as session:
                url = f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
                async with session.post(
                    url, 
                    headers={"Authorization": f"Bearer {integration_token}"},
                    json=payload
                ) as resp:
                    if resp.status < 300:
                        return f"Success: Event '{summary}' scheduled for {start_time}."
                    data = await resp.json()
                    return f"Failed to schedule: {data.get('error', {}).get('message', 'Unknown Error')}"
        except Exception as e:
            return f"Scheduling Error: {str(e)}"

    @staticmethod
    async def append_to_sheet(integration_token: str, spreadsheet_id: str, range_name: str, values: List[Any]):
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

            payload = {"values": [flat_values]}
            url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}:append?valueInputOption=RAW"
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers={"Authorization": f"Bearer {integration_token}"},
                    json=payload
                ) as resp:
                    if resp.status < 300:
                        return "Success: Data logged to spreadsheet."
                    data = await resp.json()
                    return f"Sheets Error: {data.get('error', {}).get('message', 'Unknown Error')}"
        except Exception as e:
            return f"Logging Error: {str(e)}"

class DynamicTools:
    """Manages dynamic HTTP-based tools for the AI agent."""
    def __init__(self, tools_config: List[Dict[str, Any]]):
        self._tools = tools_config

    async def _call_webhook(self, tool_cfg: Dict[str, Any], query: str):
        url = tool_cfg.get("url")
        method = tool_cfg.get("method", "POST").upper()
        logger.info(f"--- [DIAGNOSTIC] Calling Neural Tool: {method} {url}")
        
        # Build payload: Merge AI query with User Config (n8n orchestration logic)
        config = tool_cfg.get("config", {})
        payload = {"query": query, **config}
        
        body_template = tool_cfg.get("body_template")
        if body_template:
            try:
                temp_str = body_template
                # Support placeholder injection
                temp_str = temp_str.replace("{{query}}", query)
                temp_str = temp_str.replace("{{input}}", query)
                
                # Dynamic config injection into template
                for k, v in config.items():
                    temp_str = temp_str.replace(f"{{{{{k}}}}}", str(v))
                
                payload = json.loads(temp_str)
            except Exception as e:
                logger.warning(f"Failed to parse body template for {url}: {e}")

        # Prepare headers
        all_headers = {**tool_cfg.get("headers", {})}
        api_key = tool_cfg.get("apiKey")
        if api_key:
            if api_key.startswith("Bearer ") or len(api_key) > 40:
                all_headers["Authorization"] = api_key if api_key.startswith("Bearer ") else f"Bearer {api_key}"
            else:
                all_headers["X-API-Key"] = api_key
        
        try:
            # SMART URL DECONSTRUCTION
            url_parts = list(urlparse.urlparse(url))
            query_params = dict(urlparse.parse_qsl(url_parts[4]))
            
            # Merge Auth into query for common REST APIs if not explicitly in headers
            if api_key and not any(k.lower() in ["authorization", "x-api-key"] for k in all_headers.keys()):
                if "key" not in query_params and "apiKey" not in query_params:
                   query_params["key"] = api_key 
            
            # Merge dynamic query for GET requests
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
                    timeout=8 
                ) as resp:
                    if resp.status >= 400:
                        return f"Error: The tool returned status {resp.status}. Please inform the user."
                    
                    data = await resp.json() if "application/json" in resp.headers.get("Content-Type", "") else await resp.text()
                    # Flatten it for the LLM to read easily
                    return str(data)[:1000] # Cap the response size
        except Exception as e:
            logger.error(f"!!! [FORGE ERROR] Tool '{url}' is unreachable: {e}")
            return f"Error: Tool is currently unreachable. Reason: {str(e)}"

def create_vad(config: Dict[str, Any], prewarmed_vad=None):
    """Returns a VAD configuration based on user-defined sensitivity."""
    vad_cfg = config.get("vad", {})
    
    # Defaults used in prewarming (Must match agent/main.py and CreateAgentPage.tsx)
    default_speech_dur = 0.3
    default_silence_dur = 0.8
    default_threshold = 0.5
    
    current_speech_dur = vad_cfg.get("min_speech_duration", 0.3)
    current_silence_dur = vad_cfg.get("min_silence_duration", 0.8)
    current_threshold = vad_cfg.get("activation_threshold", 0.5)
    
    # Reuse prewarmed instance if settings match defaults
    if (prewarmed_vad and 
        current_speech_dur == default_speech_dur and 
        current_silence_dur == default_silence_dur and 
        current_threshold == default_threshold):
        logger.info("Using prewarmed VAD instance.")
        return prewarmed_vad

    logger.info(f"Initializing new VAD instance (non-default settings: {current_speech_dur}/{current_silence_dur}/{current_threshold}).")
    return silero.VAD.load(
        min_speech_duration=current_speech_dur,
        min_silence_duration=current_silence_dur,
        activation_threshold=current_threshold
    )

def create_components(config: Dict[str, Any]):
    """Creates all AI components (STT, TTS, LLM) from configuration."""
    
    # 1. STT (Groq, Sarvam, or Deepgram)
    stt_lang = config.get("language") or "en"
    stt_provider = config.get("stt", {}).get("provider", "groq")
    try:
        logger.info(f"⚡ [INIT] STT Provider: {stt_provider}, Lang: {stt_lang}")
        if stt_provider == "sarvam":
            stt = sarvam.STT(
                api_key=config.get("stt", {}).get("apiKey") or os.getenv("SARVAM_API_KEY"),
                model="saaras:v3",
                language=stt_lang
            )
        elif stt_provider == "deepgram":
            stt = deepgram.STT(
                api_key=config.get("stt", {}).get("apiKey") or os.getenv("DEEPGRAM_API_KEY"),
                language=stt_lang
            )
        else:
            stt = groq.STT(
                api_key=config.get("stt", {}).get("apiKey") or os.getenv("GROQ_API_KEY"),
                model="whisper-large-v3",
                language=stt_lang
            )
    except Exception as e:
        logger.error(f"❌ [INIT] STT Initialization failed: {e}")
        stt = groq.STT()


    # 2. LLM (Groq, Cerebras, or OpenAI)
    llm_provider = config.get("llm", {}).get("provider", "groq")
    try:
        logger.info(f"⚡ [INIT] LLM Provider: {llm_provider}")
        if llm_provider == "cerebras":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("CEREBRAS_API_KEY"),
                base_url="https://api.cerebras.ai/v1",
                model=config.get("llm", {}).get("model", "llama-3.3-70b"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
        elif llm_provider == "openai":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("OPENAI_API_KEY"),
                model=config.get("llm", {}).get("model", "gpt-4o-mini"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
        elif llm_provider == "openrouter":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("OPENROUTER_API_KEY"),
                base_url="https://openrouter.ai/api/v1",
                model=config.get("llm", {}).get("model", "meta-llama/llama-3.3-70b-instruct"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
        elif llm_provider == "gemini":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"),
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                model=config.get("llm", {}).get("model", "gemini-2.5-flash"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
        elif llm_provider in ["together_ai", "together"]:
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("TOGETHER_API_KEY") or os.getenv("TOGETHER_AI_KEY"),
                base_url="https://api.together.xyz/v1",
                model=config.get("llm", {}).get("model", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
        elif llm_provider == "deepseek":
            agent_llm = openai.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("DEEPSEEK_API_KEY"),
                base_url="https://api.deepseek.com/v1",
                model=config.get("llm", {}).get("model", "deepseek-chat"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
        elif llm_provider == "anthropic":
            try:
                from livekit.plugins import anthropic
                agent_llm = anthropic.LLM(
                    api_key=config.get("llm", {}).get("apiKey") or os.getenv("ANTHROPIC_API_KEY"),
                    model=config.get("llm", {}).get("model", "claude-3-5-sonnet-latest")
                )
            except Exception as err:
                logger.error(f"Failed to load Anthropic plugin: {err}")
                agent_llm = groq.LLM()
        else:
            agent_llm = groq.LLM(
                api_key=config.get("llm", {}).get("apiKey") or os.getenv("GROQ_API_KEY"),
                model=config.get("llm", {}).get("model", "llama-3.3-70b-versatile"),
                temperature=config.get("llm", {}).get("temperature", 0.7)
            )
    except Exception as e:
        logger.error(f"❌ [INIT] LLM Initialization failed for {llm_provider}: {e}")
        agent_llm = groq.LLM()

    # 3. TTS (Sarvam Bulbul or OpenAI TTS)
    tts_provider = config.get("tts", {}).get("provider", "sarvam")
    try:
        logger.info(f"⚡ [INIT] TTS Provider: {tts_provider}")
        if tts_provider == "openai":
            agent_tts = openai.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("OPENAI_API_KEY"),
                model=config.get("tts", {}).get("model", "tts-1"),
                voice=config.get("tts", {}).get("voice", "alloy")
            )
        elif tts_provider == "elevenlabs" and elevenlabs is not None:
            agent_tts = elevenlabs.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("ELEVENLABS_API_KEY"),
                model=config.get("tts", {}).get("model", "eleven_monolingual_v1"),
                voice_id=config.get("tts", {}).get("voice", "21m00Tcm4TlvDq8ikWAM")
            )
        elif tts_provider == "cartesia" and cartesia is not None:
            agent_tts = cartesia.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("CARTESIA_API_KEY"),
                model=config.get("tts", {}).get("model", "sonic-english"),
                voice=config.get("tts", {}).get("voice", "pf_rachel")
            )
        else:
            agent_tts = sarvam.TTS(
                api_key=config.get("tts", {}).get("apiKey") or os.getenv("SARVAM_API_KEY"),
                target_language_code=stt_lang, # Use the agent's configured language
                speaker=config.get("tts", {}).get("voice", "shubh"),
                model="bulbul:v3",
            )
    except Exception as e:
        logger.error(f"TTS Initialization failed: {e}. Falling back to stable OpenAI TTS.")
        agent_tts = openai.TTS(model="tts-1", voice="alloy")

    # 4. TOOLS (CRITICAL: Neural Forge Fulfillment)
    agent_tools = []
    tools_cfg = config.get("tools", [])
    dt = DynamicTools(tools_cfg)
    
    for t_cfg in tools_cfg:
        if not isinstance(t_cfg, dict):
            logger.warning(f"Skipping invalid tool configuration (not a dict): {t_cfg}")
            continue
            
        # Resilient tool type checking (supports both tool_type and type fields)
        tool_type = t_cfg.get("tool_type") or t_cfg.get("type", "WEBHOOK")
        tool_type = tool_type.upper()
        
        # SANITIZE NAME: Llama 3 prefers snake_case for tool names
        raw_name = t_cfg.get("name", "UnknownTool")
        name = raw_name.lower().replace(" ", "_")
        
        desc = t_cfg.get("description", f"Action: {name}")
        
        if tool_type == "CALENDAR":
            calendar_id = t_cfg.get("config", {}).get("calendarId", "primary")
            token = t_cfg.get("apiKey")
            
            def create_calendar_cmd(cid, tk, n):
                async def calendar_fn(summary: str, start_time: str, duration_mins: int = 30):
                    """Schedule a new meeting or event."""
                    logger.info(f"--- [FORGE DEBUG] Agent executing CALENDAR tool: {n} (Summary: {summary}, Start: {start_time})")
                    res = await NativeToolHandler.schedule_calendar_event(tk, cid, summary, start_time, duration_mins)
                    logger.info(f"--- [FORGE DEBUG] CALENDAR result: {res}")
                    return res
                calendar_fn.__name__ = n
                return calendar_fn
            
            tool = llm.function_tool(create_calendar_cmd(calendar_id, token, name), name=name, description=desc)
            
        elif tool_type == "SHEETS":
            raw_sheet_id = t_cfg.get("config", {}).get("spreadsheetId")
            sheet_id = raw_sheet_id
            if raw_sheet_id:
                import re
                match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", raw_sheet_id)
                if match:
                    sheet_id = match.group(1)
            sheet_range = t_cfg.get("config", {}).get("range", "Sheet1!A1")
            token = t_cfg.get("apiKey")

            def create_sheet_cmd(sid, sr, tk, n):
                async def sheet_fn(data_row: List[Any]):
                    """Log information to a spreadsheet row."""
                    logger.info(f"--- [FORGE DEBUG] Agent executing SHEETS tool: {n} (Data: {data_row})")
                    res = await NativeToolHandler.append_to_sheet(tk, sid, sr, data_row)
                    logger.info(f"--- [FORGE DEBUG] SHEETS result: {res}")
                    return res
                sheet_fn.__name__ = n
                return sheet_fn

            tool = llm.function_tool(create_sheet_cmd(sheet_id, sheet_range, token, name), name=name, description=desc)

        elif tool_type == "N8N":
            def create_n8n_cmd(cfg, n):
                async def n8n_fn(query: str):
                    """Orchestrate a multi-service workflow via n8n bridge."""
                    logger.info(f"--- [FORGE DEBUG] Agent executing N8N tool: {n} (Query: {query})")
                    res = await dt._call_webhook(cfg, query)
                    logger.info(f"--- [FORGE DEBUG] N8N result: {res[:200]}...")
                    return res
                n8n_fn.__name__ = n
                return n8n_fn
            
            tool = llm.function_tool(create_n8n_cmd(t_cfg, name), name=name, description=desc)
        
        else: # DEFAULT: WEBHOOK
            def create_webhook_cmd(cfg, n):
                async def tool_fn(query: str):
                    """Pass a search query or a specific action command to this tool."""
                    logger.info(f"--- [FORGE DEBUG] Agent executing WEBHOOK tool: {n} (Query: {query})")
                    res = await dt._call_webhook(cfg, query)
                    logger.info(f"--- [FORGE DEBUG] WEBHOOK result: {res[:200]}...")
                    return res
                tool_fn.__name__ = n
                return tool_fn
                
            tool = llm.function_tool(create_webhook_cmd(t_cfg, name), name=name, description=desc)
            
        agent_tools.append(tool)

    # 5. INSTRUCTIONS
    agent_name = config.get("agentName") or config.get("agent_name") or "VoiceForge"
    lang_name = "Hindi" if stt_lang == "hi-IN" else "English" if stt_lang.startswith("en") else stt_lang
    
    current_time = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M:%S%z")
    
    base_instructions = f"Your name is {agent_name}. The current date and time is {current_time}. {config.get('prompt', 'You are a helpful assistant.')}"
    base_instructions += f"\n\nCRITICAL: You MUST respond in {lang_name} at all times. Do not switch to others unless explicitly asked."
    
    if agent_tools:
        tool_names = [t.get("name", "UnknownTool").lower().replace(" ", "_") for t in tools_cfg if isinstance(t, dict)]
        base_instructions += f"\n\n--- NEURAL FORGE CAPABILITIES ---\n"
        base_instructions += f"You have reached the Forge. You have DIRECT ACCESS to the following neural tools: {', '.join(tool_names)}.\n"
        base_instructions += "CRITICAL INSTRUCTIONS:\n"
        base_instructions += "1. USE PROVIDED TOOLS: You MUST use the tools which are provided to you to answer the user's requests. If the user asks for ANY action (like scheduling, logging, or searching), you MUST execute the relevant tool IMMEDIATELY. Do not just talk about doing it—DO IT. NEVER proactively schedule meetings or invoke tools on startup or in response to empty turns or silence.\n"
        base_instructions += "2. LANGUAGE AGNOSTIC: Even if the user speaks in Hindi, you must identify the intent and call the English-named tools.\n"
        base_instructions += "3. DATA RETRIEVAL: Use tools to fetch real-time info before answering. If a tool fails, explain why clearly but remain professional.\n"
        base_instructions += "4. CALENDAR FORMATTING: If scheduling an event, you MUST provide `start_time` in strict ISO 8601 format (e.g., '2026-05-18T14:30:00Z'). Calculate dates accurately based on the current date provided above."

    return {
        "stt": stt,
        "llm": agent_llm,
        "tts": agent_tts,
        "tools": agent_tools, 
        "instructions": base_instructions
    }
