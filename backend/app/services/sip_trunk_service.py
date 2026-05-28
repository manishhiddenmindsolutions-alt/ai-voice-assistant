"""
SIP Trunk Service — Programmatic LiveKit SIP Trunk & Dispatch Rule Management.

Handles per-user provisioning of:
- Inbound SIP Trunks (for receiving calls via Twilio → LiveKit)
- Outbound SIP Trunks (for placing calls via LiveKit → Twilio)
- Dispatch Rules (auto-routing inbound calls to voice agents)
- SIP Participants (initiating outbound calls)
"""
import os
import uuid
import logging
from typing import Optional, List
from livekit import api
# pyre-ignore[missing-import]
from app.core.config import settings

logger = logging.getLogger("sip-trunk-service")


class SIPTrunkService:
    """Manages LiveKit SIP resources for multi-user telephony."""

    def __init__(self):
        self.api_key = settings.LIVEKIT_API_KEY
        self.api_secret = settings.LIVEKIT_API_SECRET
        self.url = settings.LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://")

    def _get_client(self) -> api.LiveKitAPI:
        return api.LiveKitAPI(
            url=self.url,
            api_key=self.api_key,
            api_secret=self.api_secret,
        )

    # ─── INBOUND TRUNK ──────────────────────────────────────────────────────

    async def create_inbound_trunk(
        self,
        name: str,
        numbers: List[str],
        allowed_addresses: Optional[List[str]] = None,
    ) -> dict:
        """
        Creates a LiveKit SIP Inbound Trunk.
        This allows LiveKit to accept incoming SIP calls from the carrier (Twilio).
        
        Args:
            name: Human-readable trunk name
            numbers: List of E.164 phone numbers associated with this trunk
            allowed_addresses: Optional IP allowlist for security
        """
        client = self._get_client()
        try:
            trunk_info = api.SIPInboundTrunkInfo(
                name=name,
                numbers=numbers,
            )
            if allowed_addresses:
                trunk_info.allowed_addresses = allowed_addresses

            request = api.CreateSIPInboundTrunkRequest(trunk=trunk_info)
            result = await client.sip.create_sip_inbound_trunk(request)
            
            trunk_id = result.sip_trunk_id
            logger.info(f"Created Inbound SIP Trunk: {trunk_id} ({name}) for numbers: {numbers}")
            
            return {
                "trunk_id": trunk_id,
                "name": name,
                "numbers": numbers,
                "type": "inbound",
            }
        except Exception as e:
            logger.error(f"Failed to create inbound SIP trunk: {e}")
            raise
        finally:
            await client.aclose()

    # ─── OUTBOUND TRUNK ─────────────────────────────────────────────────────

    async def create_outbound_trunk(
        self,
        name: str,
        address: str,
        numbers: List[str],
        auth_username: str,
        auth_password: str,
    ) -> dict:
        """
        Creates a LiveKit SIP Outbound Trunk.
        This allows LiveKit to place outgoing calls through the carrier (Twilio SIP).
        
        Args:
            name: Human-readable trunk name
            address: Twilio SIP Termination URI (e.g., "my-trunk.pstn.twilio.com")
            numbers: Caller ID phone numbers (E.164)
            auth_username: SIP auth username (from Twilio Credential List)
            auth_password: SIP auth password
        """
        client = self._get_client()
        try:
            trunk_info = api.SIPOutboundTrunkInfo(
                name=name,
                address=address,
                numbers=numbers,
                auth_username=auth_username,
                auth_password=auth_password,
            )

            request = api.CreateSIPOutboundTrunkRequest(trunk=trunk_info)
            result = await client.sip.create_sip_outbound_trunk(request)
            
            trunk_id = result.sip_trunk_id
            logger.info(f"Created Outbound SIP Trunk: {trunk_id} ({name}) → {address}")
            
            return {
                "trunk_id": trunk_id,
                "name": name,
                "address": address,
                "numbers": numbers,
                "type": "outbound",
            }
        except Exception as e:
            logger.error(f"Failed to create outbound SIP trunk: {e}")
            raise
        finally:
            await client.aclose()

    # ─── DISPATCH RULE ───────────────────────────────────────────────────────

    async def create_dispatch_rule(
        self,
        trunk_ids: List[str],
        agent_name: str = "voice-forge-agent-v5",
        room_prefix: str = "sip-call-",
        metadata: str = "",
    ) -> dict:
        """
        Creates a SIP Dispatch Rule that auto-routes inbound calls to a LiveKit room
        and dispatches the specified voice agent.
        
        Args:
            trunk_ids: List of inbound trunk IDs this rule applies to
            agent_name: Agent worker name to dispatch
            room_prefix: Prefix for auto-created rooms
            metadata: Optional metadata string passed to the agent
        """
        client = self._get_client()
        try:
            rule = api.SIPDispatchRule(
                dispatch_rule_individual=api.SIPDispatchRuleIndividual(
                    room_prefix=room_prefix
                )
            )

            room_config = api.RoomConfiguration(
                agents=[
                    api.RoomAgentDispatch(
                        agent_name=agent_name,
                        metadata=metadata,
                    )
                ]
            )

            request = api.CreateSIPDispatchRuleRequest(
                rule=rule,
                name=f"dispatch-{room_prefix}",
                trunk_ids=trunk_ids,
                room_config=room_config,
            )

            result = await client.sip.create_sip_dispatch_rule(request)
            rule_id = result.sip_dispatch_rule_id
            logger.info(f"Created Dispatch Rule: {rule_id} for trunks: {trunk_ids}")
            
            return {
                "dispatch_rule_id": rule_id,
                "trunk_ids": trunk_ids,
                "agent_name": agent_name,
                "room_prefix": room_prefix,
            }
        except Exception as e:
            logger.error(f"Failed to create dispatch rule: {e}")
            raise
        finally:
            await client.aclose()

    # ─── OUTBOUND CALL (SIP PARTICIPANT) ─────────────────────────────────────

    async def dial_outbound(
        self,
        outbound_trunk_id: str,
        to_number: str,
        room_name: Optional[str] = None,
        agent_name: str = "voice-forge-agent-v5",
        participant_identity: Optional[str] = None,
        metadata: str = "",
    ) -> dict:
        """
        Initiates an outbound call via LiveKit SIP using the correct two-step flow:
        1. Dispatch the AI agent into the room (so it's ready when the call connects)
        2. Create a SIP participant (dials the customer's phone)
        
        Args:
            outbound_trunk_id: The LiveKit outbound trunk ID to use
            to_number: Customer phone number in E.164 format
            room_name: Room to place the call in (auto-generated if not provided)
            agent_name: Agent worker name to dispatch
            participant_identity: Identity for the SIP participant
            metadata: JSON metadata string with agent config (prompt, language, etc.)
        """
        if not room_name:
            room_name = f"outbound_{uuid.uuid4().hex[:8]}"
        
        if not participant_identity:
            participant_identity = f"phone_{to_number.replace('+', '')}"

        client = self._get_client()
        try:
            # ── STEP 1: Dispatch the AI agent into the room FIRST ──
            # This is CRITICAL — without this, the phone connects but no agent speaks.
            logger.info(f"Step 1: Dispatching agent '{agent_name}' to room '{room_name}' with metadata")
            await client.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name=agent_name,
                    room=room_name,
                    metadata=metadata,
                )
            )
            logger.info(f"Agent '{agent_name}' dispatched to room '{room_name}'")

            # ── STEP 2: Create SIP participant (dials the phone) ──
            logger.info(f"Step 2: Dialing {to_number} via SIP trunk {outbound_trunk_id}")
            request = api.CreateSIPParticipantRequest(
                sip_trunk_id=outbound_trunk_id,
                sip_call_to=to_number,
                room_name=room_name,
                participant_identity=participant_identity,
                participant_name=f"Caller {to_number}",
            )

            result = await client.sip.create_sip_participant(request)
            logger.info(f"Outbound call initiated: {to_number} in room {room_name} via trunk {outbound_trunk_id}")
            
            return {
                "room_name": room_name,
                "participant_id": result.participant_id if hasattr(result, 'participant_id') else str(result),
                "participant_identity": participant_identity,
                "status": "initiated",
            }
        except Exception as e:
            logger.error(f"Failed to dial outbound SIP call to {to_number}: {e}")
            raise
        finally:
            await client.aclose()

    # ─── TRUNK MANAGEMENT ────────────────────────────────────────────────────

    async def list_inbound_trunks(self) -> list:
        """Lists all inbound SIP trunks on the LiveKit project."""
        client = self._get_client()
        try:
            result = await client.sip.list_sip_inbound_trunk(api.ListSIPInboundTrunkRequest())
            return [
                {
                    "trunk_id": t.sip_trunk_id,
                    "name": t.name,
                    "numbers": list(t.numbers),
                }
                for t in result.items
            ]
        except Exception as e:
            logger.error(f"Failed to list inbound trunks: {e}")
            return []
        finally:
            await client.aclose()

    async def list_outbound_trunks(self) -> list:
        """Lists all outbound SIP trunks on the LiveKit project."""
        client = self._get_client()
        try:
            result = await client.sip.list_sip_outbound_trunk(api.ListSIPOutboundTrunkRequest())
            return [
                {
                    "trunk_id": t.sip_trunk_id,
                    "name": t.name,
                    "address": t.address,
                    "numbers": list(t.numbers),
                }
                for t in result.items
            ]
        except Exception as e:
            logger.error(f"Failed to list outbound trunks: {e}")
            return []
        finally:
            await client.aclose()

    async def delete_trunk(self, trunk_id: str, trunk_type: str = "inbound") -> bool:
        """Deletes a SIP trunk from LiveKit."""
        client = self._get_client()
        try:
            if trunk_type == "inbound":
                await client.sip.delete_sip_trunk(api.DeleteSIPTrunkRequest(sip_trunk_id=trunk_id))
            else:
                await client.sip.delete_sip_trunk(api.DeleteSIPTrunkRequest(sip_trunk_id=trunk_id))
            logger.info(f"Deleted SIP trunk: {trunk_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete SIP trunk {trunk_id}: {e}")
            return False
        finally:
            await client.aclose()

    async def delete_dispatch_rule(self, rule_id: str) -> bool:
        """Deletes a SIP dispatch rule from LiveKit."""
        client = self._get_client()
        try:
            await client.sip.delete_sip_dispatch_rule(
                api.DeleteSIPDispatchRuleRequest(sip_dispatch_rule_id=rule_id)
            )
            logger.info(f"Deleted dispatch rule: {rule_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete dispatch rule {rule_id}: {e}")
            return False
        finally:
            await client.aclose()


sip_trunk_service = SIPTrunkService()
