from typing import Optional
import uuid
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.orm import AgentORM, ToolORM, IntegrationORM
from app.models.agent import AgentConfig
from app.services.livekit_service import livekit_service
from app.core.config import settings
from fastapi import APIRouter, HTTPException, Depends
from app.api.deps import get_current_user
from app.core.security import vault
from app.models.orm import UserORM
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleRequest

router = APIRouter()

@router.post("/start")
async def start_session(
    config: Optional[AgentConfig] = None, 
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    room_name = f"room_{uuid.uuid4().hex[:8]}"
    identity = f"user_{uuid.uuid4().hex[:6]}"
    
    if not settings.LIVEKIT_API_KEY or not settings.LIVEKIT_API_SECRET:
        raise HTTPException(status_code=500, detail="LiveKit credentials are not configured")

    metadata = config.model_dump(by_alias=True) if config else {}
    
    # --- DYNAMIC TOOL RESOLUTION ---
    if config and config.id:
        # Fetch agent from DB to get linked tools (using selectinload for async safety)
        # Ensure the agent belongs to the current user
        stmt = select(AgentORM).where(AgentORM.id == config.id, AgentORM.user_id == current_user.id).options(selectinload(AgentORM.tools))
        result = await db.execute(stmt)
        db_agent = result.scalar_one_or_none()
        
        if db_agent:
            # Refresh to load tools relationship
            tools_data = []
            for t in db_agent.tools:
                # DECRYPT TOOL KEY OR INTEGRATION TOKEN
                final_token = None
                
                if t.integration_id:
                    # Resolve token from linked integration
                    int_stmt = select(IntegrationORM).where(IntegrationORM.id == t.integration_id)
                    int_res = await db.execute(int_stmt)
                    integration = int_res.scalar_one_or_none()
                    if integration:
                        if integration.integration_type == "SERVICE_ACCOUNT" and integration.credentials:
                            # Formal Service Account Flow: Generate a scoped token on the fly
                            try:
                                scopes = integration.scopes or ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/spreadsheets"]
                                credentials = service_account.Credentials.from_service_account_info(
                                    integration.credentials, 
                                    scopes=scopes
                                )
                                credentials.refresh(GoogleRequest())
                                final_token = credentials.token
                            except Exception as e:
                                print(f"⚠️ [SYSTEM] Service Account Token Generation Failed: {e}")
                                final_token = "GENERATION_ERROR"
                        else:
                            # OAuth flow: Use GoogleManager to verify/refresh token
                            from app.core.integrations.google_utils import GoogleManager
                            final_token = await GoogleManager.refresh_token(db, integration)
                
                # Fallback to tool's own API key if no integration or token found
                if not final_token:
                    final_token = vault.decrypt(t.api_key) if t.api_key else None
                
                tools_data.append({
                    "name": t.name,
                    "description": t.description,
                    "tool_type": t.tool_type, # Include tool_type for agent factory resilience
                    "url": t.url,
                    "method": t.method,
                    "headers": t.headers,
                    "apiKey": final_token, 
                    "body_template": t.body_template,
                    "config": t.config
                })
            
            # Merge DB tools with any provided in config
            if tools_data:
                combined_tools = tools_data + metadata.get("tools", [])
                # Ensure only full dictionary configs are passed, filter out raw tool IDs
                metadata["tools"] = [t for t in combined_tools if isinstance(t, dict)]
                
            # --- SYNC AGENT IDENTITY FROM DB ---
            metadata["agentName"] = db_agent.agent_name
            metadata["prompt"] = db_agent.prompt
            metadata["language"] = db_agent.language
            
            # Sync model config if not already specific in request
            metadata.setdefault("llm", {})["model"] = db_agent.llm_model
            metadata.setdefault("tts", {})["voice"] = db_agent.voice_id
            
            # --- DECRYPT AGENT SECRETS ---
            # If agent has custom model keys (LLM/TTS/STT), decrypt and merge into metadata
            if db_agent.secrets:
                if "llm_key" in db_agent.secrets:
                    metadata.setdefault("llm", {})["apiKey"] = vault.decrypt(db_agent.secrets["llm_key"])
                if "stt_key" in db_agent.secrets:
                    metadata.setdefault("stt", {})["apiKey"] = vault.decrypt(db_agent.secrets["stt_key"])
                if "tts_key" in db_agent.secrets:
                    metadata.setdefault("tts", {})["apiKey"] = vault.decrypt(db_agent.secrets["tts_key"])

    # Standardizing dispatch to 'voice-forge-agent-v5' for reliability
    agent_dispatch_name = "voice-forge-agent-v5"
    
    token = livekit_service.generate_token(
        room_name=room_name,
        identity=identity,
        agent_name=agent_dispatch_name,
        metadata=metadata
    )

    # Explicitly dispatch the agent to ensure it joins (Double-tap strategy)
    try:
        await livekit_service.dispatch_agent(room_name, agent_dispatch_name, metadata)
    except Exception as e:
        print(f"⚠️ [SYSTEM] Explicit Agent Dispatch failed (will fallback to token-based): {e}")
    
    return {
        "token": token, 
        "room": room_name, 
        "identity": identity, 
        "url": settings.LIVEKIT_URL
    }

@router.get("/health")
async def health_check():
    """Checks LiveKit connectivity and API status."""
    try:
        await livekit_service.list_rooms()
        return {"status": "ok", "url": settings.LIVEKIT_URL}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
