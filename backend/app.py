import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from flask import Flask, send_from_directory, jsonify

load_dotenv()  # same .env as the import scripts


def database_url():
    """railway gives us DATABASE_URL (or MYSQL_URL). locally we build it
    from the same DB_HOST / DB_USER / DB_PASSWORD / DB_NAME the import
    scripts use, so there's only one .env to fill in. no sqlite fallback
    anymore -- the schema needs mysql (stored procedures, views)"""
    url = os.environ.get('DATABASE_URL') or os.environ.get('MYSQL_URL')
    if not url:
        password = os.environ.get('DB_PASSWORD')
        if not password:
            raise RuntimeError(
                'Set DATABASE_URL, or copy .env.example to .env and fill in '
                'DB_PASSWORD (same as for the import scripts).'
            )
        url = 'mysql+pymysql://{}:{}@{}/{}'.format(
            quote_plus(os.environ.get('DB_USER', 'root')),
            quote_plus(password),
            os.environ.get('DB_HOST', 'localhost'),
            os.environ.get('DB_NAME', 'game_tracker'),
        )
    # Railway's MySQL plugin may give mysql:// — SQLAlchemy needs mysql+pymysql://
    if url.startswith('mysql://'):
        url = url.replace('mysql://', 'mysql+pymysql://', 1)
    return url


def create_app():
    dist_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
    )
    # Don't pass static_folder to Flask — we handle all file serving ourselves
    # in the catch-all so Flask never tries to serve a directory (which returns 403)
    app = Flask(__name__)

    # ── Config ────────────────────────────────────────────────────────────────
    app.config.update(
        SQLALCHEMY_DATABASE_URI=database_url(),
        SQLALCHEMY_ENGINE_OPTIONS={'pool_pre_ping': True},  # survive mysql dropping idle connections
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev-flask-secret-change-me'),
        JWT_SECRET_KEY=os.environ.get('JWT_SECRET_KEY', 'dev-jwt-secret-change-me'),
    )

    # ── Extensions ────────────────────────────────────────────────────────────
    from .extensions import db, jwt
    db.init_app(app)
    jwt.init_app(app)

    # ── Blueprints ────────────────────────────────────────────────────────────
    from .routes.auth import auth_bp
    from .routes.games import games_bp
    from .routes.watchlist import watchlist_bp
    from .routes.library import library_bp
    from .routes.submissions import submissions_bp
    app.register_blueprint(auth_bp,  url_prefix='/api/auth')
    app.register_blueprint(games_bp, url_prefix='/api/games')
    app.register_blueprint(watchlist_bp, url_prefix='/api')  # /api/watchlist, /api/search, /api/alerts, /api/categories
    app.register_blueprint(library_bp, url_prefix='/api')    # /api/library
    app.register_blueprint(submissions_bp, url_prefix='/api/games')  # POST /api/games (user-added games + mods)

    # ── Tables ────────────────────────────────────────────────────────────────
    # no db.create_all() -- schema.sql is the one source of truth (it has
    # the views, procedures and constraints the models don't know about).
    # create_all would quietly make thinner versions of the tables on a
    # fresh db and then schema.sql's CREATE TABLE IF NOT EXISTS would skip
    # them. run `python init_db.py` to set up a new database instead
    from . import models  # noqa: F401 — registers models with SQLAlchemy

    # ── Serve React (catch-all must be registered last) ───────────────────────
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if not os.path.isdir(dist_dir):
            return jsonify(message='API is running — frontend not built yet'), 200
        target = os.path.join(dist_dir, path)
        # Only serve if it's an actual file — directories would return 403
        if path and os.path.isfile(target):
            return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, 'index.html')

    return app


app = create_app()
