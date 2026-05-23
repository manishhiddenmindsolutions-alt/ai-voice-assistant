import asyncio
import os
import json
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/Voice-Agent")

async def clear_secrets():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Fetch Ramu
        res = await session.execute(text("SELECT id, agent_name, secrets FROM agents WHERE agent_name = 'Ramu'"))
        row = res.fetchone()
        if row:
            agent_id, name, secrets = row
            print(f"Ramu current secrets keys: {list((secrets or {}).keys())}")
            
            # Clear the secrets dictionary
            new_secrets = {}
            
            # Update DB
            await session.execute(
                text("UPDATE agents SET secrets = :secrets WHERE id = :id"),
                {"secrets": json.dumps(new_secrets), "id": agent_id}
            )
            await session.commit()
            print("Successfully cleared all local secrets for Ramu, allowing it to fall back to working environment/global keys!")
        else:
            print("Ramu not found in DB.")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(clear_secrets())
