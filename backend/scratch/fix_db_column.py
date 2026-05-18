import asyncio
from sqlalchemy import text
from app.db.session import engine
from app.models.orm import Base

async def run_migration():
    print("[MIGRATION] Starting Database Sync...")
    
    async with engine.begin() as conn:
        # 1. Create Integrations table if missing
        print("Checking 'integrations' table...")
        await conn.run_sync(Base.metadata.create_all)
        
        # 2. Add integration_id column to tools table
        print("Adding 'integration_id' to 'tools' table...")
        try:
            await conn.execute(text("ALTER TABLE tools ADD COLUMN IF NOT EXISTS integration_id VARCHAR REFERENCES integrations(id)"))
            print("'integration_id' column added successfully.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column 'integration_id' already exists.")
            else:
                print(f"Error adding column: {e}")
        
    print("[MIGRATION] Database Sync Complete.")

if __name__ == "__main__":
    asyncio.run(run_migration())
