import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.core.security import vault

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/Voice-Agent")

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        res = await session.execute(text("SELECT provider, api_key FROM provider_connections"))
        for row in res.fetchall():
            provider, api_key = row
            try:
                decrypted = vault.decrypt(api_key)
                print(f"Provider: {provider}, Key length: {len(decrypted) if decrypted else 0}, Key starts with: {decrypted[:10] if decrypted else 'None'}")
            except Exception as e:
                print(f"Error decrypting for {provider}: {e}")
                
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
