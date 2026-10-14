#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Install frontend deps if node_modules is missing or package.json changed
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "→ Installing frontend dependencies..."
  npm install --prefix "$ROOT/frontend"
fi

# Start Flask (avoid port 5000 — macOS AirPlay Receiver squats on it)
echo "→ Starting Flask on http://localhost:5001"
python3 -m flask --app backend.app run --debug --port 5001 &
FLASK_PID=$!

# Start Vite (avoid port 5173 — macOS AirPlay Receiver also squats on it)
echo "→ Starting Vite on http://localhost:3000"
npm run dev --prefix "$ROOT/frontend" &
VITE_PID=$!

# Kill both on Ctrl+C
trap 'echo; echo "Stopping..."; kill $FLASK_PID $VITE_PID 2>/dev/null; exit 0' INT TERM

echo ""
echo "  App:  http://localhost:3000"
echo "  API:  http://localhost:5001/api/auth/me"
echo "  Press Ctrl+C to stop."
echo ""

wait
