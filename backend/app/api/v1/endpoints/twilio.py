import os
import uuid
import logging
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Response, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# pyrefly: ignore [missing-import]
from app.db.session import get_db
# pyrefly: ignore [missing-import]
from app.models.orm import UserORM, AgentORM, CallORM, CallDirection, PhoneNumberORM
# pyrefly: ignore [missing-import]
from app.api.deps import get_current_user
# pyrefly: ignore [missing-import]
from app.core.security import vault
# pyrefly: ignore [missing-import]
from app.services.livekit_service import livekit_service

logger = logging.getLogger("twilio-telephony")
router = APIRouter()

# --- SCHEMAS ---
class TwilioOutboundRequest(BaseModel):
    to_number: str
    agent_id: str

# --- ENDPOINTS ---

@router.post("/outbound")
async def trigger_twilio_outbound(
    payload: TwilioOutboundRequest,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Initiates an outbound call via Twilio REST API (legacy fallback).
    1. Fetch decrypted Twilio credentials from current user secrets.
    2. Create dynamic room name.
    3. Dispatch the AI agent into the room FIRST.
    4. Register initiated CallORM in database.
    5. Call Twilio Calls API.
    """
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
    result = await db.execute(select(AgentORM).where(AgentORM.id == payload.agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Selected Voice Agent not found.")

    # 3. Setup Call Room
    room_name = f"twilio_{uuid.uuid4().hex[:8]}"
    
    # 3b. Dispatch Agent into the room FIRST so it's ready when SIP connects
    try:
        import json as _json
        agent_config = agent.config or {}
        agent_meta = _json.dumps({
            "agentName": agent.agent_name,
            "prompt": agent.prompt,
            "language": agent.language,
            "llm": agent_config.get("llm", {}),
            "tts": agent_config.get("tts", {}),
            "stt": agent_config.get("stt", {}),
            "tools": [],
        })
        await livekit_service.dispatch_agent(
            room_name=room_name,
            agent_name="voice-forge-agent-v5",
            metadata=_json.loads(agent_meta)
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
    
    logger.info(f"Triggering Twilio outbound call: To={payload.to_number}, From={twilio_number}")
    
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


@router.post("/flow")
@router.get("/flow")
async def handle_twilio_outbound_flow(
    agent_id: str,
    room: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Invoked by Twilio when the customer answers the outbound call.
    Returns a Gather TwiML block to bypass the trial gate by capturing a keypress before dialing LiveKit.
    """
    logger.info(f"Twilio callback flow received (Gather Gate): Agent={agent_id}, Room={room}")
    
    # We gather 1 digit to absorb the trial account bypass keypress.
    # Fallback to Redirect if no digit is pressed.
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather action="/api/v1/telephony/twilio/flow-bridge?agent_id={agent_id}&amp;room={room}" numDigits="1" timeout="8" method="POST">
        <Say>Connecting your call. Please press any key to speak with your assistant.</Say>
    </Gather>
    <Redirect method="POST">/api/v1/telephony/twilio/flow-bridge?agent_id={agent_id}&amp;room={room}</Redirect>
</Response>"""
    
    return Response(content=twiml, media_type="application/xml")


@router.post("/flow-bridge")
@router.get("/flow-bridge")
async def handle_twilio_flow_bridge(
    agent_id: str,
    room: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Invoked after the customer bypasses the Gather block (either by pressing a key or timing out).
    Returns the TwiML XML to dial LiveKit SIP. The agent has already been dispatched to the room.
    """
    logger.info(f"Twilio flow bridge triggered: Agent={agent_id}, Room={room}")
    
    from dotenv import load_dotenv
    dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../.env.local"))
    load_dotenv(dotenv_path, override=True)
    
    lk_sip_domain = os.getenv("LIVEKIT_SIP_DOMAIN", "sip.livekit.cloud")
    
    # Resolve the caller's registered number dynamically from the call record
    call_result = await db.execute(
        select(CallORM).where(CallORM.session_id == room)
    )
    call_rec = call_result.scalar_one_or_none()
    sip_number = call_rec.from_number if call_rec and call_rec.from_number else "+10000000000"
    
    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'
    # Dial into the LiveKit SIP domain — the agent is already dispatched to this room
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>sip:{sip_number}@{lk_sip_domain};transport=tcp</Sip>
    </Dial>
</Response>"""
    
    return Response(content=twiml, media_type="application/xml")


async def process_inbound_call(From: str, To: str, db: AsyncSession):
    # Clean dialed number to match DB format
    dialed_number = To.strip().replace(" ", "").replace("+", "")
    caller_number = From.strip()
    
    logger.info(f"Twilio Incoming Call: Dialed={dialed_number}, Caller={caller_number}")

    # 1. Resolve registered PhoneNumberORM
    stmt = select(PhoneNumberORM).where(
        (PhoneNumberORM.number == dialed_number) |
        (PhoneNumberORM.number == f"+{dialed_number}")
    )
    result = await db.execute(stmt)
    db_number = result.scalar_one_or_none()
    
    if not db_number or not db_number.agent_id:
        logger.warning(f"No configured voice agent mapped to inbound number: {dialed_number}")
        busy_twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>The voice assistant is currently busy. Please try again later.</Say>
    <Hangup />
</Response>"""
        return Response(content=busy_twiml, media_type="application/xml")

    # 2. Fetch Agent details
    result = await db.execute(select(AgentORM).where(AgentORM.id == db_number.agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        logger.error(f"Assigned agent {db_number.agent_id} not found in database.")
        error_twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>System error: agent offline.</Say>
    <Hangup />
</Response>"""
        return Response(content=error_twiml, media_type="application/xml")

    # 3. Log Call in DB
    db_call = CallORM(
        user_id=db_number.user_id,
        agent_id=agent.id,
        session_id=f"inbound_pending_{uuid.uuid4().hex[:6]}",
        from_number=caller_number,
        to_number=db_number.number,
        direction=CallDirection.INBOUND,
        status="connecting"
    )
    db.add(db_call)
    await db.commit()

    # 4. Return dynamic TwiML Dialing SIP using the actual dialed number
    from dotenv import load_dotenv
    dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../../.env.local"))
    load_dotenv(dotenv_path, override=True)
    
    lk_sip_domain = os.getenv("LIVEKIT_SIP_DOMAIN", "sip.livekit.cloud")
    sip_number = db_number.number if db_number.number.startswith("+") else f"+{db_number.number}"
    
    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'
        
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>sip:{sip_number}@{lk_sip_domain}:5061;transport=tls</Sip>
    </Dial>
</Response>"""
    
    return Response(content=twiml, media_type="application/xml")


@router.post("/inbound")
async def handle_twilio_inbound_call(
    From: str = Form(...),
    To: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Invoked by Twilio POST request when someone dials the Twilio number.
    """
    return await process_inbound_call(From=From, To=To, db=db)


@router.get("/inbound")
async def handle_twilio_inbound_call_get(
    From: str,
    To: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Invoked by Twilio GET request when someone dials the Twilio number.
    """
    return await process_inbound_call(From=From, To=To, db=db)
