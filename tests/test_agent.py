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


def test_openrouter_llm_tool_choice_none():
    from agent.factory import OpenRouterLLM
    from livekit.agents import llm
    from livekit.agents.types import NOT_GIVEN
    import unittest.mock as mock

    # Set up dummy OpenRouter key
    os.environ["OPENROUTER_API_KEY"] = "sk-or-dummy-key"

    # Instantiate OpenRouterLLM
    agent_llm = OpenRouterLLM(
        api_key="sk-or-dummy-key",
        model="meta-llama/llama-3.3-70b-instruct",
        base_url="https://openrouter.ai/api/v1",
    )

    # Mock the parent class (openai.LLM) chat method
    chat_ctx = llm.ChatContext()
    dummy_tool = mock.MagicMock(spec=llm.Tool)
    
    with mock.patch("livekit.plugins.openai.LLM.chat") as mock_super_chat:
        # Call chat with tool_choice="none"
        agent_llm.chat(
            chat_ctx=chat_ctx,
            tools=[dummy_tool],
            tool_choice="none"
        )
        
        # Verify that parent chat was called with tools=None and tool_choice=NOT_GIVEN
        mock_super_chat.assert_called_once_with(
            chat_ctx=chat_ctx,
            tools=None,
            conn_options=mock.ANY,
            parallel_tool_calls=mock.ANY,
            tool_choice=NOT_GIVEN,
            response_format=mock.ANY,
            extra_kwargs=mock.ANY
        )

    # Call chat with tool_choice="auto" (should pass through unmodified)
    with mock.patch("livekit.plugins.openai.LLM.chat") as mock_super_chat:
        agent_llm.chat(
            chat_ctx=chat_ctx,
            tools=[dummy_tool],
            tool_choice="auto"
        )
        
        # Verify that parent chat was called with tools and tool_choice="auto"
        mock_super_chat.assert_called_once_with(
            chat_ctx=chat_ctx,
            tools=[dummy_tool],
            conn_options=mock.ANY,
            parallel_tool_calls=mock.ANY,
            tool_choice="auto",
            response_format=mock.ANY,
            extra_kwargs=mock.ANY
        )


@pytest.mark.asyncio
async def test_voice_forge_agent_farewell():
    import unittest.mock as mock
    from livekit.agents.llm.tool_context import StopResponse
    from agent.main import VoiceForgeAgent

    with mock.patch("livekit.agents.voice.Agent.__init__", return_value=None):
        farewell_called = False
        def on_farewell():
            nonlocal farewell_called
            farewell_called = True

        agent = VoiceForgeAgent(
            termination_keywords="bye,exit",
            on_farewell_detected=on_farewell
        )
        
        turn_ctx = mock.MagicMock()
        new_message = mock.MagicMock()
        new_message.text_content = "Okay, bye now!"

        with mock.patch("livekit.agents.voice.Agent.on_user_turn_completed") as mock_super_completed:
            with pytest.raises(StopResponse):
                await agent.on_user_turn_completed(turn_ctx, new_message)
            
            assert farewell_called is True
            mock_super_completed.assert_not_called()


@pytest.mark.asyncio
async def test_voice_forge_agent_no_farewell():
    import unittest.mock as mock
    from agent.main import VoiceForgeAgent

    with mock.patch("livekit.agents.voice.Agent.__init__", return_value=None):
        farewell_called = False
        def on_farewell():
            nonlocal farewell_called
            farewell_called = True

        agent = VoiceForgeAgent(
            termination_keywords="bye,exit",
            on_farewell_detected=on_farewell
        )
        
        turn_ctx = mock.MagicMock()
        new_message = mock.MagicMock()
        new_message.text_content = "What is the weather today?"

        with mock.patch("livekit.agents.voice.Agent.on_user_turn_completed") as mock_super_completed:
            async def dummy_completed(*args, **kwargs):
                pass
            mock_super_completed.side_effect = dummy_completed

            await agent.on_user_turn_completed(turn_ctx, new_message)
            
            assert farewell_called is False
            mock_super_completed.assert_called_once_with(turn_ctx, new_message)


