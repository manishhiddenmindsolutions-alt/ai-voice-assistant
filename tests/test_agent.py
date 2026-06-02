import pytest
import os
from typing import Annotated, Optional, List
from pydantic import Field
from agent.factory import create_components, NativeToolHandler
from livekit.agents import llm

def test_create_components_basic():
    # Set dummy API keys so plugins don't crash on init
    os.environ["GROQ_API_KEY"] = "gsk_dummy_groq_key_for_testing"
    os.environ["SARVAM_API_KEY"] = "sarvam_dummy_key"

    config = {
        "agentName": "TestAgent",
        "prompt": "Test Prompt",
        "language": "en",
        "llm": {
            "provider": "groq",
            "model": "llama-3.3-70b-versatile",
            "temperature": 0.7
        },
        "tts": {
            "provider": "sarvam",
            "voice": "shubh"
        },
        "stt": {
            "provider": "groq"
        },
        "tools": [
            {
                "name": "Append to Sheet",
                "tool_type": "SHEETS",
                "description": "Log sheet entries",
                "url": "https://sheets.googleapis.com",
                "apiKey": "dummy_sheet_key",
                "config": {
                    "spreadsheetId": "https://docs.google.com/spreadsheets/d/123456abcdef/edit",
                    "range": "Sheet1!A1"
                }
            },
            {
                "name": "Schedule Calendar",
                "tool_type": "CALENDAR",
                "description": "Schedule meetings",
                "url": "https://calendar.googleapis.com",
                "apiKey": "dummy_calendar_key",
                "config": {
                    "calendarId": "primary"
                }
            },
            {
                "name": "Webhook Tool",
                "tool_type": "WEBHOOK",
                "description": "Trigger external action",
                "url": "https://example.com/webhook",
                "apiKey": "dummy_webhook_key",
                "config": {}
            }
        ]
    }

    components = create_components(config)
    
    assert components["stt"] is not None
    assert components["llm"] is not None
    assert components["tts"] is not None
    
    # Verify Sarvam TTS connection pool patching
    tts_instance = components["tts"]
    if hasattr(tts_instance, "_pool"):
        assert tts_instance._pool._max_session_duration == 45.0
        assert tts_instance._pool._mark_refreshed_on_get is True

    assert len(components["tools"]) == 3
    assert "TestAgent" in components["instructions"]
    assert "append_to_sheet" in components["instructions"]

    # Verify that the tools are valid function tools
    tools = components["tools"]
    
    # 1. Check SHEETS tool
    sheets_tool = next(t for t in tools if t.info.name == "append_to_sheet")
    assert sheets_tool is not None
    # Let's inspect the parsed schema for the SHEETS tool
    openai_schema = llm.utils.build_legacy_openai_schema(sheets_tool)
    parameters = openai_schema["function"]["parameters"]
    assert "data_row" in parameters["properties"]
    data_row_prop = parameters["properties"]["data_row"]
    print("data_row schema:", data_row_prop)
    
    # Optional[List[str]] is Union[List[str], None], generating 'anyOf'
    if "anyOf" in data_row_prop:
        assert any(item.get("type") == "array" for item in data_row_prop["anyOf"])
    else:
        assert data_row_prop.get("type") == "array"
        
    assert "A list of values" in data_row_prop["description"]

    # 2. Check CALENDAR tool
    calendar_tool = next(t for t in tools if t.info.name == "schedule_calendar")
    assert calendar_tool is not None
    cal_schema = llm.utils.build_legacy_openai_schema(calendar_tool)
    cal_params = cal_schema["function"]["parameters"]
    assert "summary" in cal_params["properties"]
    assert "start_time" in cal_params["properties"]
    assert "duration_mins" in cal_params["properties"]

    # 3. Check WEBHOOK tool
    webhook_tool = next(t for t in tools if t.info.name == "webhook_tool")
    assert webhook_tool is not None
    wh_schema = llm.utils.build_legacy_openai_schema(webhook_tool)
    wh_params = wh_schema["function"]["parameters"]
    assert "query" in wh_params["properties"]
