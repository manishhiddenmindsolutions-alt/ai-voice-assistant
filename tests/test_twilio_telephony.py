import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.models.orm import CallORM, AgentORM, PhoneNumberORM
from app.api.v1.endpoints.twilio import TwilioOutboundRequest

# We mock all external dependencies before importing app to avoid database or configuration issues in testing
with patch("app.db.session.get_db", new=MagicMock()):
    with patch("app.api.deps.get_current_user", new=MagicMock()):
        from app.main import app

client = TestClient(app)

@pytest.fixture
def mock_db():
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db

@pytest.fixture
def mock_current_user():
    user = MagicMock()
    user.id = "test_user_id"
    # Vault encrypted versions of "AC123", "auth_token_456", "+1234567890"
    user.secrets = {
        "twilio_account_sid": "encrypted_sid",
        "twilio_auth_token": "encrypted_token",
        "twilio_phone_number": "encrypted_number"
    }
    return user

@pytest.mark.asyncio
@patch("app.api.v1.endpoints.twilio.vault")
@patch("app.api.v1.endpoints.twilio.httpx.AsyncClient")
async def test_trigger_twilio_outbound_success(mock_client_class, mock_vault, mock_db, mock_current_user):
    # Setup decrypt mocks
    mock_vault.decrypt.side_effect = lambda x: {
        "encrypted_sid": "AC123",
        "encrypted_token": "auth_token_456",
        "encrypted_number": "+1234567890"
    }.get(x, x)

    # Setup agent query mock
    mock_agent = AgentORM(id="agent_123", prompt="System Prompt", language="en-US", voice_id="alloy", llm_model="gpt-4o")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_agent
    mock_db.execute.return_value = mock_result

    # Setup httpx mock
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_resp.text = "Success"
    mock_client = MagicMock()
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client_class.return_value.__aenter__.return_value = mock_client

    # Execute endpoint directly using mock dependencies
    from app.api.v1.endpoints.twilio import trigger_twilio_outbound
    
    payload = TwilioOutboundRequest(to_number="+9876543210", agent_id="agent_123")
    response = await trigger_twilio_outbound(
        payload=payload,
        current_user=mock_current_user,
        db=mock_db
    )

    assert response["status"] == "success"
    assert "room" in response
    assert "call_id" in response
    mock_db.add.assert_called_once()
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.twilio.livekit_service")
async def test_handle_twilio_outbound_flow(mock_livekit, mock_db):
    # Setup agent query mock
    mock_agent = AgentORM(id="agent_123", prompt="System Prompt", language="en-US", voice_id="alloy", llm_model="gpt-4o")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_agent
    mock_db.execute.return_value = mock_result

    # Mock LiveKit agent dispatch
    mock_livekit.dispatch_agent = AsyncMock()

    # Execute endpoint
    from app.api.v1.endpoints.twilio import handle_twilio_outbound_flow
    response = await handle_twilio_outbound_flow(
        agent_id="agent_123",
        room="twilio_room_xyz",
        db=mock_db
    )

    assert response.media_type == "application/xml"
    content = response.body.decode()
    assert "<Response>" in content
    assert "<Dial>" in content
    assert "<Sip>sip:twilio_room_xyz@sip.livekit.cloud</Sip>" in content
    mock_livekit.dispatch_agent.assert_called_once()


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.twilio.livekit_service")
async def test_handle_twilio_inbound_call_success(mock_livekit, mock_db):
    # 1. Mock Phone Number lookup
    mock_phone = PhoneNumberORM(id="phone_123", number="+1234567890", provider="twilio", agent_id="agent_123", user_id="user_123")
    mock_result_phone = MagicMock()
    mock_result_phone.scalar_one_or_none.return_value = mock_phone

    # 2. Mock Agent lookup
    mock_agent = AgentORM(id="agent_123", prompt="Inbound Prompt", language="hi-IN", voice_id="neha", llm_model="llama3")
    mock_result_agent = MagicMock()
    mock_result_agent.scalar_one_or_none.return_value = mock_agent

    # Chain executions in order
    mock_db.execute.side_effect = [mock_result_phone, mock_result_agent]

    # Mock LiveKit
    mock_livekit.dispatch_agent = AsyncMock()

    # Execute
    from app.api.v1.endpoints.twilio import handle_twilio_inbound_call
    response = await handle_twilio_inbound_call(
        From="+9876543210",
        To="+1234567890",
        db=mock_db
    )

    assert response.media_type == "application/xml"
    content = response.body.decode()
    assert "<Response>" in content
    assert "<Dial>" in content
    assert "@sip.livekit.cloud</Sip>" in content
    mock_livekit.dispatch_agent.assert_called_once()
    mock_db.add.assert_called_once()

@pytest.mark.asyncio
async def test_update_number_success(mock_db):
    mock_phone = PhoneNumberORM(id="phone_123", number="+1234567890", provider="twilio", agent_id=None, user_id="user_123")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_phone
    mock_db.execute.return_value = mock_result

    from app.api.v1.endpoints.numbers import update_number, NumberUpdate
    payload = NumberUpdate(agent_id="agent_123")
    response = await update_number(
        number_id="phone_123",
        payload=payload,
        current_user=MagicMock(id="user_123"),
        db=mock_db
    )

    assert response.agent_id == "agent_123"
    mock_db.commit.assert_called_once()

