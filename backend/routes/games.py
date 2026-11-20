from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from game_matching import normalize_title

from ..db import query
from ..extensions import db
from ..models import Game, UserGame, Listing, Platform, PriceHistory
from .submissions import game_summary
from .watchlist import default_category_id

games_bp = Blueprint('games', __name__)

VALID_STATUSES = {'want_to_play', 'backlog', 'playing', 'completed'}  # backlog = owned, not played yet


@games_bp.get('')
def get_games():
    # cleaned up the same way match_title is, so "Pokémon" finds "pokemon"
    q     = normalize_title(request.args.get('q', ''))
    limit = min(int(request.args.get('limit', 50)), 200)

    query = Game.query.order_by(Game.title)
    if q:
        query = query.filter(Game.match_title.contains(q))

    games = query.limit(limit).all()
    return jsonify(games=[g.to_dict() for g in games], total=len(games))


@games_bp.get('/<int:game_id>')
@jwt_required(optional=True)
def get_game(game_id):
    """game page: details, every store's price, and price history for the
    chart. (brandon's version from the old app.py -- replaced the simpler
    one here since nothing in the frontend called it yet.) works logged
    out too, you just don't get your own watchlist info"""
    identity = get_jwt_identity()
    user_id = int(identity) if identity else None

    history_range = request.args.get('range', '1Y')
    ranges = {'3M': -3, '1Y': -12, 'All': None}
    if history_range not in ranges:
        return jsonify(error='range must be 3M, 1Y, or All'), 400
    months = ranges[history_range]

    # Game details and this user's wishlist settings
    game = query(
        """
        SELECT
            g.game_id,
            g.title,
            g.developer,
            g.publisher,
            g.release_year,
            g.synopsis,
            ug.user_game_id IS NOT NULL AS on_watchlist,
            ug.added_at AS watchlist_since,
            ug.notify_enabled AS notify,
            ug.target_price
        FROM games g
        LEFT JOIN user_games ug
            ON ug.game_id = g.game_id
            AND ug.user_id = %s
            AND ug.status = 'want_to_play'
        WHERE g.game_id = %s
        """,
        (user_id, game_id), one=True,
    )
    if game is None:
        return jsonify(error='game not found'), 404

    game['on_watchlist'] = bool(game['on_watchlist'])
    game['notify'] = bool(game['notify'])
    game['platform'] = 'PC'

    # user-submitted / mod info + tags (phase 2)
    extra = game_summary(game_id)
    for key in ('submitted_by', 'base_game_id', 'base_game_title', 'mod_count', 'tags'):
        game[key] = extra[key]

    # Store prices and each store's lowest recorded price
    stores = query(
        """
        SELECT
            p.name AS store,
            p.platform_type AS store_type,  -- pc / mobile / ... so the page can group them
            l.current_price AS price,
            l.regular_price,
            CASE
                WHEN l.regular_price > 0
                THEN ROUND(
                    (l.regular_price - l.current_price)
                    / l.regular_price * 100
                )
                WHEN l.regular_price = 0
                     AND l.current_price = 0
                THEN 0
            END AS discount_percent,
            l.currency,
            COALESCE(l.listing_url, gs.source_url) AS url,
            l.last_checked_at,
            (
                SELECT MIN(ph.price)
                FROM price_history ph
                WHERE ph.listing_id = l.listing_id
            ) AS lowest_ever
        FROM listings l
        JOIN platforms p
            ON p.platform_id = l.platform_id
        LEFT JOIN game_sources gs
            ON gs.game_id = l.game_id
            AND gs.platform_id = l.platform_id
        WHERE l.game_id = %s
        ORDER BY
            l.current_price IS NULL,
            l.current_price,
            p.name
        """,
        (game_id,),
    )
    game['stores'] = stores
    game['best'] = next((s for s in stores if s['price'] is not None), None)
    game['lowest_ever'] = min(
        (s['lowest_ever'] for s in stores if s['lowest_ever'] is not None),
        default=None,
    )

    # Price history for the requested chart range
    game['history'] = query(
        """
        SELECT
            ph.recorded_at AS date,
            p.name AS store,
            ph.price
        FROM price_history ph
        JOIN listings l
            ON l.listing_id = ph.listing_id
        JOIN platforms p
            ON p.platform_id = l.platform_id
        WHERE l.game_id = %s
          AND (
              %s IS NULL
              OR ph.recorded_at >= TIMESTAMPADD(MONTH, %s, NOW())
          )
        ORDER BY ph.recorded_at, ph.history_id
        """,
        (game_id, months, months),
    )
    return jsonify(game)


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
    if status == 'want_to_play':
        # without a category record_price_check never alerts on it,
        # so wishlist games start in the user's default category
        ug.category_id = default_category_id(user_id)
    db.session.add(ug)
    db.session.commit()
    return jsonify(user_game=ug.to_dict()), 201
