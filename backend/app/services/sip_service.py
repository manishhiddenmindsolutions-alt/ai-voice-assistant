import os
import uuid
import logging
from typing import Optional
from livekit import api
from app.core.config import settings

logger = logging.getLogger("sip-service")

class SIPService:
    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.url = settings.LIVEKIT_URL.replace("wss://", "https://") # LiveKit API uses HTTPS

    def get_livekit_client(self):
        return api.LiveKitAPI(
            url=self.url,
            api_key=self.api_key,
            api_secret=self.api_secret,
        )

    async def create_outbound_call(
        self, 
        to_number: str, 
        agent_config: dict,
        from_number: Optional[str] = None
    ):
        """
        Initiates an outbound call via LiveKit SIP.
        This creates a room and invites a SIP participant (the user's phone).
        """
        room_name = f"call_{uuid.uuid4().hex[:8]}"
        logger.info(f"Initiating outbound call to {to_number} in room {room_name}")

        client = self.get_livekit_client()
        try:
            # 1. Create a SIP Participant
            # Note: This requires a SIP Outbound Trunk to be configured in LiveKit
            # The 'sip_trunk_id' should be provided in the agent/user config or env
            sip_trunk_id = os.getenv("LIVEKIT_SIP_TRUNK_ID")
            
            if not sip_trunk_id:
                raise ValueError("LIVEKIT_SIP_TRUNK_ID is not configured. Cannot make outbound calls.")

            await client.sip.create_sip_participant(
                room_name=room_name,
                sip_trunk_id=sip_trunk_id,
                sip_number=to_number,
                participant_identity=f"phone_{to_number}",
                participant_name="User Mobile",
            )
            
            return {
                "room_name": room_name,
                "participant_identity": f"phone_{to_number}",
                "status": "initiated"
            }
        except Exception as e:
            logger.error(f"Failed to create SIP participant: {e}")
            raise e
        finally:
            await client.aclose()

sip_service = SIPService()
