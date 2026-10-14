#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Load .env if present
[ -f "$ROOT/.env" ] && export $(grep -v '^#' "$ROOT/.env" | xargs)

# Install frontend deps if missing
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "→ Installing frontend dependencies..."
  npm install --prefix "$ROOT/frontend"
fi

# Start Flask on :5001 (port 5000 is taken by macOS AirPlay)
echo "→ Flask:  http://localhost:5001"
python3 -m flask --app backend.app run --debug --port 5001 &
FLASK_PID=$!

# Start Vite on :3000 (port 5173 is taken by macOS AirPlay)
echo "→ Vite:   http://localhost:3000"
npm run dev --prefix "$ROOT/frontend" &
VITE_PID=$!

trap 'echo; echo "Stopping..."; kill $FLASK_PID $VITE_PID 2>/dev/null; exit 0' INT TERM

echo ""
echo "  Open: http://localhost:3000"
echo "  Ctrl+C to stop."
echo ""

wait
