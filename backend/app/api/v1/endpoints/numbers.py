from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from app.db.session import get_db
from app.models.orm import PhoneNumberORM, UserORM
from app.api.deps import get_current_user

router = APIRouter()

class NumberBase(BaseModel):
    number: str = "+1234567890"
    provider: str = "custom"
    provider_sid: Optional[str] = None
    agent_id: Optional[str] = None
    sip_trunk_id: Optional[str] = None

class NumberCreate(NumberBase):
    pass # user_id is now handled by JWT

class NumberResponse(NumberBase):
    id: str
    user_id: str

    class Config:
        from_attributes = True

# --- ENDPOINTS ---

@router.post("/", response_model=NumberResponse)
async def add_number(
    number: NumberCreate, 
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        db_number = PhoneNumberORM(
            **number.model_dump(),
            user_id=current_user.id
        )
        db.add(db_number)
        await db.commit()
        await db.refresh(db_number)
        return db_number
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[NumberResponse])
async def list_numbers(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PhoneNumberORM).where(PhoneNumberORM.user_id == current_user.id))
    return result.scalars().all()

@router.delete("/{number_id}")
async def delete_number(
    number_id: str, 
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify ownership before delete
    stmt = select(PhoneNumberORM).where(
        PhoneNumberORM.id == number_id,
        PhoneNumberORM.user_id == current_user.id
    )
    result = await db.execute(stmt)
    db_number = result.scalar_one_or_none()
    
    if not db_number:
        raise HTTPException(status_code=404, detail="Phone number not found or unauthorized")
        
    await db.delete(db_number)
    await db.commit()
    return {"message": "Number deleted"}

class NumberUpdate(BaseModel):
    agent_id: Optional[str] = None

@router.put("/{number_id}", response_model=NumberResponse)
async def update_number(
    number_id: str,
    payload: NumberUpdate,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(PhoneNumberORM).where(
        PhoneNumberORM.id == number_id,
        PhoneNumberORM.user_id == current_user.id
    )
    result = await db.execute(stmt)
    db_number = result.scalar_one_or_none()
    
    if not db_number:
        raise HTTPException(status_code=404, detail="Phone number not found or unauthorized")
        
    db_number.agent_id = payload.agent_id
    await db.commit()
    await db.refresh(db_number)
    return db_number


@router.get("/inbound-config")
async def get_inbound_config(
    number: str,
    caller_number: Optional[str] = None,
    room_name: Optional[str] = None,
    agent_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Internal endpoint to resolve agent config for a dialed phone number.
    Called dynamically by the LiveKit Agent worker when a call arrives.
    """
    from app.models.orm import AgentORM, CallORM, CallDirection, ProviderConnectionORM
    from sqlalchemy.orm import selectinload
    from app.core.security import vault
    import logging
    logger = logging.getLogger("inbound-config")

    agent = None
    
    # 1. Direct dynamic resolution using custom SIP Header Agent ID
    if agent_id and agent_id != "" and agent_id != "None":
        logger.info(f"Resolving agent dynamically via custom SIP header Agent ID: {agent_id}")
        agent_stmt = select(AgentORM).options(selectinload(AgentORM.tools)).where(AgentORM.id == agent_id)
        agent_result = await db.execute(agent_stmt)
        agent = agent_result.scalar_one_or_none()

    # 2. Fallback to registered number resolution
    if not agent:
        clean_number = number.strip().replace(" ", "").replace("+", "")
        logger.info(f"Falling back to registered number lookup: {clean_number}")
        stmt = select(PhoneNumberORM).where(
            (PhoneNumberORM.number == clean_number) |
            (PhoneNumberORM.number == f"+{clean_number}")
        )
        result = await db.execute(stmt)
        db_number = result.scalar_one_or_none()
        
        if db_number and db_number.agent_id:
            agent_stmt = select(AgentORM).options(selectinload(AgentORM.tools)).where(AgentORM.id == db_number.agent_id)
            agent_result = await db.execute(agent_stmt)
            agent = agent_result.scalar_one_or_none()
        
    # --- Link dynamic LiveKit room name to original CallORM record ---
    if caller_number and room_name:
        clean_caller = caller_number.strip()
        # Find the most recent pending call matching the caller's phone number
        call_stmt = select(CallORM).where(
            ((CallORM.to_number == clean_caller) | (CallORM.from_number == clean_caller)) &
            (CallORM.status.in_(["initiated", "connecting"]))
        ).order_by(CallORM.started_at.desc())
        call_res = await db.execute(call_stmt)
        call_rec = call_res.scalars().first()
        
        if call_rec:
            logger.info(f"--- [HMS DEBUG] Linking Call SID {call_rec.id} to dynamic room {room_name} ---")
            call_rec.session_id = room_name
            call_rec.status = "active"
            await db.commit()
            
    if not agent:
        logger.warning(f"No agent found for number {number}. Returning baseline defaults.")
        return {
            "agentName": "VoiceForge",
            "prompt": "You are a helpful voice assistant.",
            "language": "en-US",
            "llm": {
                "provider": "groq",
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.7,
                "apiKey": ""
            },
            "tts": {
                "provider": "sarvam",
                "voice": "shubh",
                "model": "",
                "apiKey": ""
            },
            "stt": {
                "provider": "groq",
                "apiKey": ""
            },
            "tools": []
        }
        
    # Resolve provider API keys from user's provider connections
    provider_keys = {}
    if agent.user_id:
        prov_result = await db.execute(
            select(ProviderConnectionORM).where(ProviderConnectionORM.user_id == agent.user_id)
        )
        for conn in prov_result.scalars().all():
            try:
                provider_keys[conn.provider] = vault.decrypt(conn.api_key)
            except Exception as e:
                logger.error(f"Error decrypting api key for provider {conn.provider}: {e}")
    
    agent_config = agent.config or {}
    
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
        "voice": agent.voice_id or agent_config.get("tts", {}).get("voice", "shubh"),
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
            
    logger.info(f"Loaded agent config successfully for inbound call. Agent: {agent.agent_name}, LLM: {llm_provider}, TTS: {tts_provider}, Tools Count: {len(tools_list)}")
    
    return {
        "agentName": agent.agent_name,
        "prompt": agent.prompt,
        "language": agent.language,
        "llm": llm_config,
        "tts": tts_config,
        "stt": stt_config,
        "tools": tools_list,
    }


