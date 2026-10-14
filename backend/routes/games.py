from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Game

games_bp = Blueprint('games', __name__)


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
