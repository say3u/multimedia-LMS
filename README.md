# GameBuddy

A game library tracker built for CS 514. Track games you want to play, games you're playing, and games you've completed — all in one place.

## 1. Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18, React Router v6, Vite   |
| Backend  | Flask 3, Flask-SQLAlchemy, Flask-JWT-Extended |
| Database | MySQL (production), SQLite (local dev) |
| Deploy   | Railway (Docker, Gunicorn)        |

## 2. Project Structure

```
gamebuddy/
├── backend/
│   ├── app.py          # Flask app factory
│   ├── models.py       # SQLAlchemy models
│   ├── extensions.py   # db, jwt instances
│   ├── schema.sql      # Full DB schema with stored procedures & views
│   └── routes/
│       ├── auth.py     # /api/auth — register, login, me
│       └── games.py    # /api/games — game search, user library
├── frontend/
│   ├── src/
│   │   ├── pages/      # Register, Login, Dashboard
│   │   └── components/ # Nav, AddGameModal, WaveCanvas, Footer
│   └── vite.config.js
├── Dockerfile          # Multi-stage: Node build → Python serve
├── dev.sh              # Local dev runner (Flask + Vite)
└── requirements.txt
```

## 3. How to Run This Project Locally

### Prerequisites

- Python 3.11+
- Node.js 20+

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd gamebuddy

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Copy env file and fill in values
cp .env.example .env
```

### Running

```bash
# Start both Flask (port 5001) and Vite (port 3000) together
./dev.sh
```

Then open [http://localhost:3000](http://localhost:3000).

Vite proxies all `/api` requests to Flask so there are no CORS issues in development.

### Environment Variables

| Variable        | Description                                 | Default              |
|-----------------|---------------------------------------------|----------------------|
| `DATABASE_URL`  | MySQL connection string                     | SQLite (`dev.db`)    |
| `SECRET_KEY`    | Flask secret key                            | dev default          |
| `JWT_SECRET_KEY`| JWT signing secret                          | dev default          |


## 4. How This Project is Being Deployed

The app is deployed on **Railway** using a multi-stage `Dockerfile`:

1. **Stage 1 (Node)** — installs frontend dependencies and runs `npm run build`, producing a static `dist/` folder
2. **Stage 2 (Python)** — installs Python dependencies, copies the built `dist/` from Stage 1, and starts the app with Gunicorn

Flask serves the React build directly as static files, so there is no separate frontend server in production — a single Gunicorn process handles both the API and the UI.

Railway injects `DATABASE_URL`, `SECRET_KEY`, and `JWT_SECRET_KEY` as environment variables at runtime. The app automatically switches between MySQL (production) and SQLite (local) based on whether `DATABASE_URL` is set.