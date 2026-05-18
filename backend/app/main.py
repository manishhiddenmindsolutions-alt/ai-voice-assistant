from backend.app.api.v1.endpoints import dashboard
import contextlib
import os
import pathlib
import subprocess
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from app.api.v1.endpoints import agents, sessions, tools, numbers, calls, auth, integrations
# pyrefly: ignore [missing-import]
from app.core.config import settings
# pyrefly: ignore [missing-import]
from app.db.session import init_db

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Unified Startup: Automatically runs the VoiceForge Agent Worker and initializes the database.
    """
    await init_db()
    
    if os.getenv("ENABLE_BACKGROUND_AGENT") == "true":
        agent_path = settings.DATA_DIR.parent / "agent" / "main.py"
        print(f"\n🚀 [SYSTEM] Starting VoiceForge Agent (v5) in Background: {agent_path}")
        
        # Run 'uv run python agent/main.py dev' in the background
        cmd = ["uv", "run", "python", str(agent_path), "dev"]
        try:
            agent_process = subprocess.Popen(
                cmd,
                cwd=str(settings.DATA_DIR.parent),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1
            )
        except Exception as e:
            print(f"⚠️ [SYSTEM] Could not start background agent: {e}")
            agent_process = None

        if agent_process:
            import threading
            def pipe_logs(process):
                try:
                    for line in iter(process.stdout.readline, ""):
                        if line:
                            print(f"🤖 [AGENT] {line.strip()}")
                except:
                    pass

            threading.Thread(target=pipe_logs, args=(agent_process,), daemon=True).start()
    else:
        print("\n💡 [SYSTEM] Manual Agent Mode: Please run 'uv run python agent/main.py dev' in a separate terminal.")
        agent_process = None

    yield
    
    if agent_process:
        print("🛑 [SYSTEM] Shutting down Agent Worker...")
        agent_process.terminate()
        try:
            agent_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            agent_process.kill()

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(agents.router, prefix=f"{settings.API_V1_STR}/agents", tags=["Agents"])
app.include_router(sessions.router, prefix=f"{settings.API_V1_STR}/sessions", tags=["Sessions"])
app.include_router(tools.router, prefix=f"{settings.API_V1_STR}/tools", tags=["Tools"])
app.include_router(numbers.router, prefix=f"{settings.API_V1_STR}/numbers", tags=["Numbers"])
app.include_router(calls.router, prefix=f"{settings.API_V1_STR}/calls", tags=["Calls"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Auth"])
app.include_router(integrations.router, prefix=f"{settings.API_V1_STR}/integrations", tags=["Integrations"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Dashboard"])

@app.get("/hello")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}
