"""
Twilio Telephony Endpoints — Inbound Call Routing & Outbound Fallback.

This module handles the Twilio REST → TwiML → LiveKit call path:

  POST /telephony/twilio/inbound    — Twilio webhook for inbound calls
  GET  /telephony/twilio/inbound    — Same (Twilio can use GET or POST)
  POST /telephony/twilio/flow       — TwiML for outbound (Twilio fallback only)
  POST /telephony/twilio/flow-bridge — Bridges caller into LiveKit SIP room

Architecture note:
  This is the SECONDARY (fallback) path. The primary outbound path is
  POST /telephony/outbound using native LiveKit SIP (no Twilio REST API).
  Use this path only when:
    - The user has a Twilio trial account (cannot receive raw SIP)
    - The native SIP path fails

  Inbound calls always come through this path because Twilio's webhook
  system is how numbers receive calls.

Security:
  - Twilio webhook signature verification (X-Twilio-Signature header)
  - All credential access from encrypted user secrets
"""

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
    # Build the validation string: url + sorted POST params
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
    dispatch rule, and dispatches the agent into a fresh room.
    """
    caller = From.strip()
    # Normalize dialed number: strip leading + for DB lookup
    dialed_raw = To.strip()
    dialed_clean = dialed_raw.lstrip("+").replace(" ", "")

    logger.info(f"[Inbound] Twilio call: From={caller} To={dialed_raw}")

    # Verify Twilio webhook signature when header is present.
    # We look up the auth_token from the phone number's owning user.
    twilio_sig = request.headers.get("X-Twilio-Signature", "")
    if twilio_sig:
        # We need to find the user's auth_token — attempt a quick lookup
        # using the dialed number. This runs before the full phone number
        # query below, but we accept a second query for security correctness.
        from app.models.orm import UserORM as _UserORM
        from app.core.security import vault as _vault
        _dialed_clean_v = To.strip().lstrip("+").replace(" ", "")
        _num_stmt = select(PhoneNumberORM).where(
            (PhoneNumberORM.number == To.strip()) |
            (PhoneNumberORM.number == _dialed_clean_v) |
            (PhoneNumberORM.number == f"+{_dialed_clean_v}")
        )
        _num_result = await db.execute(_num_stmt)
        _db_num = _num_result.scalar_one_or_none()
        if _db_num:
            _user_result = await db.execute(select(_UserORM).where(_UserORM.id == _db_num.user_id))
            _user = _user_result.scalar_one_or_none()
            if _user and _user.secrets and _user.secrets.get("twilio_auth_token"):
                try:
                    _auth_token = _vault.decrypt(_user.secrets["twilio_auth_token"])
                    _url = str(request.url)
                    _post_params = form_params or {}
                    if not _verify_twilio_signature(_auth_token, _url, _post_params, twilio_sig):
                        logger.warning(f"[Inbound] Twilio signature verification FAILED for {To.strip()}")
                        return Response(
                            content=_twiml_hangup("Authentication failed."),
                            media_type="application/xml",
                        )
                except Exception as sig_exc:
                    logger.warning(f"[Inbound] Could not verify Twilio signature: {sig_exc}")

    # ── 1. Find phone number record ─────────────────────────────────────────
    stmt = select(PhoneNumberORM).where(
        (PhoneNumberORM.number == dialed_raw) |
        (PhoneNumberORM.number == dialed_clean) |
        (PhoneNumberORM.number == f"+{dialed_clean}")
    )
    result = await db.execute(stmt)
    db_number = result.scalar_one_or_none()

    if not db_number or not db_number.agent_id:
        logger.warning(f"[Inbound] No agent mapped to number: {dialed_raw}")
        return Response(
            content=_twiml_hangup("The voice assistant is not available for this number."),
            media_type="application/xml",
        )

    # ── 2. Fetch agent ───────────────────────────────────────────────────────
    agent_result = await db.execute(
        select(AgentORM).where(AgentORM.id == db_number.agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        logger.error(f"[Inbound] Agent {db_number.agent_id} not found")
        return Response(
            content=_twiml_hangup("System error: voice agent offline."),
            media_type="application/xml",
        )

    # ── 3. Log call ──────────────────────────────────────────────────────────
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

    # ── 4. Build TwiML to dial into LiveKit SIP ──────────────────────────────
    from app.core.config import settings
    lk_sip_domain = settings.LIVEKIT_SIP_DOMAIN
    sip_number = dialed_raw if dialed_raw.startswith("+") else f"+{dialed_clean}"

    # LiveKit SIP credentials (optional — set if your trunk requires auth)
    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME", "")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD", "")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>sip:{sip_number}@{lk_sip_domain}:5061;transport=tls</Sip>
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
    # Pass form params explicitly so _process_inbound_call can verify signature
    # without re-consuming the request body.
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
    """Twilio GET webhook for inbound calls (some regions use GET)."""
    # GET requests carry params in the query string — no body to re-parse
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
      2. Dispatch agent into a named room.
      3. Log CallORM with status='connecting'.
      4. POST to Twilio Calls API with a TwiML callback URL.
         Twilio dials the customer; when they answer, Twilio fetches
         our /flow endpoint which returns TwiML to bridge into LiveKit.
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

    # ── 3. Pre-dispatch agent ────────────────────────────────────────────────
    room_name = f"twilio-{uuid.uuid4().hex[:10]}"
    try:
        from app.services.sip_service import sip_service
        agent_metadata = await build_agent_metadata(agent, db)
        await sip_service._dispatch_agent(
            room_name=room_name,
            agent_name=_AGENT_WORKER_NAME,
            metadata=agent_metadata,
        )
        logger.info(f"[Twilio Fallback] Agent dispatched to room {room_name}")
    except Exception as exc:
        logger.warning(f"[Twilio Fallback] Agent pre-dispatch failed (non-fatal): {exc}")

    # ── 4. Log call ──────────────────────────────────────────────────────────
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
    flow_url = (
        f"{base_url}/api/v1/telephony/twilio/flow"
        f"?agent_id={agent_id}&room={room_name}"
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

    For trial Twilio accounts, we must collect a keypress before bridging
    (Twilio's trial gateway requires it). For paid accounts, no gather is needed.
    We include a short gather with a timeout and fallback to bridge directly.
    """
    logger.info(f"[Flow] Twilio flow callback: agent={agent_id} room={room}")
    base_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    bridge_url = (
        f"{base_url}/api/v1/telephony/twilio/flow-bridge"
        f"?agent_id={agent_id}&amp;room={room}"
    )
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather action="{bridge_url}" numDigits="1" timeout="5" method="POST">
        <Say voice="alice">Connecting you now. Press any key to continue.</Say>
    </Gather>
    <Redirect method="POST">{bridge_url}</Redirect>
