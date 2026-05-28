"""
FreeSWITCH Telephony API — Dynamic Dialplans, Real-time WebSocket Audio Gateway, and ESL Dialout.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.services.freeswitch_service import freeswitch_service
from app.services.freeswitch_media_gateway import FreeSWITCHMediaSession

logger = logging.getLogger("freeswitch-api")
router = APIRouter()


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class FreeSWITCHOutboundRequest(BaseModel):
    to_number: str
    agent_id: str
    gateway: str
    caller_id: Optional[str] = "+1234567890"


# ─── DYNAMIC XML DIALPLAN SERVER ─────────────────────────────────────────────

@router.get("/dialplan")
async def get_freeswitch_dialplan(
    destination_number: str = Query(..., alias="Destination-Number"),
    db: AsyncSession = Depends(get_db)
):
    """
    HTTP XML Dialplan lookup for FreeSWITCH.
    Dynamically routes incoming call extensions to their respective AI voice agents.
    """
    logger.info(f"Received Dialplan request from FreeSWITCH for number: {destination_number}")
    xml_content = await freeswitch_service.generate_inbound_dialplan(destination_number, db)
    return Response(content=xml_content, media_type="application/xml")


# ─── WEBSOCKET MEDIA GATEWAY ─────────────────────────────────────────────────

@router.websocket("/media/{agent_id}")
async def websocket_media_bridge(websocket: WebSocket, agent_id: str):
    """
    WebSocket endpoint for bidirectional real-time linear PCM call audio.
    Processes user speech via VAD/STT/LLM and returns synthesized agent speech to FreeSWITCH.
    """
    await websocket.accept()
    logger.info(f"Accepted FreeSWITCH raw PCM audio WebSocket bridge for agent {agent_id}")
    
    session = FreeSWITCHMediaSession(websocket, agent_id)
    try:
        await session.initialize()
        
        while True:
            # Receive binary frame of raw PCM audio bytes
            data = await websocket.receive_bytes()
            await session.handle_inbound_audio(data)
            
    except WebSocketDisconnect:
        logger.info(f"FreeSWITCH media bridge disconnected for agent {agent_id}")
    except Exception as e:
        logger.error(f"Error in FreeSWITCH raw media WebSocket connection: {e}")
    finally:
        session.close()


# ─── EVENT SOCKET (ESL) OUTBOUND CALL ────────────────────────────────────────

@router.post("/outbound")
async def trigger_freeswitch_outbound(
    payload: FreeSWITCHOutboundRequest
):
    """
    Originate an outbound call via FreeSWITCH Event Socket (ESL).
    """
    try:
        result = await freeswitch_service.dial_outbound(
            gateway=payload.gateway,
            to_number=payload.to_number,
            agent_id=payload.agent_id,
            caller_id=payload.caller_id
        )
        return result
    except Exception as e:
        logger.error(f"Failed to place outbound FreeSWITCH call: {e}")
        raise HTTPException(status_code=500, detail=str(e))
