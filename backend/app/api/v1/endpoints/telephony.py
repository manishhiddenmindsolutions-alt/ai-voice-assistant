"""
Unified Telephony API — SIP Trunk Provisioning, LiveKit Phone Numbers & Outbound Calling.

Native LiveKit SIP trunk management. Users configure their SIP provider credentials
here, and the platform provisions LiveKit SIP trunks/dispatch rules to handle all
call routing natively.
"""
import os
import uuid
import json
import logging
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# pyrefly: ignore [missing-import]
from app.db.session import get_db
# pyrefly: ignore [missing-import]
from app.models.orm import (
    UserORM, AgentORM, CallORM, CallDirection,
    PhoneNumberORM, SIPTrunkORM
)
# pyrefly: ignore [missing-import]
from app.api.deps import get_current_user
# pyrefly: ignore [missing-import]
from app.core.security import vault
# pyrefly: ignore [missing-import]
from app.services.sip_trunk_service import sip_trunk_service
# pyrefly: ignore [missing-import]
from app.services.phone_numbers_service import lk_phone_service

logger = logging.getLogger("telephony")
router = APIRouter()


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class ProvisionTrunkRequest(BaseModel):
    """Request to provision a LiveKit SIP trunk pair (inbound + outbound)."""
    # SIP Trunk credentials
    termination_uri: str  # e.g., "my-trunk.pstn.twilio.com"
    auth_username: str     # SIP auth username
    auth_password: str     # SIP auth password
    phone_numbers: List[str]  # E.164 phone numbers to associate
    trunk_name: Optional[str] = None  # Custom name
    provider: str = "twilio"  # SIP provider name

class OutboundCallRequest(BaseModel):
    """Request to trigger an outbound call via SIP."""
    to_number: str
    agent_id: str

class UpdateTrunkAgentRequest(BaseModel):
    """Request to update the agent associated with a trunk's dispatch rule."""
    agent_id: str

class TrunkResponse(BaseModel):
    id: str
    trunk_type: str
    name: str
    livekit_trunk_id: str
    termination_uri: Optional[str] = None
    numbers: list = []
    dispatch_rule_id: Optional[str] = None
    status: str = "active"

    class Config:
        from_attributes = True


# ─── HELPER: Build agent metadata for dispatch ────────────────────────────────

async def _build_agent_metadata(agent: AgentORM, db: AsyncSession) -> str:
    """Builds a JSON metadata string with full agent configuration for dispatch."""
    # pyrefly: ignore [missing-import]
    from app.models.orm import ProviderConnectionORM
    
    agent_config = agent.config or {}
    
    # Resolve provider API keys from user's provider connections
    provider_keys = {}
    if agent.user_id:
        prov_result = await db.execute(
            select(ProviderConnectionORM).where(ProviderConnectionORM.user_id == agent.user_id)
        )
        for conn in prov_result.scalars().all():
            try:
                provider_keys[conn.provider] = vault.decrypt(conn.api_key)
            except Exception:
                pass
    
    # Build LLM config
    llm_provider = agent_config.get("llm", {}).get("provider", "groq")
    llm_config = {
        "provider": llm_provider,
        "model": agent.llm_model or agent_config.get("llm", {}).get("model", "llama-3.3-70b-versatile"),
        "temperature": agent_config.get("llm", {}).get("temperature", 0.7),
        "apiKey": provider_keys.get(llm_provider) or agent_config.get("llm", {}).get("apiKey", ""),
    }
    
    # Build TTS config
    tts_provider = agent_config.get("tts", {}).get("provider", "sarvam")
    tts_config = {
        "provider": tts_provider,
        "voice": agent.voice_id or agent_config.get("tts", {}).get("voice", "neha"),
        "model": agent_config.get("tts", {}).get("model", ""),
        "apiKey": provider_keys.get(tts_provider) or agent_config.get("tts", {}).get("apiKey", ""),
    }
    
    # Build STT config
    stt_provider = agent_config.get("stt", {}).get("provider", "groq")
    stt_config = {
        "provider": stt_provider,
        "apiKey": provider_keys.get(stt_provider) or agent_config.get("stt", {}).get("apiKey", ""),
    }
    
    # Resolve tools
    tools_list = []
    if agent.tools:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request as GoogleRequest
        from app.models.orm import IntegrationORM

        for t in agent.tools:
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
                            logger.error(f"⚠️ [SYSTEM] Service Account Token Generation Failed: {e}")
                            final_token = "GENERATION_ERROR"
                    else:
                        # OAuth flow: Use GoogleManager to verify/refresh token
                        # pyrefly: ignore [missing-import]
                        from app.core.integrations.google_utils import GoogleManager
                        final_token = await GoogleManager.refresh_token(db, integration)
            
            # Fallback to tool's own API key if no integration or token found
            if not final_token:
                final_token = vault.decrypt(t.api_key) if t.api_key else None

            tool_data = {
                "name": t.name,
                "description": t.description,
                "tool_type": t.tool_type,
                "url": t.url,
                "method": t.method,
                "headers": t.headers or {},
                "apiKey": final_token or "",
                "body_template": t.body_template or "",
                "config": t.config or {},
            }
            tools_list.append(tool_data)
    
    return json.dumps({
        "agentName": agent.agent_name,
        "prompt": agent.prompt,
        "language": agent.language,
        "llm": llm_config,
        "tts": tts_config,
        "stt": stt_config,
        "tools": tools_list,
    })


