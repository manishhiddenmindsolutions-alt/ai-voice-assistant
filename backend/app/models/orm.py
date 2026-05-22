from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import String, Float, DateTime, ForeignKey, Text, Enum, Table, Column
import uuid
from datetime import datetime
import enum

class Base(DeclarativeBase):
    pass

# Many-to-Many relationship between Agents and Tools
agent_tools = Table(
    "agent_tools",
    Base.metadata,
    Column("agent_id", String, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True),
    Column("tool_id", String, ForeignKey("tools.id", ondelete="CASCADE"), primary_key=True),
)

class UserORM(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str] = mapped_column(String, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=True) # None for social logins
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    secrets: Mapped[dict] = mapped_column(JSONB, default=dict) # Encrypted global model keys (LLM/TTS/STT)
    
    # Relationships
    agents: Mapped[list["AgentORM"]] = relationship(back_populates="user")
    tools: Mapped[list["ToolORM"]] = relationship(back_populates="user")
    phone_numbers: Mapped[list["PhoneNumberORM"]] = relationship(back_populates="user")
    integrations: Mapped[list["IntegrationORM"]] = relationship(back_populates="user")

class AgentORM(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    agent_name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="draft")
    language: Mapped[str] = mapped_column(String, default="hi-IN")
    prompt: Mapped[str] = mapped_column(Text, default="")
    
    # Configuration
    llm_model: Mapped[str] = mapped_column(String, default="llama-3.3-70b-versatile")
    voice_id: Mapped[str] = mapped_column(String, default="neha")
    
    # Nested configurations stored as JSONB for flexibility
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    secrets: Mapped[dict] = mapped_column(JSONB, default=dict) # Encrypted model keys (LLM/TTS/STT)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["UserORM"] = relationship(back_populates="agents")
    tools: Mapped[list["ToolORM"]] = relationship(secondary=agent_tools, back_populates="agents")
    calls: Mapped[list["CallORM"]] = relationship(back_populates="agent")

class ToolORM(Base):
    __tablename__ = "tools"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(String, default="")
    
    # API configuration
    tool_type: Mapped[str] = mapped_column(String, default="WEBHOOK") # WEBHOOK, CALENDAR, SHEETS
    category: Mapped[str] = mapped_column(String, default="Webhooks") # Webhooks, AI Workflows, Google Apps
    url: Mapped[str] = mapped_column(String, nullable=True) # Webhook URL
    method: Mapped[str] = mapped_column(String, default="POST")
    headers: Mapped[dict] = mapped_column(JSONB, default=dict)
    api_key: Mapped[str] = mapped_column(String, nullable=True) 
    body_template: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Native Config (for integrated tools)
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Link to external integration (Google/Microsoft account)
    integration_id: Mapped[str] = mapped_column(String, ForeignKey("integrations.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user: Mapped["UserORM"] = relationship(back_populates="tools")
    agents: Mapped[list["AgentORM"]] = relationship(secondary=agent_tools, back_populates="tools")

class IntegrationORM(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    provider: Mapped[str] = mapped_column(String) # google, microsoft, slack
    
    # NEW: Integration Type and Credentials
    integration_type: Mapped[str] = mapped_column(String, default="OAUTH") # OAUTH, SERVICE_ACCOUNT
    credentials: Mapped[dict] = mapped_column(JSONB, nullable=True) # Full Service Account JSON
    
    # Encrypted credentials (managed by Vault) for OAUTH flow
    access_token: Mapped[str] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    scopes: Mapped[list[str]] = mapped_column(JSONB, default=list) # Authorized scopes
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped["UserORM"] = relationship(back_populates="integrations")

class PhoneNumberORM(Base):
    __tablename__ = "phone_numbers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), index=True)
    number: Mapped[str] = mapped_column(String, unique=True, index=True)
    provider: Mapped[str] = mapped_column(String) # e.g., 'twilio', 'telnyx'
    provider_sid: Mapped[str] = mapped_column(String, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    user: Mapped["UserORM"] = relationship(back_populates="phone_numbers")

class CallDirection(enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

class CallORM(Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, index=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), index=True)
    session_id: Mapped[str] = mapped_column(String, index=True) # LiveKit Room Name
    
    from_number: Mapped[str] = mapped_column(String, nullable=True)
    to_number: Mapped[str] = mapped_column(String, nullable=True)
    direction: Mapped[CallDirection] = mapped_column(Enum(CallDirection), default=CallDirection.OUTBOUND)
    
    status: Mapped[str] = mapped_column(String, default="initiated")
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_used: Mapped[int] = mapped_column(default=0)
    
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    agent: Mapped["AgentORM"] = relationship(back_populates="calls")
    transcriptions: Mapped[list["TranscriptORM"]] = relationship(back_populates="call")

class TranscriptORM(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(String, ForeignKey("calls.id"), index=True)
    role: Mapped[str] = mapped_column(String) # "user" or "agent"
    content: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    call: Mapped["CallORM"] = relationship(back_populates="transcriptions")

class UsageORM(Base):
    """Legacy usage logs table for backward compatibility or general tracking."""
    __tablename__ = "usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    agent_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    tokens_used: Mapped[int] = mapped_column(default=0)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProviderConnectionORM(Base):
    __tablename__ = "provider_connections"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String, index=True) # openai, openrouter, anthropic, groq, gemini, together_ai, deepseek, elevenlabs, cartesia, assemblyai
    api_key: Mapped[str] = mapped_column(Text) # Encrypted
    status: Mapped[str] = mapped_column(String, default="connected")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    models: Mapped[list["ProviderModelORM"]] = relationship(back_populates="connection", cascade="all, delete-orphan")


class ProviderModelORM(Base):
    __tablename__ = "provider_models"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    provider_connection_id: Mapped[str] = mapped_column(String, ForeignKey("provider_connections.id", ondelete="CASCADE"), index=True)
    model_id: Mapped[str] = mapped_column(String, index=True) # API model id (gpt-4o, etc.)
    name: Mapped[str] = mapped_column(String) # friendly name
    context_window: Mapped[int] = mapped_column(default=0)
    capabilities: Mapped[dict] = mapped_column(JSONB, default=dict) # supports_vision, supports_audio, etc.
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    connection: Mapped["ProviderConnectionORM"] = relationship(back_populates="models")

