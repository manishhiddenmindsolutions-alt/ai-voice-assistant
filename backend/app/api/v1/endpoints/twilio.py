"""
Twilio Telephony Endpoints — Inbound Call Routing & Outbound Fallback.

This module handles the Twilio REST → TwiML → LiveKit call path:

  POST /telephony/twilio/inbound     — Twilio webhook for inbound calls
  GET  /telephony/twilio/inbound     — Same (Twilio can use GET or POST)
  POST /telephony/twilio/outbound    — Trigger outbound call (trial accounts)
  POST /telephony/twilio/flow        — TwiML callback when called party answers
  POST /telephony/twilio/flow-bridge — Bridges caller into LiveKit SIP room

Architecture note (IMPORTANT):
  For the Twilio trial outbound path, the flow is:
    1. Backend calls Twilio REST API → Twilio dials customer
    2. Customer answers → Twilio calls /flow (our webhook)
    3. /flow returns TwiML with <Dial><Sip> pointing to LiveKit SIP gateway
    4. LiveKit SIP gateway receives the SIP call → matches inbound dispatch rule
    5. LiveKit dispatch rule auto-spawns the agent into a fresh room

  DO NOT pre-dispatch agents in this path. LiveKit's dispatch rule handles
  agent spawning automatically when the SIP leg arrives. Pre-dispatching
  creates orphaned agents waiting in rooms that the SIP call never joins.

Security:
  - Twilio webhook signature verification (X-Twilio-Signature header)
  - All credential access from encrypted user secrets
"""

import asyncio
import os
import uuid
import hmac
import hashlib
import base64
import logging
from urllib.parse import urlencode, quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.orm import UserORM, AgentORM, CallORM, CallDirection, PhoneNumberORM
from app.api.deps import get_current_user
from app.core.security import vault
from app.services.agent_metadata_service import build_agent_metadata

logger = logging.getLogger("twilio")
router = APIRouter()

_AGENT_WORKER_NAME = os.getenv("LIVEKIT_AGENT_NAME", "voice-forge-agent-v5")
_TWILIO_TRIAL = os.getenv("TWILIO_TRIAL_ACCOUNT", "false").lower() == "true"


# ─── TWILIO SIGNATURE VERIFICATION ───────────────────────────────────────────

def _verify_twilio_signature(
    auth_token: str,
    url: str,
    post_params: dict,
    signature: str,
) -> bool:
    """
    Verifies Twilio's HMAC-SHA1 request signature.
    https://www.twilio.com/docs/usage/webhooks/webhooks-security
    """
    s = url
    for key in sorted(post_params.keys()):
        s += key + (post_params[key] or "")

    expected = base64.b64encode(
        hmac.new(auth_token.encode(), s.encode(), hashlib.sha1).digest()
    ).decode()

    return hmac.compare_digest(expected, signature)


# ─── INBOUND CALL HANDLER ────────────────────────────────────────────────────

