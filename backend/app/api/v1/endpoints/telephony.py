"""
Unified Telephony API — SIP Trunk Provisioning & Outbound Calling.

Replaces the Twilio-webhook middleman with native LiveKit SIP trunk management.
Users configure their Twilio SIP credentials here, and the platform provisions
LiveKit SIP trunks/dispatch rules to handle all call routing natively.
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

from app.db.session import get_db
from app.models.orm import (
    UserORM, AgentORM, CallORM, CallDirection,
    PhoneNumberORM, SIPTrunkORM
)
from app.api.deps import get_current_user
from app.core.security import vault
from app.services.sip_trunk_service import sip_trunk_service

logger = logging.getLogger("telephony")
router = APIRouter()


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class ProvisionTrunkRequest(BaseModel):
    """Request to provision a LiveKit SIP trunk pair (inbound + outbound)."""
    # Twilio SIP Trunk credentials
    termination_uri: str  # e.g., "my-trunk.pstn.twilio.com"
    auth_username: str     # SIP auth username (Twilio Credential List)
    auth_password: str     # SIP auth password
    phone_numbers: List[str]  # E.164 phone numbers to associate
    trunk_name: Optional[str] = None  # Custom name

class OutboundCallRequest(BaseModel):
    """Request to trigger an outbound call via SIP."""
    to_number: str
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


# ─── TRUNK PROVISIONING ─────────────────────────────────────────────────────

@router.post("/trunks")
async def provision_sip_trunks(
    payload: ProvisionTrunkRequest,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Provisions a complete LiveKit SIP trunk setup for the user:
    1. Creates an Inbound SIP Trunk (Twilio → LiveKit)
    2. Creates an Outbound SIP Trunk (LiveKit → Twilio)
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
            "message": "SIP trunks provisioned successfully. Configure your Twilio SIP Trunk Origination URI to point to your LiveKit SIP endpoint."
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


# ─── OUTBOUND CALL ───────────────────────────────────────────────────────────

@router.post("/outbound")
async def trigger_outbound_call(
    payload: OutboundCallRequest,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers an outbound call via LiveKit SIP.
    1. Finds the user's outbound SIP trunk
    2. Verifies the target agent exists
    3. Creates a SIP participant (dials the customer)
    4. Logs the call in the database
    """
    # 1. Find user's outbound trunk
    trunk_stmt = select(SIPTrunkORM).where(
        SIPTrunkORM.user_id == current_user.id,
        SIPTrunkORM.trunk_type == "outbound",
        SIPTrunkORM.status == "active"
    )
    trunk_result = await db.execute(trunk_stmt)
    outbound_trunk = trunk_result.scalars().first()
    
    if not outbound_trunk:
        raise HTTPException(
            status_code=400,
            detail="No active outbound SIP trunk found. Please provision a trunk first in the Twilio Config tab."
        )
    
    # 2. Verify agent exists
    agent_result = await db.execute(
        select(AgentORM).where(AgentORM.id == payload.agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Voice agent not found")
    
    # 3. Build comprehensive agent metadata for the room dispatch
    # This is what the agent worker receives in ctx.job.metadata to configure itself
    agent_config = agent.config or {}
    agent_secrets = agent.secrets or {}
    
    # Resolve provider API keys from user's provider connections
    from app.models.orm import ProviderConnectionORM
    provider_keys = {}
    prov_result = await db.execute(
        select(ProviderConnectionORM).where(ProviderConnectionORM.user_id == current_user.id)
    )
    for conn in prov_result.scalars().all():
        try:
            provider_keys[conn.provider] = vault.decrypt(conn.api_key)
        except Exception:
            pass
    
    # Build the LLM config
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
    
    # Resolve tools if agent has any
    from app.models.orm import ToolORM
    tools_list = []
    if agent.tools:
        for tool_orm in agent.tools:
            tool_data = {
                "name": tool_orm.name,
                "description": tool_orm.description,
                "tool_type": tool_orm.tool_type,
                "url": tool_orm.url,
                "method": tool_orm.method,
                "headers": tool_orm.headers or {},
                "apiKey": tool_orm.api_key or "",
                "body_template": tool_orm.body_template or "",
                "config": tool_orm.config or {},
            }
            tools_list.append(tool_data)
    
    agent_metadata = json.dumps({
        "agentName": agent.agent_name,
        "prompt": agent.prompt,
        "language": agent.language,
        "llm": llm_config,
        "tts": tts_config,
        "stt": stt_config,
        "tools": tools_list,
    })
    
    room_name = f"outbound_{uuid.uuid4().hex[:8]}"
    
    # 4. Log call in DB
    db_call = CallORM(
        user_id=current_user.id,
        agent_id=payload.agent_id,
        session_id=room_name,
        from_number=outbound_trunk.numbers[0] if outbound_trunk.numbers else None,
        to_number=payload.to_number,
        direction=CallDirection.OUTBOUND,
        status="connecting",
    )
    db.add(db_call)
    await db.commit()
    await db.refresh(db_call)
    
    # 5. Dial via LiveKit SIP (agent dispatch + SIP participant)
    try:
        sip_result = await sip_trunk_service.dial_outbound(
            outbound_trunk_id=outbound_trunk.livekit_trunk_id,
            to_number=payload.to_number,
            room_name=room_name,
            agent_name="voice-forge-agent-v5",
            metadata=agent_metadata,
        )
        
        db_call.status = "initiated"
        await db.commit()
        
        return {
            "status": "success",
            "call_id": db_call.id,
            "room": room_name,
            "detail": "Outbound call initiated via LiveKit SIP."
        }
        
    except Exception as e:
        db_call.status = "failed"
        await db.commit()
        logger.error(f"Outbound SIP call failed: {e}")
        raise HTTPException(status_code=502, detail=f"SIP outbound call failed: {str(e)}")


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
    
    # Get LiveKit SIP domain for setup instructions
    lk_sip_domain = os.getenv("LIVEKIT_SIP_DOMAIN", "sip.livekit.cloud")
    
    return {
        "provisioned": has_inbound and has_outbound,
        "inbound_active": has_inbound,
        "outbound_active": has_outbound,
        "trunk_count": len(trunks),
        "livekit_sip_domain": lk_sip_domain,
        "setup_instructions": {
            "origination_uri": f"sip:{lk_sip_domain};transport=tcp",
            "description": "Set this as your Twilio SIP Trunk Origination URI to route inbound calls to LiveKit."
        }
    }
