import pytest
import uuid
import asyncio
from sqlalchemy.orm import selectinload
from sqlalchemy import select, delete
from backend.app.models.orm import UserORM, ToolORM, AgentORM
from backend.app.models.agent import AgentConfig
from backend.app.db.session import AsyncSessionLocal
from backend.app.api.v1.endpoints.agents import create_or_update_agent

@pytest.mark.asyncio
async def test_create_or_update_agent_tool_association():
    db = AsyncSessionLocal()
    
    # Generate unique IDs to avoid conflicts
    user_id = f"test_user_{uuid.uuid4().hex[:8]}"
    tool_id = f"test_tool_{uuid.uuid4().hex[:8]}"
    agent_id = f"test_agent_{uuid.uuid4().hex[:8]}"
    
    try:
        # 1. Create a test user
        user = UserORM(
            id=user_id,
            email=f"{user_id}@example.com",
            full_name="Test User",
            is_active=True,
            secrets={}
        )
        db.add(user)
        
        # 2. Create a test tool
        tool = ToolORM(
            id=tool_id,
            user_id=user_id,
            name="Test Sheet Tool",
            description="Test Description",
            tool_type="SHEETS",
            url="",
            config={"spreadsheetId": "123456"}
        )
        db.add(tool)
        
        # Force commit/flush so we can link them
        await db.commit()
        
        # 3. Construct AgentConfig payload referencing the tool ID
        agent_config = AgentConfig(
            id=agent_id,
            agentName="Test Agent",
            description="Agent for testing tool association",
            status="draft",
            language="hi-IN",
            prompt="You are a test agent",
            stt={"provider": "sarvam", "model": "saaras:v3", "language": "hi-IN"},
            llm={"provider": "groq", "model": "llama-3.3-70b-versatile", "temperature": 0.7},
            tts={"provider": "sarvam", "model": "bulbul:v3", "voice": "neha"},
            vad={"activation_threshold": 0.5, "min_speech_duration": 0.3, "min_silence_duration": 0.8},
            tools=[tool_id]  # Pass the tool ID string
        )
        
        # 4. Call create_or_update_agent endpoint logic
        result_agent = await create_or_update_agent(
            agent=agent_config,
            current_user=user,
            db=db
        )
        
        # 5. Query the database to verify the relationship was populated
        stmt = select(AgentORM).options(selectinload(AgentORM.tools)).where(AgentORM.id == agent_id)
        q_res = await db.execute(stmt)
        agent_db = q_res.scalar_one()
        
        # Assertions
        assert len(agent_db.tools) == 1
        assert agent_db.tools[0].id == tool_id
        assert agent_db.tools[0].name == "Test Sheet Tool"
        assert agent_db.config["tools"] == [tool_id]
        
    finally:
        # Cleanup all created test data
        try:
            await db.execute(delete(AgentORM).where(AgentORM.id == agent_id))
            await db.execute(delete(ToolORM).where(ToolORM.id == tool_id))
            await db.execute(delete(UserORM).where(UserORM.id == user_id))
            await db.commit()
        except Exception as cleanup_err:
            print(f"Cleanup failed: {cleanup_err}")
            await db.rollback()
        await db.close()
