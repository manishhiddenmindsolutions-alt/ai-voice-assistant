from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc, case
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from datetime import datetime, timedelta
# pyrefly: ignore [missing-import]
from app.db.session import get_db
# pyrefly: ignore [missing-import]
from app.models.orm import AgentORM, UserORM, TranscriptORM, CallORM, CallDirection
# pyrefly: ignore [missing-import]
from app.api.deps import get_current_user
import uuid
# pyrefly: ignore [missing-import]
from app.db.session import get_db

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

class TranscriptItem(BaseModel):
    role: str
    content: str
    timestamp: datetime

    class Config:
        from_attributes = True

class TranscriptLogRequest(BaseModel):
    role: str
    content: str

# --- ENDPOINTS ---

@router.post("/outbound", response_model=CallResponse)
async def trigger_outbound_call(request: OutboundCallRequest, db: AsyncSession = Depends(get_db)):
    """
    Triggers an outbound mobile call.
    1. Fetch agent with preloaded tools.
    2. Call LiveKit SIP Service.
    3. Log the call in DB.
    """
    # pyrefly: ignore [missing-import]
    from app.services.sip_service import sip_service
    from sqlalchemy.orm import selectinload
    
    # 1. Verify Agent
    result = await db.execute(
        select(AgentORM).options(selectinload(AgentORM.tools)).where(AgentORM.id == request.agent_id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # 2. Trigger SIP Call
    try:
        sip_result = await sip_service.create_outbound_call(
            to_number=request.to_number,
            agent=agent,
            db=db,
            from_number=request.from_number
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
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_calls(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    direction: Optional[str] = Query(None, description="Filter by direction: inbound or outbound"),
    status: Optional[str] = Query(None, description="Filter by status"),
    agent_id: Optional[str] = Query(None, description="Filter by agent"),
    days: int = Query(30, description="Number of days to look back"),
    limit: int = Query(100, description="Max results"),
    offset: int = Query(0, description="Pagination offset"),
):
    """
    Enhanced call listing with filters, agent name resolution, and transcript counts.
    """
    # Base query
    stmt = (
        select(CallORM)
        .where(CallORM.user_id == current_user.id)
        .order_by(desc(CallORM.started_at))
    )
    
    # Apply filters
    if direction:
        dir_enum = CallDirection.INBOUND if direction == "inbound" else CallDirection.OUTBOUND
        stmt = stmt.where(CallORM.direction == dir_enum)
    if status:
        stmt = stmt.where(CallORM.status == status)
    if agent_id:
        stmt = stmt.where(CallORM.agent_id == agent_id)
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        stmt = stmt.where(CallORM.started_at >= cutoff)
    
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    calls = result.scalars().all()
    
    # Resolve agent names and transcript counts
    agent_ids = list(set(c.agent_id for c in calls if c.agent_id))
    agent_map = {}
    if agent_ids:
        agent_result = await db.execute(
            select(AgentORM).where(AgentORM.id.in_(agent_ids))
        )
        for a in agent_result.scalars().all():
            agent_map[a.id] = a.agent_name
    
    # Get transcript counts per call
    call_ids = [c.id for c in calls]
    transcript_counts = {}
    if call_ids:
        tc_result = await db.execute(
            select(TranscriptORM.call_id, func.count(TranscriptORM.id))
            .where(TranscriptORM.call_id.in_(call_ids))
            .group_by(TranscriptORM.call_id)
        )
        for call_id, count in tc_result.all():
            transcript_counts[call_id] = count
    
    # Get total count for pagination
    count_stmt = select(func.count(CallORM.id)).where(CallORM.user_id == current_user.id)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    
    return {
        "calls": [
            {
                "id": c.id,
                "session_id": c.session_id,
                "agent_id": c.agent_id,
                "agent_name": agent_map.get(c.agent_id, "Unknown Agent"),
                "from_number": c.from_number,
                "to_number": c.to_number,
                "direction": c.direction.value if c.direction else "outbound",
                "status": c.status,
                "duration_seconds": c.duration_seconds or 0,
                "tokens_used": c.tokens_used or 0,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "ended_at": c.ended_at.isoformat() if c.ended_at else None,
                "transcript_count": transcript_counts.get(c.id, 0),
            }
            for c in calls
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/{call_id}")
async def get_call_detail(
    call_id: str,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed info about a specific call including transcripts."""
    stmt = select(CallORM).where(
        CallORM.id == call_id,
        CallORM.user_id == current_user.id
    )
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # Get agent name
    agent_name = "Unknown Agent"
    if call.agent_id:
        agent_result = await db.execute(
            select(AgentORM).where(AgentORM.id == call.agent_id)
        )
        agent = agent_result.scalar_one_or_none()
        if agent:
            agent_name = agent.agent_name
    
    # Get transcripts
    transcript_result = await db.execute(
        select(TranscriptORM)
        .where(TranscriptORM.call_id == call_id)
        .order_by(TranscriptORM.timestamp)
    )
    transcripts = transcript_result.scalars().all()
    
    return {
        "id": call.id,
        "session_id": call.session_id,
        "agent_id": call.agent_id,
        "agent_name": agent_name,
        "from_number": call.from_number,
        "to_number": call.to_number,
        "direction": call.direction.value if call.direction else "outbound",
        "status": call.status,
        "duration_seconds": call.duration_seconds or 0,
        "tokens_used": call.tokens_used or 0,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "ended_at": call.ended_at.isoformat() if call.ended_at else None,
        "transcripts": [
            {
                "role": t.role,
                "content": t.content,
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
            }
            for t in transcripts
        ],
    }


@router.get("/{call_id}/transcripts")
async def get_call_transcripts(call_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TranscriptORM)
        .where(TranscriptORM.call_id == call_id)
        .order_by(TranscriptORM.timestamp)
    )
    return result.scalars().all()


@router.post("/sessions/{session_id}/transcripts")
async def log_transcript_by_session(
    session_id: str, 
    payload: TranscriptLogRequest,
    db: AsyncSession = Depends(get_db)
):
    """Log a transcript entry by session/room name. Called by the agent worker."""
    # 1. Resolve call_id
    stmt = select(CallORM).where(CallORM.session_id == session_id)
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    
    if not call:
        return {"status": "ignored", "reason": "session not found"}

    # 2. Log transcript
    db_transcript = TranscriptORM(
        call_id=call.id,
        role=payload.role,
        content=payload.content
    )
    db.add(db_transcript)
    
    # 3. Update call status to active if still connecting
    if call.status in ("connecting", "initiated"):
        call.status = "active"
    
    await db.commit()
    return {"status": "ok"}


@router.put("/{call_id}/status")
async def update_call_status(
    call_id: str,
    status: str = Query(...),
    duration: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Update call status (used by webhooks or agent completion callbacks)."""
    stmt = select(CallORM).where(CallORM.id == call_id)
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()
    
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    call.status = status
    if duration is not None:
        call.duration_seconds = duration
    if status in ("completed", "failed", "ended"):
        call.ended_at = datetime.utcnow()
    
    await db.commit()
    return {"status": "ok", "call_id": call_id}
