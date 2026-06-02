from typing import Optional
import uuid
# pyrefly: ignore [missing-import]
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
# pyrefly: ignore [missing-import]
from app.models.orm import AgentORM, ToolORM, IntegrationORM, UserORM, ProviderConnectionORM
# pyrefly: ignore [missing-import]
from app.models.agent import AgentConfig
# pyrefly: ignore [missing-import]
from app.services.livekit_service import livekit_service
# pyrefly: ignore [missing-import]
from app.core.config import settings
from fastapi import APIRouter, HTTPException, Depends
# pyrefly: ignore [missing-import]
from app.api.deps import get_current_user
# pyrefly: ignore [missing-import]
from app.core.security import vault
# pyrefly: ignore [missing-import]
from app.models.orm import UserORM
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleRequest
import os
router = APIRouter()

@router.post("/start")
async def start_session(
    config: Optional[AgentConfig] = None, 
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    room_name = f"room_{uuid.uuid4().hex[:8]}"
    identity = f"user_{uuid.uuid4().hex[:6]}"
    
    print(f"\n⚡⚡⚡ [SESSION START DIAGNOSTIC] ⚡⚡⚡")
    print(f"Current user email: {getattr(current_user, 'email', None)}, user_id: {getattr(current_user, 'id', None)}")
    print(f"Request config: {config}")

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
            print(f"FOUND db_agent in DB: {db_agent.agent_name}, user_id: {db_agent.user_id}")
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
                            # pyrefly: ignore [missing-import]
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
            
            print(f"📋 [TOOL RESOLUTION] DB tools resolved: {len(tools_data)} tool(s)")
            for td in tools_data:
                print(f"  ✅ Tool: {td['name']} (type={td['tool_type']}, has_token={bool(td.get('apiKey'))}, config={td.get('config',{})})")
            
            # Merge DB tools with any dict-based tools in config, ALWAYS filter out raw UUID strings
            raw_config_tools = metadata.get("tools", [])
            dict_config_tools = [t for t in raw_config_tools if isinstance(t, dict)]
            skipped_ids = [t for t in raw_config_tools if isinstance(t, str)]
            if skipped_ids:
                print(f"  ⚠️ Filtered out {len(skipped_ids)} raw tool ID string(s): {skipped_ids}")
            
            metadata["tools"] = tools_data + dict_config_tools
            print(f"📋 [TOOL RESOLUTION] Final tools count in metadata: {len(metadata['tools'])}")
                
            # --- SYNC AGENT IDENTITY FROM DB ---
            metadata["agentName"] = db_agent.agent_name
            metadata["prompt"] = db_agent.prompt
            metadata["language"] = db_agent.language
            
            # Sync model config if not already specific in request
            metadata.setdefault("llm", {})["model"] = db_agent.llm_model
            metadata.setdefault("tts", {})["voice"] = db_agent.voice_id
            
            # --- DECRYPT SECRETS (BYOK DYNAMIC INFRASTRUCTURE RESOLVER) ---
            # Resolve LLM Key
            llm_provider = (metadata.get("llm", {}).get("provider") or "groq").lower()
            stmt_llm = select(ProviderConnectionORM).where(
                ProviderConnectionORM.user_id == db_agent.user_id,
                ProviderConnectionORM.provider == llm_provider
            )
            res_llm = await db.execute(stmt_llm)
            conn_llm = res_llm.scalar_one_or_none()
            if conn_llm and conn_llm.api_key:
                metadata.setdefault("llm", {})["apiKey"] = vault.decrypt(conn_llm.api_key)

            # Resolve STT Key
            stt_provider = (metadata.get("stt", {}).get("provider") or "groq").lower()
            stmt_stt = select(ProviderConnectionORM).where(
                ProviderConnectionORM.user_id == db_agent.user_id,
                ProviderConnectionORM.provider == stt_provider
            )
            res_stt = await db.execute(stmt_stt)
            conn_stt = res_stt.scalar_one_or_none()
            if conn_stt and conn_stt.api_key:
                metadata.setdefault("stt", {})["apiKey"] = vault.decrypt(conn_stt.api_key)

            # Resolve TTS Key
            tts_provider = (metadata.get("tts", {}).get("provider") or "sarvam").lower()
            stmt_tts = select(ProviderConnectionORM).where(
                ProviderConnectionORM.user_id == db_agent.user_id,
                ProviderConnectionORM.provider == tts_provider
            )
            res_tts = await db.execute(stmt_tts)
            conn_tts = res_tts.scalar_one_or_none()
            if conn_tts and conn_tts.api_key:
                metadata.setdefault("tts", {})["apiKey"] = vault.decrypt(conn_tts.api_key)

            # --- FALLBACK MECHANISM FOR LEGACY FLAT KEYS ---
            result_user = await db.execute(select(UserORM).where(UserORM.id == db_agent.user_id))
            db_user = result_user.scalar_one_or_none()
            if db_user and db_user.secrets:
                # LLM key fallback
                if "apiKey" not in metadata.get("llm", {}):
                    llm_prov_key = f"{llm_provider}_key"
                    if llm_prov_key in db_user.secrets:
                        metadata.setdefault("llm", {})["apiKey"] = vault.decrypt(db_user.secrets[llm_prov_key])
                    elif "llm_key" in db_user.secrets:
                        metadata.setdefault("llm", {})["apiKey"] = vault.decrypt(db_user.secrets["llm_key"])
                
                # STT key fallback
                if "apiKey" not in metadata.get("stt", {}):
                    stt_prov_key = f"{stt_provider}_key"
                    if stt_prov_key in db_user.secrets:
                        metadata.setdefault("stt", {})["apiKey"] = vault.decrypt(db_user.secrets[stt_prov_key])
                    elif "stt_key" in db_user.secrets:
                        metadata.setdefault("stt", {})["apiKey"] = vault.decrypt(db_user.secrets["stt_key"])

                # TTS key fallback
                if "apiKey" not in metadata.get("tts", {}):
                    tts_prov_key = f"{tts_provider}_key"
                    if tts_prov_key in db_user.secrets:
                        metadata.setdefault("tts", {})["apiKey"] = vault.decrypt(db_user.secrets[tts_prov_key])
                    elif "tts_key" in db_user.secrets:
                        metadata.setdefault("tts", {})["apiKey"] = vault.decrypt(db_user.secrets["tts_key"])
            
            # 2. Override with agent-specific keys if configured
            if db_agent.secrets:
                if "llm_key" in db_agent.secrets:
                    metadata.setdefault("llm", {})["apiKey"] = vault.decrypt(db_agent.secrets["llm_key"])
                if "stt_key" in db_agent.secrets:
                    metadata.setdefault("stt", {})["apiKey"] = vault.decrypt(db_agent.secrets["stt_key"])
                if "tts_key" in db_agent.secrets:
                    metadata.setdefault("tts", {})["apiKey"] = vault.decrypt(db_agent.secrets["tts_key"])

            # 3. Dynamic Ultimate Fallback to backend .env.local system environment keys
            if "apiKey" not in metadata.get("llm", {}):
                env_val = os.getenv(f"{llm_provider.upper()}_API_KEY") or os.getenv("OPENROUTER_API_KEY")
                if env_val:
                    metadata.setdefault("llm", {})["apiKey"] = env_val
            if "apiKey" not in metadata.get("stt", {}):
                env_val = os.getenv(f"{stt_provider.upper()}_API_KEY")
                if env_val:
                    metadata.setdefault("stt", {})["apiKey"] = env_val
            if "apiKey" not in metadata.get("tts", {}):
                env_val = os.getenv("OPENAI_API_KEY") if tts_provider == "openai" else os.getenv(f"{tts_provider.upper()}_API_KEY")
                if env_val:
                    metadata.setdefault("tts", {})["apiKey"] = env_val
        else:
            print(f"WARNING: db_agent with ID {config.id} was NOT found in the database for current user {getattr(current_user, 'email', None)} (ID: {getattr(current_user, 'id', None)}).")


    # Standardizing dispatch to 'voice-forge-agent-v5' for reliability
    agent_dispatch_name = "voice-forge-agent-v5"
    
    import json
    print(f"--- [DIAGNOSTIC] Final metadata for dispatch keys: {list(metadata.keys())}")
    print(f"--- [DIAGNOSTIC] Final LLM: {metadata.get('llm')}")
    print(f"--- [DIAGNOSTIC] Final STT: {metadata.get('stt')}")
    print(f"--- [DIAGNOSTIC] Final TTS: {metadata.get('tts')}")
    
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
