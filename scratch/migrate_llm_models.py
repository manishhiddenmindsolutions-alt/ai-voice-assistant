import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models.orm import AgentORM
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        stmt = select(AgentORM)
        result = await session.execute(stmt)
        agents = result.scalars().all()
        
        print(f"Migrating {len(agents)} agents...")
        for agent in agents:
            old_model = agent.llm_model
            old_provider = agent.config.get("llm", {}).get("provider") if agent.config else "N/A"
            
            # Update fields
            agent.llm_model = "llama-3.3-70b-versatile"
            
            # Update config JSON
            new_config = dict(agent.config or {})
            if "llm" not in new_config:
                new_config["llm"] = {}
            new_config["llm"]["provider"] = "groq"
            new_config["llm"]["model"] = "llama-3.3-70b-versatile"
            
            # Flag modified for SQLAlchemy JSON tracking
            from sqlalchemy.orm.attributes import flag_modified
            agent.config = new_config
            flag_modified(agent, "config")
            
            print(f"  Agent {agent.agent_name}: Migrated from {old_provider}/{old_model} to groq/llama-3.3-70b-versatile")
            
        await session.commit()
        print("Database commit successful.")
            
if __name__ == "__main__":
    asyncio.run(main())
