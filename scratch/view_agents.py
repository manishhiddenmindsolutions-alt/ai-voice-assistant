import asyncio
import os
import json
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/Voice-Agent")

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        res = await session.execute(text("SELECT id, agent_name, config, secrets FROM agents"))
        rows = res.fetchall()
        for row in rows:
            agent_id, name, config, secrets = row
            print(f"Agent ID: {agent_id}")
            print(f"Agent Name: {name}")
            print(f"Config: {json.dumps(config, indent=2)}")
            print(f"Secrets keys: {list((secrets or {}).keys())}")
            print("-" * 50)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
