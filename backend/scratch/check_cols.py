import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def check_tbl():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'tools'"))
        cols = [r[0] for r in res.all()]
        print(f"Columns in tools table: {cols}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_tbl())
