from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from ..extensions import db
from ..models import Game, UserGame, Listing, Platform, PriceHistory

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

    game_ids = [game.game_id for _, game in rows]
    price_map = _best_prices(game_ids)

    result = []
    for ug, game in rows:
        entry = ug.to_dict()
        entry['game'] = game.to_dict()
        entry['price_info'] = price_map.get(game.game_id)
        result.append(entry)

    return jsonify(user_games=result)


def _best_prices(game_ids):
    if not game_ids:
        return {}

    # cheapest current price per game
    min_sub = (
        db.session.query(
            Listing.game_id,
            func.min(Listing.current_price).label('min_price'),
        )
        .filter(Listing.game_id.in_(game_ids), Listing.current_price.isnot(None))
        .group_by(Listing.game_id)
        .subquery()
    )

    # all-time lowest price per game (across price_history)
    hist_sub = (
        db.session.query(
            Listing.game_id,
            func.min(PriceHistory.price).label('hist_min'),
        )
        .join(PriceHistory, PriceHistory.listing_id == Listing.listing_id)
        .filter(Listing.game_id.in_(game_ids))
        .group_by(Listing.game_id)
        .subquery()
    )

    best_rows = (
        db.session.query(Listing, Platform, min_sub.c.min_price, hist_sub.c.hist_min)
        .join(Platform, Platform.platform_id == Listing.platform_id)
        .join(min_sub, (min_sub.c.game_id == Listing.game_id) &
                       (min_sub.c.min_price == Listing.current_price))
        .outerjoin(hist_sub, hist_sub.c.game_id == Listing.game_id)
        .all()
    )

    price_map = {}
    for listing, platform, _min, hist_min in best_rows:
        if listing.game_id in price_map:
            continue
        cur = float(listing.current_price)
        reg = float(listing.regular_price) if listing.regular_price else None
        discount = (
            round((1 - cur / reg) * 100)
            if reg and reg > cur else None
        )
        hist_val = float(hist_min) if hist_min is not None else None
        price_map[listing.game_id] = {
            'price':            cur,
            'regular_price':    reg,
            'currency':         listing.currency,
            'platform':         platform.name,
            'discount_percent': discount,
            'historical_low':   hist_val,
            'listing_url':      listing.listing_url,
        }
    return price_map


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