# ─── TRUNK PROVISIONING ─────────────────────────────────────────────────────

@router.post("/trunks")
async def provision_sip_trunks(
    payload: ProvisionTrunkRequest,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Provisions a complete LiveKit SIP trunk setup for the user:
    1. Creates an Inbound SIP Trunk (SIP Provider → LiveKit)
    2. Creates an Outbound SIP Trunk (LiveKit → SIP Provider)
    3. Creates a Dispatch Rule (auto-routes inbound calls to voice agent)
    4. Saves all trunk IDs in the database
    """
    trunk_name = payload.trunk_name or f"trunk-{current_user.id[:8]}"
    
    try:
        # 1. Create Inbound Trunk
        inbound_result = await sip_trunk_service.create_inbound_trunk(
            name=f"{trunk_name}-inbound",
            numbers=payload.phone_numbers,
        )
        
        # 2. Create Outbound Trunk
        outbound_result = await sip_trunk_service.create_outbound_trunk(
            name=f"{trunk_name}-outbound",
            address=payload.termination_uri,
            numbers=payload.phone_numbers,
            auth_username=payload.auth_username,
            auth_password=payload.auth_password,
        )
        
        # 3. Create Dispatch Rule (routes inbound calls to the voice agent)
        # Pass empty metadata for now — agent will use dynamic fallback
        dispatch_result = await sip_trunk_service.create_dispatch_rule(
            trunk_ids=[inbound_result["trunk_id"]],
            agent_name="voice-forge-agent-v5",
            room_prefix=f"call-{current_user.id[:6]}-",
        )
        
        # 4. Save Inbound Trunk record
        db_inbound = SIPTrunkORM(
            user_id=current_user.id,
            livekit_trunk_id=inbound_result["trunk_id"],
            trunk_type="inbound",
            name=f"{trunk_name}-inbound",
            numbers=payload.phone_numbers,
            dispatch_rule_id=dispatch_result["dispatch_rule_id"],
            status="active",
        )
        db.add(db_inbound)
        
        # 5. Save Outbound Trunk record
        db_outbound = SIPTrunkORM(
            user_id=current_user.id,
            livekit_trunk_id=outbound_result["trunk_id"],
            trunk_type="outbound",
            name=f"{trunk_name}-outbound",
            termination_uri=payload.termination_uri,
            auth_username=vault.encrypt(payload.auth_username),
            auth_password=vault.encrypt(payload.auth_password),
            numbers=payload.phone_numbers,
            status="active",
        )
        db.add(db_outbound)
        
        # 6. Link phone numbers to the inbound trunk
        for number in payload.phone_numbers:
            clean = number.strip()
            stmt = select(PhoneNumberORM).where(
                PhoneNumberORM.user_id == current_user.id,
                (PhoneNumberORM.number == clean) | (PhoneNumberORM.number == clean.replace("+", ""))
            )
            result = await db.execute(stmt)
            db_number = result.scalar_one_or_none()
            if db_number:
                db_number.sip_trunk_id = db_inbound.id
        
        await db.commit()
        
        # Get SIP URI for setup instructions
        sip_uri = await lk_phone_service.get_sip_uri()
        
        logger.info(f"Provisioned SIP trunks for user {current_user.id}: inbound={inbound_result['trunk_id']}, outbound={outbound_result['trunk_id']}")
        
        return {
            "status": "success",
            "inbound_trunk": {
                "id": db_inbound.id,
                "livekit_trunk_id": inbound_result["trunk_id"],
                "dispatch_rule_id": dispatch_result["dispatch_rule_id"],
            },
            "outbound_trunk": {
                "id": db_outbound.id,
                "livekit_trunk_id": outbound_result["trunk_id"],
            },
            "setup_instructions": {
                "sip_uri": sip_uri,
                "origination_uri": f"{sip_uri};transport=tcp",
                "description": f"Set this as your {payload.provider.title()} SIP Trunk Origination URI to route inbound calls to LiveKit."
            },
            "message": "SIP trunks provisioned successfully."
        }
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Trunk provisioning failed: {e}")
        raise HTTPException(status_code=500, detail=f"SIP trunk provisioning failed: {str(e)}")


@router.get("/trunks")
async def list_user_trunks(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all SIP trunks provisioned by the current user."""
    result = await db.execute(
        select(SIPTrunkORM).where(SIPTrunkORM.user_id == current_user.id)
    )
    trunks = result.scalars().all()
    
    return [
        {
            "id": t.id,
            "trunk_type": t.trunk_type,
            "name": t.name,
            "livekit_trunk_id": t.livekit_trunk_id,
            "termination_uri": t.termination_uri,
            "numbers": t.numbers or [],
            "dispatch_rule_id": t.dispatch_rule_id,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in trunks
    ]


@router.delete("/trunks/{trunk_id}")
async def delete_user_trunk(
    trunk_id: str,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a user's SIP trunk from both LiveKit and the database.
    Also cleans up the associated dispatch rule if it's an inbound trunk.
    """
    stmt = select(SIPTrunkORM).where(
        SIPTrunkORM.id == trunk_id,
        SIPTrunkORM.user_id == current_user.id
    )
    result = await db.execute(stmt)
    db_trunk = result.scalar_one_or_none()
    
    if not db_trunk:
        raise HTTPException(status_code=404, detail="Trunk not found")
    
    # Delete from LiveKit
    await sip_trunk_service.delete_trunk(db_trunk.livekit_trunk_id, db_trunk.trunk_type)
    
    # Delete dispatch rule if inbound
    if db_trunk.dispatch_rule_id:
        await sip_trunk_service.delete_dispatch_rule(db_trunk.dispatch_rule_id)
    
    # Unlink phone numbers
    num_stmt = select(PhoneNumberORM).where(PhoneNumberORM.sip_trunk_id == trunk_id)
    num_result = await db.execute(num_stmt)
    for num in num_result.scalars().all():
        num.sip_trunk_id = None
    
    await db.delete(db_trunk)
    await db.commit()
    
    return {"status": "success", "message": "SIP trunk deleted successfully"}


# ─── UPDATE TRUNK AGENT ──────────────────────────────────────────────────────

@router.put("/trunks/{trunk_id}/agent")
async def update_trunk_agent(
    trunk_id: str,
    payload: UpdateTrunkAgentRequest,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates the agent associated with an inbound trunk's dispatch rule.
    Deletes the old dispatch rule and creates a new one with the new agent config.
    """
    from sqlalchemy.orm import selectinload
    
    # Find the inbound trunk
    stmt = select(SIPTrunkORM).where(
        SIPTrunkORM.id == trunk_id,
        SIPTrunkORM.user_id == current_user.id,
        SIPTrunkORM.trunk_type == "inbound",
    )
    result = await db.execute(stmt)
    db_trunk = result.scalar_one_or_none()
    
    if not db_trunk:
        raise HTTPException(status_code=404, detail="Inbound trunk not found")
    
    # Verify agent exists
    agent_stmt = select(AgentORM).options(selectinload(AgentORM.tools)).where(
        AgentORM.id == payload.agent_id,
        AgentORM.user_id == current_user.id,
    )
    agent_result = await db.execute(agent_stmt)
    agent = agent_result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Delete old dispatch rule
    if db_trunk.dispatch_rule_id:
        await sip_trunk_service.delete_dispatch_rule(db_trunk.dispatch_rule_id)
    
    # Build agent metadata
    agent_metadata = await _build_agent_metadata(agent, db)
    
    # Create new dispatch rule with agent metadata
    dispatch_result = await sip_trunk_service.create_dispatch_rule(
        trunk_ids=[db_trunk.livekit_trunk_id],
        agent_name="voice-forge-agent-v5",
        room_prefix=f"call-{current_user.id[:6]}-",
        metadata=agent_metadata,
    )
    
    db_trunk.dispatch_rule_id = dispatch_result["dispatch_rule_id"]
    await db.commit()
    
    return {
        "status": "success",
        "dispatch_rule_id": dispatch_result["dispatch_rule_id"],
        "agent_name": agent.agent_name,
        "message": f"Trunk dispatch rule updated to agent '{agent.agent_name}'",
    }


# ─── DISPATCH RULES ──────────────────────────────────────────────────────────

@router.get("/dispatch-rules")
async def list_dispatch_rules(
    current_user: UserORM = Depends(get_current_user),
):
    """Lists all SIP dispatch rules on the LiveKit project."""
    rules = await sip_trunk_service.list_dispatch_rules()
    return rules


# ─── OUTBOUND CALL ───────────────────────────────────────────────────────────

@router.post("/outbound")
async def trigger_outbound_call(
    payload: OutboundCallRequest,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers an outbound call via Twilio REST API (legacy fallback).
    1. Fetch decrypted Twilio credentials from current user secrets.
    2. Create dynamic room name.
    3. Dispatch the AI agent into the room FIRST.
    4. Register initiated CallORM in database.
    5. Call Twilio Calls API.
    """
    from sqlalchemy.orm import selectinload
    # pyrefly: ignore [missing-import]
    from app.services.livekit_service import livekit_service
    import httpx
    
    secrets = current_user.secrets or {}
    
    # 1. Resolve Credentials
    try:
        twilio_sid = vault.decrypt(secrets.get("twilio_account_sid", ""))
        twilio_token = vault.decrypt(secrets.get("twilio_auth_token", ""))
        twilio_number = vault.decrypt(secrets.get("twilio_phone_number", ""))
    except Exception as e:
        logger.error(f"Failed to decrypt Twilio keys: {e}")
        raise HTTPException(status_code=500, detail="Error decrypting secure credentials.")

    if not twilio_sid or not twilio_token or not twilio_number:
        raise HTTPException(
            status_code=400, 
            detail="Twilio credentials are not fully configured in your Telephony settings."
        )

    # 2. Verify Agent
    agent_result = await db.execute(
        select(AgentORM).options(selectinload(AgentORM.tools)).where(AgentORM.id == payload.agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Selected Voice Agent not found.")

    # 3. Setup Call Room
    room_name = f"twilio_{uuid.uuid4().hex[:8]}"
    
    # 3b. Dispatch Agent into the room FIRST so it's ready when SIP connects
    try:
        agent_metadata = await _build_agent_metadata(agent, db)
        await livekit_service.dispatch_agent(
            room_name=room_name,
            agent_name="voice-forge-agent-v5",
            metadata=json.loads(agent_metadata)
        )
        logger.info(f"Agent dispatched to room {room_name} for Twilio outbound call")
    except Exception as e:
        logger.warning(f"Agent dispatch failed (will retry on SIP connect): {e}")

    # 4. Log Call in DB
    db_call = CallORM(
        user_id=current_user.id,
        agent_id=payload.agent_id,
        session_id=room_name,
        from_number=twilio_number,
        to_number=payload.to_number,
        direction=CallDirection.OUTBOUND,
        status="connecting"
    )
    db.add(db_call)
    await db.commit()
    await db.refresh(db_call)

    # 5. Build Callback URL dynamically
    base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    flow_callback_url = f"{base_url}/api/v1/telephony/twilio/flow?agent_id={payload.agent_id}&room={room_name}"

    # 6. Execute Twilio Outbound API Call
    twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Calls.json"
    
    data = {
        "To": payload.to_number,
        "From": twilio_number,
        "Url": flow_callback_url
    }
    
    logger.info(f"Triggering Twilio REST outbound call: To={payload.to_number}, From={twilio_number}")
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                twilio_url,
                auth=(twilio_sid, twilio_token),
                data=data
            )
            if resp.status_code not in (200, 201):
                logger.error(f"Twilio outbound trigger failed: Status={resp.status_code}, Body={resp.text}")
                db_call.status = "failed"
                await db.commit()
                raise HTTPException(
                    status_code=502, 
                    detail=f"Twilio gateway returned error: {resp.text}"
                )
            
            # Update status to initiated
            db_call.status = "initiated"
            await db.commit()
            
            return {
                "status": "success",
                "call_id": db_call.id,
                "room": room_name,
                "detail": "Outbound call successfully queued on Twilio gateway."
            }
            
        except Exception as e:
            logger.error(f"Network error connecting to Twilio REST API: {e}")
            db_call.status = "failed"
            await db.commit()
            raise HTTPException(status_code=502, detail=f"Failed to communicate with Twilio: {e}")


# ─── LIVEKIT PHONE NUMBERS ──────────────────────────────────────────────────

@router.get("/lk-numbers/search")
async def search_lk_numbers(
    country_code: str = "US",
    area_code: Optional[str] = None,
    current_user: UserORM = Depends(get_current_user),
):
    """Search available LiveKit phone numbers."""
    return await lk_phone_service.search_numbers(country_code, area_code)


@router.get("/lk-numbers/sip-uri")
async def get_sip_uri(
    current_user: UserORM = Depends(get_current_user),
):
    """Returns the LiveKit SIP URI for this project."""
    sip_uri = await lk_phone_service.get_sip_uri()
    sip_domain = os.getenv("LIVEKIT_SIP_DOMAIN", "sip.livekit.cloud")
    return {
        "sip_uri": sip_uri,
        "sip_domain": sip_domain,
        "origination_uri": f"{sip_uri};transport=tcp",
    }


# ─── STATUS & DIAGNOSTICS ───────────────────────────────────────────────────

@router.get("/status")
async def get_telephony_status(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns the current telephony provisioning status for the user."""
    trunk_result = await db.execute(
        select(SIPTrunkORM).where(SIPTrunkORM.user_id == current_user.id)
    )
    trunks = trunk_result.scalars().all()
    
    has_inbound = any(t.trunk_type == "inbound" and t.status == "active" for t in trunks)
    has_outbound = any(t.trunk_type == "outbound" and t.status == "active" for t in trunks)
    
    # Get phone numbers
    num_result = await db.execute(
        select(PhoneNumberORM).where(PhoneNumberORM.user_id == current_user.id)
    )
    numbers = num_result.scalars().all()
    
    # Get LiveKit SIP domain for setup instructions
    lk_sip_domain = os.getenv("LIVEKIT_SIP_DOMAIN", "sip.livekit.cloud")
    sip_uri = f"sip:{lk_sip_domain}"
    
    return {
        "provisioned": has_inbound and has_outbound,
        "inbound_active": has_inbound,
        "outbound_active": has_outbound,
        "trunk_count": len(trunks),
        "number_count": len(numbers),
        "sip_uri": sip_uri,
        "sip_domain": lk_sip_domain,
        "setup_instructions": {
            "origination_uri": f"{sip_uri};transport=tcp",
            "description": "Set this as your SIP Trunk Origination URI to route inbound calls to LiveKit."
        },
        "trunks": [
            {
                "id": t.id,
                "type": t.trunk_type,
                "name": t.name,
                "status": t.status,
                "numbers": t.numbers or [],
                "dispatch_rule_id": t.dispatch_rule_id,
            }
            for t in trunks
        ],
    }
