import os
from pydantic_settings import BaseSettings
from pathlib import Path
from dotenv import load_dotenv

# Pathing
_BACKEND_APP_DIR = Path(__file__).parent.parent
_ROOT = _BACKEND_APP_DIR.parent.parent
load_dotenv(_ROOT / ".env.local")

class Settings(BaseSettings):
    PROJECT_NAME: str = "Voice AI SaaS"
    API_V1_STR: str = "/api/v1"
    
    # LiveKit
    LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "")
    LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "")
    LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "wss://ai-voice-agent-wvy6zhrh.livekit.cloud")
    LIVEKIT_SIP_DOMAIN: str = os.getenv("LIVEKIT_SIP_DOMAIN", "sip.livekit.cloud")
    
    # Storage
    DATA_DIR: Path = _ROOT / "data"
    AGENTS_FILE: Path = DATA_DIR / "agents.json"
    USERS_FILE: Path = DATA_DIR / "users.json"
    USAGE_FILE: Path = DATA_DIR / "usage.json"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/Voice-Agent")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "7d8f3e2b1a9c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e") # HS256
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "G2fP6vJ9_8KzX4-Lq1-R5b3M9n2Q7w4E8r6T1y5U9i0=") # Fernet (Base64)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 1 week
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_OAUTH_REDIRECT_URI: str = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "http://localhost:8000/api/v1/integrations/google/callback")
    
    class Config:
        case_sensitive = True

settings = Settings()
