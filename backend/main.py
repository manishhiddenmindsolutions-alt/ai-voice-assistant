from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from livekit.api import RoomAgentDispatch, RoomConfiguration
import os
import pathlib
from dotenv import load_dotenv
import uuid

# Always load from project root regardless of where uvicorn is launched from
_ROOT = pathlib.Path(__file__).parent.parent
load_dotenv(_ROOT / ".env.local")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://ai-voice-agent-wvy6zhrh.livekit.cloud")
@app.get("/")
def hello():
    return {"message": "Hello World"}

@app.post("/start-session")

async def start_session():
    room_name = f"room_{uuid.uuid4().hex[:8]}"
    identity = f"user_{uuid.uuid4().hex[:6]}"

    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        return {"error": "LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set"}

    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_grants(
            api.VideoGrants(
                room=room_name,
                room_join=True,
                can_publish=True,
                can_subscribe=True,
                room_admin=True
            )
        )
        .with_room_config(
            RoomConfiguration(
                agents=[
                    RoomAgentDispatch(agent_name="rajasthan-property-broker")
                ]
            )
        )
    )

    return {
        "token": token.to_jwt(),
        "room": room_name,
        "identity": identity,
        "url": LIVEKIT_URL,
    }