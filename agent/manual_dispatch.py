import asyncio
import os
import json
from livekit import api
from dotenv import load_dotenv
from pathlib import Path

# Load env from root
_ROOT = Path(__file__).parent.parent
load_dotenv(_ROOT / ".env.local")

async def manual_dispatch():
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    
    api_url = url.replace("wss://", "https://").replace("ws://", "http://")
    
    room_name = "test_dispatch_room"
    agent_name = "voice-forge-agent-v5"
    
    print(f"Connecting to: {api_url}")
    async with api.LiveKitAPI(api_url, key, secret) as lkapi:
        print(f"Dispatching agent '{agent_name}' to room '{room_name}'...")
        # Note: In livekit-api 0.7.0, it is lkapi.agent_dispatch.create_dispatch
        try:
            dispatch = await lkapi.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(
                    agent_name=agent_name,
                    room=room_name,
                    metadata=json.dumps({"prompt": "Hello! I was manually dispatched."})
                )
            )
            print(f"Dispatch created: {dispatch.id}")
        except Exception as e:
            print(f"Dispatch failed: {e}")

if __name__ == "__main__":
    asyncio.run(manual_dispatch())