</Response>"""
    return Response(content=twiml, media_type="application/xml")


@router.post("/flow-bridge")
@router.get("/flow-bridge")
async def twilio_flow_bridge(
    agent_id: str,
    room: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Final TwiML bridge: connects the answered call into the LiveKit SIP room.
    The agent was already pre-dispatched into `room` before Twilio dialed.
    """
    logger.info(f"[FlowBridge] Bridging: agent={agent_id} room={room}")

    # Look up the original from_number from the call record
    call_result = await db.execute(
        select(CallORM).where(CallORM.session_id == room)
    )
    call_rec = call_result.scalar_one_or_none()
    sip_number = (
        call_rec.from_number
        if call_rec and call_rec.from_number
        else os.getenv("FALLBACK_FROM_NUMBER", "+10000000000")
    )
    if not sip_number.startswith("+"):
        sip_number = f"+{sip_number}"

    from app.core.config import settings
    lk_sip_domain = settings.LIVEKIT_SIP_DOMAIN

    lk_sip_username = os.getenv("LIVEKIT_SIP_USERNAME", "")
    lk_sip_password = os.getenv("LIVEKIT_SIP_PASSWORD", "")
    auth_attr = ""
    if lk_sip_username and lk_sip_password:
        auth_attr = f' username="{lk_sip_username}" password="{lk_sip_password}"'

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Dial>
        <Sip{auth_attr}>sip:{sip_number}@{lk_sip_domain};transport=tcp</Sip>
    </Dial>
</Response>"""

    return Response(content=twiml, media_type="application/xml")


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _twiml_hangup(message: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">{message}</Say>
    <Hangup />
</Response>"""