async def _process_inbound_call(
    From: str,
    To: str,
    request: Request,
    db: AsyncSession,
    form_params: dict | None = None,
) -> Response:
    """
    Core inbound call logic.

    When someone dials a Twilio number:
      1. Look up the PhoneNumberORM to find the linked agent.
      2. Log the call in DB.
      3. Return TwiML that dials into LiveKit SIP.

    The LiveKit SIP gateway receives the call, matches the inbound trunk
    dispatch rule, and dispatches the agent into a fresh room automatically.
    """
    caller = From.strip()
    dialed_raw = To.strip()
    dialed_clean = dialed_raw.lstrip("+").replace(" ", "")

    logger.info(f"[Inbound] Twilio call: From={caller} To={dialed_raw}")

    # ── 1. Find phone number record ──────────────────────────────────────────
    stmt = (
        select(PhoneNumberORM)
        .options(selectinload(PhoneNumberORM.user))
        .where(
            (PhoneNumberORM.number == dialed_raw) |
            (PhoneNumberORM.number == dialed_clean) |
            (PhoneNumberORM.number == f"+{dialed_clean}")
        )
    )
    result = await db.execute(stmt)
    db_number = result.scalar_one_or_none()

    # ── 2. Verify Twilio webhook signature ───────────────────────────────────
    twilio_sig = request.headers.get("X-Twilio-Signature", "")
    if twilio_sig and db_number:
        user = db_number.user
        if user and user.secrets and user.secrets.get("twilio_auth_token"):
            try:
                auth_token = vault.decrypt(user.secrets["twilio_auth_token"])
                if not _verify_twilio_signature(auth_token, str(request.url), form_params or {}, twilio_sig):
                    logger.warning(f"[Inbound] Twilio signature verification FAILED for {dialed_raw}")
                    return Response(
                        content=_twiml_hangup("Authentication failed."),
                        media_type="application/xml",
                    )
            except Exception as sig_exc:
                logger.warning(f"[Inbound] Could not verify Twilio signature: {sig_exc}")

    if not db_number or not db_number.agent_id:
        logger.warning(f"[Inbound] No agent mapped to number: {dialed_raw}")
        return Response(
            content=_twiml_hangup("The voice assistant is not available for this number."),
            media_type="application/xml",
        )

    # ── 3. Fetch agent ───────────────────────────────────────────────────────
    agent_result = await db.execute(
        select(AgentORM)
        .options(selectinload(AgentORM.tools))
        .where(AgentORM.id == db_number.agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        logger.error(f"[Inbound] Agent {db_number.agent_id} not found")
        return Response(
            content=_twiml_hangup("System error: voice agent offline."),
            media_type="application/xml",
        )

    # ── 4. Log call ──────────────────────────────────────────────────────────
    db_call = CallORM(
        id=str(uuid.uuid4()),
        user_id=db_number.user_id,
        agent_id=agent.id,
        session_id=f"inbound-pending-{uuid.uuid4().hex[:6]}",
        from_number=caller,
        to_number=dialed_raw,
        direction=CallDirection.INBOUND,
        status="connecting",
    )
    db.add(db_call)
    await db.commit()

    # ── 5. Build TwiML to dial into LiveKit SIP ──────────────────────────────
    from app.core.config import settings
    lk_sip_domain = settings.LIVEKIT_SIP_DOMAIN
    # Use the dialed number so LiveKit's inbound trunk matches it
    sip_number = dialed_raw if dialed_raw.startswith("+") else f"+{dialed_clean}"

    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME", "")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD", "")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'

    # Use TLS on port 5061 — required for LiveKit Cloud SIP
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>sip:{sip_number}@{lk_sip_domain};transport=tcp</Sip>
    </Dial>
</Response>"""

    logger.info(f"[Inbound] Routing {caller} → LiveKit SIP {sip_number}@{lk_sip_domain}")
    return Response(content=twiml, media_type="application/xml")


@router.post("/inbound")
async def handle_twilio_inbound_post(
    request: Request,
    From: str = Form(...),
    To: str = Form(...),
    CallSid: str = Form(default=""),
    db: AsyncSession = Depends(get_db),
):
    """Twilio POST webhook for inbound calls."""
    form_params = {"From": From, "To": To}
    if CallSid:
        form_params["CallSid"] = CallSid
    return await _process_inbound_call(From=From, To=To, request=request, db=db, form_params=form_params)


@router.get("/inbound")
async def handle_twilio_inbound_get(
    request: Request,
    From: str,
    To: str,
    db: AsyncSession = Depends(get_db),
):
    """Twilio GET webhook for inbound calls."""
    return await _process_inbound_call(From=From, To=To, request=request, db=db, form_params={"From": From, "To": To})


# ─── OUTBOUND FALLBACK PATH (TWILIO REST → TWIML → LIVEKIT) ─────────────────

async def _trigger_twilio_outbound_internal(
    *,
    to_number: str,
    agent_id: str,
    current_user: UserORM,
    db: AsyncSession,
) -> dict:
    """
    Twilio REST outbound fallback — used for trial accounts.

    Steps:
      1. Decrypt Twilio credentials from user secrets.
      2. Verify agent exists.
      3. Log CallORM with status='connecting'.
      4. POST to Twilio Calls API with a TwiML callback URL.
         Twilio dials the customer; when they answer, Twilio fetches
         /flow which returns TwiML to bridge the call into LiveKit SIP.
         LiveKit's inbound dispatch rule then auto-spawns the agent.

    NOTE: We do NOT pre-dispatch the agent here. LiveKit's SIP dispatch rule
    handles agent spawning automatically when Twilio's SIP leg arrives.
    Pre-dispatching would create an orphaned agent in a room that the SIP
    call never joins (LiveKit creates its own room name for inbound SIP).
    """
    secrets = current_user.secrets or {}

    # ── 1. Credentials ───────────────────────────────────────────────────────
    try:
        twilio_sid = vault.decrypt(secrets.get("twilio_account_sid", ""))
        twilio_token = vault.decrypt(secrets.get("twilio_auth_token", ""))
        twilio_number = vault.decrypt(secrets.get("twilio_phone_number", ""))
    except Exception as exc:
        logger.error(f"[Twilio Fallback] Credential decrypt failed: {exc}")
        raise HTTPException(status_code=500, detail="Credential decryption failed.")

    if not all([twilio_sid, twilio_token, twilio_number]):
        raise HTTPException(
            status_code=400,
            detail=(
                "Twilio credentials not configured. "
                "Add twilio_account_sid, twilio_auth_token, and twilio_phone_number "
                "in Settings → Telephony."
            ),
        )

    # ── 2. Verify agent ──────────────────────────────────────────────────────
    agent_result = await db.execute(
        select(AgentORM)
        .options(selectinload(AgentORM.tools))
        .where(AgentORM.id == agent_id, AgentORM.user_id == current_user.id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    # ── 3. Create a unique room name for this call attempt ───────────────────
    # This room name is passed to /flow so it can look up the call record.
    # The actual LiveKit room where the agent runs will be different (created
    # by LiveKit's SIP gateway), but we need this to track the call in our DB.
    room_name = f"twilio_{uuid.uuid4().hex[:8]}"

    # ── 4. Log call BEFORE calling Twilio (so /flow can find it) ────────────
    db_call = CallORM(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        agent_id=agent_id,
        session_id=room_name,
        from_number=twilio_number,
        to_number=to_number,
        direction=CallDirection.OUTBOUND,
        status="connecting",
        call_meta={"path": "twilio_fallback", "room_name": room_name},
    )
    db.add(db_call)
    await db.commit()
    await db.refresh(db_call)

    # ── 5. Call Twilio REST API ───────────────────────────────────────────────
    base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    # URL-encode agent_id and room_name to be safe, use & (not &amp;) in the
    # actual URL — &amp; is only for embedding URLs inside XML attributes.
    flow_url = (
        f"{base_url}/api/v1/telephony/twilio/flow"
        f"?agent_id={quote(agent_id)}&room={quote(room_name)}"
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Calls.json",
            auth=(twilio_sid, twilio_token),
            data={"To": to_number, "From": twilio_number, "Url": flow_url},
        )

    if resp.status_code not in (200, 201):
        db_call.status = "failed"
        await db.commit()
        logger.error(f"[Twilio Fallback] API error {resp.status_code}: {resp.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Twilio API error: {resp.text}",
        )

    twilio_data = resp.json()
    db_call.status = "initiated"
    db_call.call_meta = {
        **(db_call.call_meta or {}),
        "twilio_call_sid": twilio_data.get("sid", ""),
    }
    await db.commit()

    logger.info(
        f"[Twilio Fallback] Call initiated: user={current_user.id} "
        f"to={to_number} twilio_sid={twilio_data.get('sid')} room={room_name}"
    )

    return {
        "status": "success",
        "call_id": db_call.id,
        "room_name": room_name,
        "twilio_call_sid": twilio_data.get("sid", ""),
        "to_number": to_number,
        "detail": "Outbound call queued via Twilio REST fallback.",
    }


# ─── TWIML FLOW ENDPOINTS ────────────────────────────────────────────────────

@router.post("/flow")
@router.get("/flow")
async def twilio_outbound_flow(
    agent_id: str,
    room: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Invoked by Twilio when the called party answers.

    Looks up the from_number from the call record (to get the right Twilio
    number), then returns TwiML that bridges the call into LiveKit SIP.

    For trial accounts: uses <Gather timeout="1"> so it fires ~1s after
    answer, then <Redirect> hits /flow-bridge which returns the final
    <Dial><Sip> TwiML. This two-hop is required for Twilio trial accounts
    which can't receive raw SIP back from LiveKit.

    For paid accounts: returns <Dial><Sip> directly — no extra round-trip.

    In both cases, LiveKit's SIP gateway receives the SIP leg and matches
    it to the inbound dispatch rule, which auto-spawns the agent.
    """
    logger.info(f"[Flow] Twilio flow callback: agent={agent_id} room={room}")

    # Resolve from_number from call record — needed to build the SIP URI.
    # The from_number is the Twilio number that placed the outbound call;
    # LiveKit uses it to match the inbound trunk dispatch rule.
    #
    # Retry loop: Twilio can call /flow within milliseconds of us committing
    # the CallORM record. Under load the DB write may not be visible yet on
    # a replica or even the primary (async session flush timing). We retry
    # up to 5 times with 300 ms gaps (max 1.5 s) before giving up.
    call_rec = None
    for attempt in range(5):
        await db.execute(select(CallORM).where(CallORM.session_id == room))  # warm connection
        call_result = await db.execute(
            select(CallORM).where(CallORM.session_id == room)
        )
        call_rec = call_result.scalar_one_or_none()
        if call_rec:
            break
        logger.warning(
            f"[Flow] Call record not found yet for room={room} "
            f"(attempt {attempt + 1}/5) — retrying in 300ms"
        )
        await asyncio.sleep(0.3)

    if not call_rec:
        logger.error(f"[Flow] No call record found for room={room} after 5 attempts. Hanging up.")
        return Response(
            content=_twiml_hangup("Call session not found."),
            media_type="application/xml",
        )

    sip_number = call_rec.from_number or os.getenv("FALLBACK_FROM_NUMBER", "+10000000000")
    if not sip_number.startswith("+"):
        sip_number = f"+{sip_number}"

    from app.core.config import settings
    lk_sip_domain = settings.LIVEKIT_SIP_DOMAIN
    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME", "")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD", "")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'

    # Use TLS on port 5061 — required for LiveKit Cloud SIP
    sip_uri = f"sip:{sip_number}@{lk_sip_domain};transport=tcp"

    if not _TWILIO_TRIAL:
        # Paid account — bridge directly, no extra round-trip
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>{sip_uri}</Sip>
    </Dial>
