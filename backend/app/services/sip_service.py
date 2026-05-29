import os
import uuid
import json
import logging
from typing import Optional
from livekit import api
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# pyrefly: ignore [missing-import]
from app.core.config import settings
# pyrefly: ignore [missing-import]
from app.models.orm import SIPTrunkORM, AgentORM

logger = logging.getLogger("sip-service")

class SIPService:
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.url = settings.LIVEKIT_URL.replace("wss://", "https://")  # LiveKit API uses HTTPS

    def get_livekit_client(self) -> api.LiveKitAPI:
        return api.LiveKitAPI(
            url=self.url,
            api_key=self.api_key,
            api_secret=self.api_secret,
        )

    async def create_outbound_call(
        self, 
        to_number: str, 
        agent: AgentORM,
        db: AsyncSession,
        from_number: Optional[str] = None
    ) -> dict:
        """
        Initiates an outbound call via LiveKit SIP with a two-step agent dispatch flow.
        1. Resolve active outbound SIP trunk (checks user provisioned trunks in DB first, falls back to env).
        2. Builds full agent metadata (prompt, models, voices, tools).
        3. Pre-dispatches the agent into the room.
        4. Invites the SIP participant to the same room.
        """
        room_name = f"call_{uuid.uuid4().hex[:8]}"
        logger.info(f"Initiating outbound SIP call to {to_number} in room {room_name}")

        # 1. Resolve Outbound SIP Trunk
        sip_trunk_id = None
        
        # Check if the user has a dynamically provisioned active outbound SIP trunk
        if agent.user_id:
            stmt = select(SIPTrunkORM).where(
                SIPTrunkORM.user_id == agent.user_id,
                SIPTrunkORM.trunk_type == "outbound",
                SIPTrunkORM.status == "active"
            )
            result = await db.execute(stmt)
            outbound_trunk = result.scalars().first()
            if outbound_trunk:
                sip_trunk_id = outbound_trunk.livekit_trunk_id
                logger.info(f"Resolved dynamic user SIP trunk: {sip_trunk_id}")

        # Fallback to env variable
        if not sip_trunk_id:
            sip_trunk_id = os.getenv("LIVEKIT_SIP_TRUNK_ID")
            logger.info(f"Resolved fallback system SIP trunk: {sip_trunk_id}")

        if not sip_trunk_id:
            raise ValueError(
                "No active Outbound SIP Trunk configured. Please provision one in the Telephony portal."
            )

        client = self.get_livekit_client()
        try:
            # 2. Build complete agent metadata (prompt, voice, llm, tools)
            # We import here to avoid circular imports
            from app.api.v1.endpoints.telephony import _build_agent_metadata
            agent_metadata = await _build_agent_metadata(agent, db)

            # 3. Step 1: Pre-dispatch AI agent into room
            logger.info(f"Step 1: Pre-dispatching agent to room '{room_name}'")
            await client.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name="voice-forge-agent-v5",
                    room=room_name,
                    metadata=agent_metadata,
                )
            )
            logger.info("Agent pre-dispatched successfully")

            # 4. Step 2: Create SIP participant (dial the customer)
            logger.info(f"Step 2: Dialing SIP Participant {to_number}")
            participant_identity = f"phone_{to_number.replace('+', '')}"
            req = api.CreateSIPParticipantRequest(
                sip_trunk_id=sip_trunk_id,
                sip_call_to=to_number,
                room_name=room_name,
                participant_identity=participant_identity,
                participant_name=f"Caller {to_number}",
                krisp_enabled=True,
            )
            
            result = await client.sip.create_sip_participant(req)
            logger.info(f"SIP Outbound call initiated successfully: Participant ID = {result.participant_id if hasattr(result, 'participant_id') else result}")

            return {
                "room_name": room_name,
                "participant_identity": participant_identity,
                "status": "initiated"
            }
        except Exception as e:
            logger.error(f"Failed to initiate outbound SIP call: {e}")
            raise e
        finally:
            await client.aclose()

sip_service = SIPService()
