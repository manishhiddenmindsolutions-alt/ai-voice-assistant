"""
Agent Metadata Service.

Builds the complete JSON metadata blob that is passed to the agent worker
via LiveKit's `metadata` field on dispatch rules and CreateSIPParticipant.

The agent worker reads this blob on startup to configure:
  - Prompt / persona
  - LLM provider + model + API key
  - TTS provider + voice + API key
  - STT provider + API key
  - All tools with resolved OAuth tokens / API keys

Expensive operations (Google OAuth refresh) are isolated here so callers
can move them into background tasks if needed.
"""

import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.orm import AgentORM, ProviderConnectionORM, IntegrationORM
from app.core.security import vault

logger = logging.getLogger("agent_metadata")


async def build_agent_metadata(agent: AgentORM, db: AsyncSession) -> str:
    """
    Assembles the full agent dispatch metadata as a JSON string.

    Priority for API keys:
      1. Per-user ProviderConnectionORM (connected provider keys)
      2. Agent-level config blob (legacy / per-agent keys)
      3. Empty string (agent worker will reject calls or use its own default)
    """
    agent_config = agent.config or {}

    # ── Provider API Keys ────────────────────────────────────────────────────
    provider_keys: dict[str, str] = {}
    if agent.user_id:
        prov_result = await db.execute(
            select(ProviderConnectionORM).where(
                ProviderConnectionORM.user_id == agent.user_id
            )
        )
        for conn in prov_result.scalars().all():
            try:
                provider_keys[conn.provider] = vault.decrypt(conn.api_key)
            except Exception as exc:
                logger.warning(f"[Meta] Cannot decrypt key for provider {conn.provider}: {exc}")

    # ── LLM ──────────────────────────────────────────────────────────────────
    llm_provider = agent_config.get("llm", {}).get("provider", "groq")
    llm_config = {
        "provider": llm_provider,
        "model": agent.llm_model or agent_config.get("llm", {}).get("model", "llama-3.3-70b-versatile"),
        "temperature": agent_config.get("llm", {}).get("temperature", 0.7),
        "apiKey": (
            provider_keys.get(llm_provider)
            or agent_config.get("llm", {}).get("apiKey", "")
        ),
    }

    # ── TTS ──────────────────────────────────────────────────────────────────
    tts_provider = agent_config.get("tts", {}).get("provider", "sarvam")
    tts_config = {
        "provider": tts_provider,
        "voice": agent.voice_id or agent_config.get("tts", {}).get("voice", "neha"),
        "model": agent_config.get("tts", {}).get("model", ""),
        "apiKey": (
            provider_keys.get(tts_provider)
            or agent_config.get("tts", {}).get("apiKey", "")
        ),
    }

    # ── STT ──────────────────────────────────────────────────────────────────
    stt_provider = agent_config.get("stt", {}).get("provider", "groq")
    stt_config = {
        "provider": stt_provider,
        "apiKey": (
            provider_keys.get(stt_provider)
            or agent_config.get("stt", {}).get("apiKey", "")
        ),
    }

    # ── Tools ─────────────────────────────────────────────────────────────────
    tools_list = []
    if agent.tools:
        for tool in agent.tools:
            token = await _resolve_tool_token(tool, db)
            tools_list.append(
                {
                    "name": tool.name,
                    "description": tool.description,
                    "tool_type": tool.tool_type,
                    "url": tool.url,
                    "method": tool.method,
                    "headers": tool.headers or {},
                    "apiKey": token or "",
                    "body_template": tool.body_template or "",
                    "config": tool.config or {},
                }
            )

    return json.dumps(
        {
            "agentId": agent.id,
            "agentName": agent.agent_name,
            "prompt": agent.prompt,
            "language": agent.language,
            "llm": llm_config,
            "tts": tts_config,
            "stt": stt_config,
            "tools": tools_list,
        }
    )


async def _resolve_tool_token(tool, db: AsyncSession) -> str | None:
    """
    Resolves the authentication token / API key for a tool.

    For integration-backed tools:
      - SERVICE_ACCOUNT → generate a short-lived Google OAuth token
      - OAUTH           → refresh and return the user's OAuth access token
    For raw webhook tools:
      - Decrypt the stored api_key field
    """
    if not tool.integration_id:
        if tool.api_key:
            try:
                return vault.decrypt(tool.api_key)
            except Exception:
                return None
        return None

    # Load the integration
    int_result = await db.execute(
        select(IntegrationORM).where(IntegrationORM.id == tool.integration_id)
    )
    integration = int_result.scalar_one_or_none()
    if not integration:
        return None

    if integration.integration_type == "SERVICE_ACCOUNT" and integration.credentials:
        return await _service_account_token(integration)
    else:
        return await _oauth_token(db, integration)


async def _service_account_token(integration: IntegrationORM) -> str | None:
    """Generates a short-lived Google token from a service account JSON."""
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleRequest

        scopes = integration.scopes or [
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/spreadsheets",
        ]
        creds = service_account.Credentials.from_service_account_info(
            integration.credentials, scopes=scopes
        )
        creds.refresh(GoogleRequest())
        return creds.token
    except Exception as exc:
        logger.error(f"[Meta] Service account token generation failed: {exc}")
        return None


async def _oauth_token(db: AsyncSession, integration: IntegrationORM) -> str | None:
    """Refreshes and returns the OAuth access token for an integration."""
    try:
        from app.core.integrations.google_utils import GoogleManager
        return await GoogleManager.refresh_token(db, integration)
    except Exception as exc:
        logger.error(f"[Meta] OAuth token refresh failed: {exc}")
        return None
