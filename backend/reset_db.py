import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models.orm import Base
from app.core.config import settings

async def reset_db():
    print(f"Connecting to {settings.DATABASE_URL}...")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    async with engine.begin() as conn:
        print("Inserting default user...")
        # Simple execute to insert default user
        from sqlalchemy import text
        await conn.execute(text("INSERT INTO users (id, email, full_name, is_active, secrets, created_at) VALUES ('default_user', 'user@example.com', 'Default User', TRUE, '{}', NOW()) ON CONFLICT (id) DO NOTHING"))
    
    print("Database reset successfully.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reset_db())
