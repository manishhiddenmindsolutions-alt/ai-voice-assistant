import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.models.orm import AgentORM, ToolORM, IntegrationORM
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        stmt = select(AgentORM).options(selectinload(AgentORM.tools))
        result = await session.execute(stmt)
        agents = result.scalars().all()
        
        print(f"Total Agents: {len(agents)}")
        for agent in agents:
            print(f"\nAgent ID: {agent.id}")
            print(f"  Name: {agent.agent_name}")
            print(f"  Language: {agent.language}")
            print(f"  LLM Model: {agent.llm_model}")
            print(f"  Voice ID: {agent.voice_id}")
            print(f"  Config: {agent.config}")
            print(f"  Tools: {[t.name for t in agent.tools] if agent.tools else []}")
            for t in agent.tools:
                print(f"    - Tool: {t.name}, Type: {t.tool_type}, URL: {t.url}")
            
if __name__ == "__main__":
    asyncio.run(main())