</Response>"""
        logger.info(f"[Flow] Paid path: bridging {sip_number} → {lk_sip_domain}")
    else:
        # Trial account — Twilio trial can't receive raw SIP callbacks,
        # so we need one extra webhook hop via <Gather>/<Redirect>.
        # <Gather timeout="1"> fires after 1s (no digits needed), then
        # falls through to <Redirect> which hits /flow-bridge.
        # &amp; is correct here because this URL is inside an XML attribute.
        base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
        bridge_url = (
            f"{base_url}/api/v1/telephony/twilio/flow-bridge"
            f"?agent_id={quote(agent_id)}&room={quote(room)}"
        )
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Redirect method="POST">{bridge_url}</Redirect>
</Response>"""
        logger.info(f"[Flow] Trial path: gather→redirect for {sip_number} → {lk_sip_domain}")

    return Response(content=twiml, media_type="application/xml")


@router.post("/flow-bridge")
@router.get("/flow-bridge")
async def twilio_flow_bridge(
    agent_id: str,
    room: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Trial-account only: Twilio POSTs here after <Gather> timeout expires.
    Returns the final <Dial><Sip> TwiML to bridge into LiveKit.
    Paid accounts never reach this endpoint — they bridge in /flow directly.
    """
    logger.info(f"[FlowBridge] Trial bridge: agent={agent_id} room={room}")

    call_rec = None
    for attempt in range(5):
        call_result = await db.execute(
            select(CallORM).where(CallORM.session_id == room)
        )
        call_rec = call_result.scalar_one_or_none()
        if call_rec:
            break
        logger.warning(
            f"[FlowBridge] Call record not found yet for room={room} "
            f"(attempt {attempt + 1}/5) — retrying in 300ms"
        )
        await asyncio.sleep(0.3)

    if not call_rec:
        logger.error(f"[FlowBridge] No call record found for room={room} after 5 attempts. Hanging up.")
        return Response(
            content=_twiml_hangup("Call session not found."),
            media_type="application/xml",
        )

    sip_number = call_rec.from_number or os.getenv("FALLBACK_FROM_NUMBER", "+10000000000")
    if not sip_number.startswith("+"):
        sip_number = f"+{sip_number}"

    from app.core.config import settings
    lk_sip_domain = settings.LIVEKIT_SIP_DOMAIN
    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME", "")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD", "")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'

    # Use TLS on port 5061 — required for LiveKit Cloud SIP
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>sip:{sip_number}@{lk_sip_domain};transport=tcp</Sip>
    </Dial>
</Response>"""

    logger.info(f"[FlowBridge] Bridging {sip_number} → {lk_sip_domain}")
    return Response(content=twiml, media_type="application/xml")


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _twiml_hangup(message: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">{message}</Say>
    <Hangup />
</Response>"""