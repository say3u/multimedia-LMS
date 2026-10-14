import os
from flask import Flask, send_from_directory, jsonify


def create_app():
    dist_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
    )
    # Don't pass static_folder to Flask — we handle all file serving ourselves
    # in the catch-all so Flask never tries to serve a directory (which returns 403)
    app = Flask(__name__)

    # ── Config ────────────────────────────────────────────────────────────────
    raw_db_url = (
        os.environ.get('DATABASE_URL')
        or os.environ.get('MYSQL_URL')
        or 'sqlite:///dev.db'
    )
    # Railway's MySQL plugin may give mysql:// — SQLAlchemy needs mysql+pymysql://
    if raw_db_url.startswith('mysql://'):
        raw_db_url = raw_db_url.replace('mysql://', 'mysql+pymysql://', 1)

    app.config.update(
        SQLALCHEMY_DATABASE_URI=raw_db_url,
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
    app.register_blueprint(auth_bp,  url_prefix='/api/auth')
    app.register_blueprint(games_bp, url_prefix='/api/games')

    # ── Create tables on first run ────────────────────────────────────────────
    with app.app_context():
        from . import models  # noqa: F401 — registers models with SQLAlchemy
        db.create_all()

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
