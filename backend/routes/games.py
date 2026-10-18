from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Game, UserGame

games_bp = Blueprint('games', __name__)

VALID_STATUSES = {'want_to_play', 'playing', 'completed'}


@games_bp.get('')
def get_games():
    q     = request.args.get('q', '').strip().lower()
    limit = min(int(request.args.get('limit', 50)), 200)

    query = Game.query.order_by(Game.title)
    if q:
        query = query.filter(Game.match_title.contains(q))

    games = query.limit(limit).all()
    return jsonify(games=[g.to_dict() for g in games], total=len(games))


@games_bp.get('/<int:game_id>')
def get_game(game_id):
    game = db.session.get(Game, game_id)
    if not game:
        return jsonify(error='game not found'), 404
    return jsonify(game=game.to_dict())


@games_bp.get('/user-games')
@jwt_required()
def get_user_games():
    user_id  = int(get_jwt_identity())
    statuses = request.args.getlist('status')

    query = (
        db.session.query(UserGame, Game)
        .join(Game, Game.game_id == UserGame.game_id)
        .filter(UserGame.user_id == user_id)
    )
    if statuses:
        query = query.filter(UserGame.status.in_(statuses))

    rows = query.order_by(UserGame.added_at.desc()).all()

    result = []
    for ug, game in rows:
        entry = ug.to_dict()
        entry['game'] = game.to_dict()
        result.append(entry)

    return jsonify(user_games=result)


@games_bp.post('/user-games')
@jwt_required()
def add_user_game():
    user_id = int(get_jwt_identity())
    data    = request.get_json(silent=True) or {}
    game_id = data.get('game_id')
    status  = data.get('status', 'want_to_play')

    if not game_id:
        return jsonify(error='game_id is required'), 400
    if status not in VALID_STATUSES:
        return jsonify(error=f'status must be one of {sorted(VALID_STATUSES)}'), 400
    if not db.session.get(Game, game_id):
        return jsonify(error='game not found'), 404

    existing = UserGame.query.filter_by(user_id=user_id, game_id=game_id).first()
    if existing:
        existing.status = status
        db.session.commit()
        return jsonify(user_game=existing.to_dict()), 200

    ug = UserGame(user_id=user_id, game_id=game_id, status=status)
    db.session.add(ug)
    db.session.commit()
    return jsonify(user_game=ug.to_dict()), 201
