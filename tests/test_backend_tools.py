import pytest
import uuid
from backend.app.models.orm import UserORM, ToolORM, IntegrationORM
from backend.app.models.agent import AgentConfig
from backend.app.db.session import AsyncSessionLocal
from backend.app.api.v1.endpoints.tools import create_tool, ToolCreate
from sqlalchemy import select, delete

@pytest.mark.asyncio
async def test_create_tool_sheets_and_calendar_flows():
    db = AsyncSessionLocal()
    
    # Generate unique IDs to avoid conflicts
    user_id = f"test_user_{uuid.uuid4().hex[:8]}"
    integration_id = f"test_int_{uuid.uuid4().hex[:8]}"
    tool_ids = []
    
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
        
        # 2. Create a test Google integration for this user
        integration = IntegrationORM(
            id=integration_id,
            user_id=user_id,
            provider="google",
            integration_type="OAUTH",
            access_token="test_access",
            refresh_token="test_refresh",
            scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/calendar.events"]
        )
        db.add(integration)
        
        await db.commit()
        
        # 3. Create SHEETS Tool payload containing a full Google Sheets URL and no integration_id
        sheets_payload = ToolCreate(
            name="Auto Sheet Tool",
            description="Should auto-extract and auto-link",
            tool_type="SHEETS",
            category="Google Apps",
            method="NATIVE",
            config={"spreadsheetId": "https://docs.google.com/spreadsheets/d/1C_blC7_pX-H2fEQ4Lzp3gapgjWhTMKz3zASRhluvhAE/edit#gid=0"},
            integration_id=None
        )
        
        db_sheets_tool = await create_tool(
            tool=sheets_payload,
            current_user=user,
            db=db
        )
        tool_ids.append(db_sheets_tool.id)
        
        # Assertions for SHEETS tool
        assert db_sheets_tool.integration_id == integration_id
        assert db_sheets_tool.config["spreadsheetId"] == "1C_blC7_pX-H2fEQ4Lzp3gapgjWhTMKz3zASRhluvhAE"
        assert db_sheets_tool.api_key is None
        
        # 4. Create CALENDAR Tool payload containing a full embed URL and no integration_id
        calendar_payload = ToolCreate(
            name="Auto Calendar Tool",
            description="Should auto-extract calendar id",
            tool_type="CALENDAR",
            category="Google Apps",
            method="NATIVE",
            config={"calendarId": "https://calendar.google.com/calendar/embed?src=a03532a7eb7504b07ce406b968e3c6b570f0a6491b3ccca56e6ad55504a1a4db%40group.calendar.google.com&ctz=Asia%2FKolkata"},
            integration_id=None
        )
        
        db_calendar_tool = await create_tool(
            tool=calendar_payload,
            current_user=user,
            db=db
        )
        tool_ids.append(db_calendar_tool.id)
        
        # Assertions for CALENDAR tool
        assert db_calendar_tool.integration_id == integration_id
        assert db_calendar_tool.config["calendarId"] == "a03532a7eb7504b07ce406b968e3c6b570f0a6491b3ccca56e6ad55504a1a4db@group.calendar.google.com"
        assert db_calendar_tool.api_key is None
        
    finally:
        # Cleanup
        try:
            for tid in tool_ids:
                await db.execute(delete(ToolORM).where(ToolORM.id == tid))
            await db.execute(delete(IntegrationORM).where(IntegrationORM.id == integration_id))
            await db.execute(delete(UserORM).where(UserORM.id == user_id))
            await db.commit()
        except Exception as err:
            print(f"Cleanup failed: {err}")
            await db.rollback()
        await db.close()
