import asyncio
import os
from livekit import api
from dotenv import load_dotenv
from pathlib import Path

# Load env from root
_ROOT = Path(__file__).parent.parent
load_dotenv(_ROOT / ".env.local")

async def list_rooms():
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    
    print(f"Connecting to: {url}")
    
    api_url = url.replace("wss://", "https://").replace("ws://", "http://")
    async with api.LiveKitAPI(api_url, key, secret) as lkapi:
        rooms = await lkapi.room.list_rooms(api.ListRoomsRequest())
        print(f"Found {len(rooms.rooms)} rooms:")
        for r in rooms.rooms:
            print(f"- {r.name} ({r.num_participants} participants)")

if __name__ == "__main__":
    asyncio.run(list_rooms())
