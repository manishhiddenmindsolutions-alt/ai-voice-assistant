import asyncio
import os
import json
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/Voice-Agent")

async def fix():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Fetch Ramu's config
        res = await session.execute(text("SELECT id, agent_name, config FROM agents WHERE agent_name = 'Ramu'"))
        row = res.fetchone()
        if row:
            agent_id, name, config = row
            print(f"Current Ramu config: {json.dumps(config, indent=2)}")
            
            # Update LLM provider to 'openrouter' since the model is an OpenRouter path
            if "llm" in config:
                config["llm"]["provider"] = "openrouter"
                # Fix the model ID if it had a typo, e.g., if qwen3.6-flash should be qwen/qwen-2.5-72b-instruct
                if "qwen3.6-flash" in config["llm"]["model"]:
                    # Change to a standard valid OpenRouter Qwen model
                    config["llm"]["model"] = "qwen/qwen-2.5-72b-instruct"
            
            # Update in DB
            await session.execute(
                text("UPDATE agents SET config = :config, llm_model = :model WHERE id = :id"),
                {"config": json.dumps(config), "model": config["llm"]["model"], "id": agent_id}
            )
            await session.commit()
            print("Successfully updated Ramu's provider to openrouter and model to a valid Qwen model path!")
        else:
            print("Ramu not found in DB.")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix())
