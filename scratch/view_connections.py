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
        res = await session.execute(text("SELECT id, user_id, provider, api_key FROM provider_connections"))
        rows = res.fetchall()
        for row in rows:
            conn_id, user_id, provider, api_key = row
            print(f"Connection ID: {conn_id}")
            print(f"User ID: {user_id}")
            print(f"Provider: {provider}")
            print(f"API Key present: {bool(api_key)}")
            print("-" * 50)
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
