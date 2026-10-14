# ── Stage 1: build the React frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Python app ─────────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /build/dist ./frontend/dist

CMD gunicorn backend.app:app --bind "0.0.0.0:${PORT:-8000}" --workers 2 --timeout 60
