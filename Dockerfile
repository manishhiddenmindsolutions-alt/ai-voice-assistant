# syntax=docker/dockerfile:1
ARG PYTHON_VERSION=3.11

# ==============================================================================
# STAGE 1: Build the React Frontend
# ==============================================================================
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first for caching
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code and build
COPY frontend/ ./
# Set VITE_API_URL empty so it falls back to window.location.origin dynamically
ENV VITE_API_URL=""
RUN npm run build

# ==============================================================================
# STAGE 2: Build Python Dependencies & Pre-download VAD Models
# ==============================================================================
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS backend-builder

# Install build dependencies for compiling any C/C++ extensions and fetching Git LFS files
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3-dev \
    git \
    git-lfs \
  && git lfs install \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files for caching
COPY pyproject.toml uv.lock ./
RUN mkdir -p agent backend

# Sync dependencies (non-dev only)
RUN uv sync --frozen --no-dev

# Copy application files
COPY agent/ ./agent/
COPY backend/ ./backend/
COPY .env.local* ./

# Pre-download VAD models so they are cached in the container image
RUN uv run python agent/main.py download-files

# ==============================================================================
# STAGE 3: Final Production Stage (Slim Runtime)
# ==============================================================================
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS runner

WORKDIR /app

# Create a non-privileged user for security
ARG UID=10001
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

# Copy virtual environment and app files from backend builder
COPY --from=backend-builder --chown=appuser:appuser /app /app
# Copy built frontend assets to the location served by FastAPI
COPY --from=frontend-builder --chown=appuser:appuser /app/frontend/dist /app/frontend/dist

# Copy the downloaded model cache (e.g. Silero VAD) to the appuser's home directory
COPY --from=backend-builder --chown=appuser:appuser /root/.cache /app/.cache

# Create data directory and ensure it is owned by appuser
RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

# Switch to home directory for appuser cache configurations
ENV HOME=/app

# Expose the single unified port
EXPOSE 8000

# Set required Python paths so all absolute/relative imports work seamlessly
ENV PYTHONPATH=/app/backend:/app
# Automatically enable the Voice Agent in the background of the FastAPI process
ENV ENABLE_BACKGROUND_AGENT=true
# Force logging in production
ENV PYTHONUNBUFFERED=1

# Switch to the non-privileged user
USER appuser

# Start the unified backend service
CMD ["uv", "run", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
