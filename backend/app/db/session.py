from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator
from app.core.config import settings
from app.models.orm import Base
from sqlalchemy import text

# Create Async Engine
# Note: For SQLite for local testing, use sqlite+aiosqlite
engine = create_async_engine(settings.DATABASE_URL, echo=True)

# Create Session Factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def init_db():
    """Initializes the database tables."""
    async with engine.begin() as conn:
        # NOTE: In production, use Alembic for migrations
        await conn.run_sync(Base.metadata.create_all)
        
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS secrets JSONB DEFAULT '{}'::jsonb"))
        except Exception as e:
            print(f"⚠️ [MIGRATION] ALTER TABLE users failed: {e}")
            
        try:
            await conn.execute(text("ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS sip_trunk_id VARCHAR"))
        except Exception as e:
            print(f"⚠️ [MIGRATION] ALTER TABLE phone_numbers failed: {e}")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing a database session for FastAPI."""
    async with AsyncSessionLocal() as session:
        yield session
