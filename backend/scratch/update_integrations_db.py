import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.models.orm import Base

async def run_migration():
    print("[MIGRATION] Starting Easy Mode Database Sync...")
    
    async with engine.begin() as conn:
        # Create all tables (will create integrations if missing, but won't add columns to existing)
        await conn.run_sync(Base.metadata.create_all)
        
        # Add new columns to 'integrations' table
        cols_to_add = [
            ("integration_type", "VARCHAR DEFAULT 'OAUTH'"),
            ("credentials", "JSONB")
        ]
        
        for col_name, col_type in cols_to_add:
            print(f"Adding '{col_name}' to 'integrations' table...")
            try:
                await conn.execute(text(f"ALTER TABLE integrations ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
                print(f"✅ '{col_name}' sync complete.")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        
    print("[MIGRATION] Database Sync Complete.")

if __name__ == "__main__":
    asyncio.run(run_migration())
