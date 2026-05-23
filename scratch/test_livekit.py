import asyncio
import os
from dotenv import load_dotenv
from livekit import api

load_dotenv(".env.local")

async def test_conn():
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    print(f"Testing LiveKit Connection...")
    print(f"URL: {url}")
    print(f"Key: {key}")
    print(f"Secret: {'*' * len(secret) if secret else 'None'}")
    
    try:
        lkapi = api.LiveKitAPI(url, key, secret)
        rooms = await lkapi.room.list_rooms(api.ListRoomsRequest())
        print(f"Success! Listed {len(rooms.rooms)} active rooms.")
        await lkapi.close()
    except Exception as e:
        print(f"Error connecting to LiveKit: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
