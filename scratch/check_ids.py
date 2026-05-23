import asyncio
import os
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
        print("--- AGENTS ---")
        res = await session.execute(text("SELECT agent_name, user_id FROM agents"))
        for row in res.fetchall():
            print(f"Agent: {row[0]}, User ID: {row[1]}")
            
        print("\n--- CONNECTIONS ---")
        res = await session.execute(text("SELECT provider, user_id FROM provider_connections"))
        for row in res.fetchall():
            print(f"Provider: {row[0]}, User ID: {row[1]}")
            
        print("\n--- USERS ---")
        res = await session.execute(text("SELECT id, email FROM users"))
        for row in res.fetchall():
            print(f"User ID: {row[0]}, Email: {row[1]}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
