import asyncio
import os
import json
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/Voice-Agent")

async def inspect():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Fetch all agents
        res = await session.execute(text("SELECT id, agent_name, llm_model, voice_id, config, secrets, prompt, language FROM agents"))
        agents = res.fetchall()
        print(f"--- DATABASE AGENTS ({len(agents)} found) ---")
        for a in agents:
            print(f"\n==========================================")
            print(f"Name: {a[1]}")
            print(f"ID: {a[0]}")
            print(f"LLM Model: {a[2]}")
            print(f"Voice ID: {a[3]}")
            print(f"Config: {json.dumps(a[4] or {}, indent=2)}")
            print(f"Secrets keys: {list((a[5] or {}).keys())}")
            print(f"Language: {a[7]}")
            print(f"Prompt (first 50 chars): {a[6][:50] if a[6] else 'None'}")
            print(f"==========================================\n")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(inspect())
