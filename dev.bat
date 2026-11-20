@echo off
rem windows version of dev.sh -- starts the backend (flask on :5001) and
rem the frontend (vite on :3000) in two windows. the backend reads .env
rem itself so nothing to load here

cd /d "%~dp0"

if not exist frontend\node_modules (
    echo Installing frontend dependencies...
    call npm install --prefix frontend
)

start "GameBuddy backend" cmd /k python -m flask --app backend.app run --debug --port 5001
start "GameBuddy frontend" cmd /k npm run dev --prefix frontend

echo.
echo   Open: http://localhost:3000
echo   Close the two windows to stop.
