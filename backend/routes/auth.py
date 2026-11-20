from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User
from .watchlist import ensure_default_categories

auth_bp = Blueprint('auth', __name__)


@auth_bp.post('/register')
def register():
    data     = request.get_json(silent=True) or {}
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify(error='username, email and password are required'), 400
    if len(username) < 3:
        return jsonify(error='username must be at least 3 characters'), 400
    if len(password) < 8:
        return jsonify(error='password must be at least 8 characters'), 400

    if User.query.filter_by(username=username).first():
        return jsonify(error='username already taken'), 409
    if User.query.filter_by(email=email).first():
        return jsonify(error='email already registered'), 409

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    # every account starts with a few notification categories so games
    # can go on the wishlist right away (see watchlist.DEFAULT_CATEGORIES)
    ensure_default_categories(user.user_id)

    token = create_access_token(identity=str(user.user_id))
    return jsonify(token=token, user=user.to_dict()), 201


@auth_bp.post('/login')
def login():
    data     = request.get_json(silent=True) or {}
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify(error='email and password are required'), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(error='invalid email or password'), 401

    token = create_access_token(identity=str(user.user_id))
    return jsonify(token=token, user=user.to_dict()), 200


@auth_bp.get('/me')
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user    = db.session.get(User, user_id)
    if not user:
        return jsonify(error='user not found'), 404
    return jsonify(user=user.to_dict())
