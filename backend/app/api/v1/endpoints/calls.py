from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime
from app.db.session import get_db
from app.models.orm import CallORM, AgentORM, CallDirection
from app.services.sip_service import sip_service
import uuid

router = APIRouter()

# --- SCHEMAS ---
class OutboundCallRequest(BaseModel):
    to_number: str = "+1234567890"
    from_number: Optional[str] = None
    agent_id: str
    user_id: str = "default_user"

class CallResponse(BaseModel):
    id: str
    session_id: str # Room Name
    status: str
    started_at: datetime

    class Config:
        from_attributes = True

# --- ENDPOINTS ---

@router.post("/outbound", response_model=CallResponse)
async def trigger_outbound_call(request: OutboundCallRequest, db: AsyncSession = Depends(get_db)):
    """
    Triggers an outbound mobile call.
    1. Fetch agent config.
    2. Call LiveKit SIP Service.
    3. Log the call in DB.
    """
    # 1. Verify Agent
    result = await db.execute(select(AgentORM).where(AgentORM.id == request.agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 2. Trigger SIP Call
    try:
        sip_result = await sip_service.create_outbound_call(
            to_number=request.to_number,
            from_number=request.from_number,
            agent_config=agent.config
        )
        
        # 3. Log Call
        db_call = CallORM(
            user_id=request.user_id,
            agent_id=request.agent_id,
            session_id=sip_result["room_name"],
            from_number=request.from_number,
            to_number=request.to_number,
            direction=CallDirection.OUTBOUND,
            status="initiated"
        )
        db.add(db_call)
        await db.commit()
        await db.refresh(db_call)
        
        return db_call
        
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"User ID '{request.user_id}' does not exist.")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[CallResponse])
async def list_calls(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CallORM).where(CallORM.user_id == user_id))
    return result.scalars().all()

@router.get("/{call_id}/transcripts")
async def get_call_transcripts(call_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.orm import TranscriptORM
    result = await db.execute(select(TranscriptORM).where(TranscriptORM.call_id == call_id))
    return result.scalars().all()

@router.post("/sessions/{session_id}/transcripts")
async def log_transcript_by_session(
    session_id: str, 
    role: str, 
    content: str, 
    db: AsyncSession = Depends(get_db)
):
    from app.models.orm import TranscriptORM
    # 1. Resolve call_id
    stmt = select(CallORM).where(CallORM.session_id == session_id)
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    
    if not call:
        # If no call found, this might be a web session. 
        # We should create a dummy call log for web sessions too to keep logs consistent.
        # But for now, just Return 404 or ignore.
        return {"status": "ignored", "reason": "session not found"}

    # 2. Log transcript
    db_transcript = TranscriptORM(
        call_id=call.id,
        role=role,
        content=content
    )
    db.add(db_transcript)
    await db.commit()
    return {"status": "ok"}

