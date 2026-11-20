"""
backend/routes/watchlist.py

the price tracking side of the app: wishlist ("watchlist"), search,
alerts, and the user's notification categories. ported from brandon's
app.py into harish's app so it runs behind the same login -- the SQL is
the same, the only real change is user_id comes from the logged-in user
instead of being hardcoded to 1.

a watchlist game is a user_games row with status 'want_to_play'.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from pymysql.err import IntegrityError

from ..db import execute, query

watchlist_bp = Blueprint("watchlist", __name__)

# what every new account starts with (see auth.register). check interval
# is in minutes, NULL = never auto check (muted)
DEFAULT_CATEGORIES = [
    ("Hunting hard", 60),
    ("Someday maybe", 10080),  # once a week
    ("Muted", None),
]


def current_user_id():
    return int(get_jwt_identity())


def ensure_default_categories(user_id):
    """gives the user the default categories if they don't have any yet.
    INSERT IGNORE + the (user_id, name) unique key make this safe to call
    more than once"""
    for name, minutes in DEFAULT_CATEGORIES:
        execute(
            "INSERT IGNORE INTO notification_categories (user_id, name, check_interval_minutes) "
            "VALUES (%s, %s, %s)",
            (user_id, name, minutes),
        )


def default_category_id(user_id):
    ensure_default_categories(user_id)
    row = query(
        "SELECT category_id FROM notification_categories "
        "WHERE user_id = %s ORDER BY category_id LIMIT 1",
        (user_id,), one=True,
    )
    return row["category_id"]


def category_belongs_to(category_id, user_id):
    return query(
        "SELECT 1 FROM notification_categories WHERE category_id = %s AND user_id = %s",
        (category_id, user_id), one=True,
    ) is not None


# ----------------------------
# CATEGORIES
# ----------------------------

@watchlist_bp.get("/categories")
@jwt_required()
def get_categories():
    user_id = current_user_id()
    ensure_default_categories(user_id)
    return jsonify(categories=query(
        """
        SELECT category_id, name, check_interval_minutes
        FROM notification_categories
        WHERE user_id = %s
        ORDER BY category_id
        """,
        (user_id,),
    ))


# ----------------------------
# WATCHLIST
# ----------------------------

@watchlist_bp.get("/watchlist")
@jwt_required()
def get_watchlist():
    rows = query(
        """
        SELECT
            ug.user_game_id,
            g.game_id,
            g.title,
            nc.category_id,
            nc.name AS category_name,
            nc.check_interval_minutes,
            ug.target_price,
            ug.notify_enabled,
            ug.added_at,
            cbp.current_price AS best_price,
            cbp.regular_price,
            cbp.discount_percent,
            cbp.platform_name AS store,
            cbp.last_checked_at
        FROM user_games ug
        JOIN games g
            ON g.game_id = ug.game_id
        LEFT JOIN notification_categories nc
            ON nc.category_id = ug.category_id
        LEFT JOIN current_best_prices cbp
            ON cbp.game_id = ug.game_id
        WHERE ug.user_id = %s
          AND ug.status = 'want_to_play'
        ORDER BY g.title
        """,
        (current_user_id(),),
    )

    # the view can give a game twice if two stores tie for cheapest,
    # so keep the first row per game
    games = {}
    for row in rows:
        if row["game_id"] in games:
            continue
        games[row["game_id"]] = {
            "game_id": row["game_id"],
            "title": row["title"],
            "category": {
                "category_id": row["category_id"],
                "name": row["category_name"],
                "check_interval_minutes": row["check_interval_minutes"],
            },
            "target_price": row["target_price"],
            "notify_enabled": bool(row["notify_enabled"]),
            "notify": bool(row["notify_enabled"]),
            "best_price": row["best_price"],
            "regular_price": row["regular_price"],
            "discount_percent": row["discount_percent"],
            "store": row["store"],
            "last_checked_at": row["last_checked_at"],
            "added_at": row["added_at"],
        }

    return jsonify({
        "total": len(games),
        "stores": sorted({r["store"] for r in rows if r["store"] is not None}),
        "games": list(games.values()),
    })


@watchlist_bp.post("/watchlist")
@jwt_required()
def add_to_watchlist():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    game_id = data.get("game_id")
    category_id = data.get("category_id")
    target_price = data.get("target_price")
    notify_enabled = data.get("notify_enabled", True)

    if not isinstance(game_id, int):
        return jsonify({"error": "game_id is required"}), 400

    game = query("SELECT game_id, title FROM games WHERE game_id = %s", (game_id,), one=True)
    if game is None:
        return jsonify({"error": "Game not found"}), 404

    # category is optional now -- the frontend's add button doesn't ask
    # for one, so fall back to the user's first (default) category
    if category_id is None:
        category_id = default_category_id(user_id)
    elif not category_belongs_to(category_id, user_id):
        return jsonify({"error": "Category not found"}), 404

    try:
        execute(
            """
            INSERT INTO user_games
                (user_id, game_id, category_id, target_price,
                 notify_enabled, status)
            VALUES
                (%s, %s, %s, %s, %s, 'want_to_play')
            """,
            (user_id, game_id, category_id, target_price, notify_enabled),
        )
    except IntegrityError:
        return jsonify({"error": "Game is already on the watchlist"}), 409

    return jsonify({
        "message": "Game added to watchlist",
        "game_id": game_id,
        "title": game["title"],
    }), 201


@watchlist_bp.patch("/watchlist/<int:game_id>")
@jwt_required()
def update_watchlist(game_id):
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}

    allowed_fields = ("category_id", "target_price", "notify_enabled")
    if not any(field in data for field in allowed_fields):
        return jsonify({
            "error": "Provide category_id, target_price, or notify_enabled"
        }), 400

    on_list = query(
        """
        SELECT user_game_id FROM user_games
        WHERE user_id = %s AND game_id = %s AND status = 'want_to_play'
        """,
        (user_id, game_id), one=True,
    )
    if on_list is None:
        return jsonify({"error": "Game is not on the watchlist"}), 404

    if data.get("category_id") is not None and not category_belongs_to(data["category_id"], user_id):
        return jsonify({"error": "Category not found"}), 404

    # column names only ever come from allowed_fields, never from the
    # request, so building the SET list like this is safe
    updates = [f"{field} = %s" for field in allowed_fields if field in data]
    values = [data[field] for field in allowed_fields if field in data]

    execute(
        f"""
        UPDATE user_games
        SET {", ".join(updates)}
        WHERE user_id = %s AND game_id = %s AND status = 'want_to_play'
        """,
        (*values, user_id, game_id),
    )
    return jsonify({"message": "Watchlist item updated", "game_id": game_id})


@watchlist_bp.delete("/watchlist/<int:game_id>")
@jwt_required()
def remove_from_watchlist(game_id):
    removed, _ = execute(
        """
        DELETE FROM user_games
        WHERE user_id = %s AND game_id = %s AND status = 'want_to_play'
        """,
        (current_user_id(), game_id),
    )
    if removed == 0:
        return jsonify({"error": "Game is not on the watchlist"}), 404
    return "", 204


# ----------------------------
# SEARCH
# ----------------------------

@watchlist_bp.get("/search")
@jwt_required()
def search_games():
    text = request.args.get("q", "").strip()
    if len(text) < 2:
        return jsonify({"error": "Enter at least 2 characters"}), 400

    # Treat search text literally, including % and _ characters.
    search_text = text.replace("!", "!!").replace("%", "!%").replace("_", "!_")

    results = query(
        """
        SELECT
            g.game_id,
            g.title,
            (
                SELECT COUNT(*)
                FROM listings l
                WHERE l.game_id = g.game_id
            ) AS stores_found,
            (
                SELECT MIN(l.current_price)
                FROM listings l
                WHERE l.game_id = g.game_id
            ) AS best_price,
            (
                SELECT p.name
                FROM listings l
                JOIN platforms p
                    ON p.platform_id = l.platform_id
                WHERE l.game_id = g.game_id
                  AND l.current_price IS NOT NULL
                ORDER BY l.current_price, p.name
                LIMIT 1
            ) AS best_store,
            EXISTS (
                SELECT 1
                FROM user_games ug
                WHERE ug.game_id = g.game_id
                  AND ug.user_id = %s
                  AND ug.status = 'want_to_play'
            ) AS on_watchlist
        FROM games g
        WHERE g.title LIKE %s ESCAPE '!'
        ORDER BY g.title, g.game_id
        LIMIT 20
        """,
        (current_user_id(), f"%{search_text}%"),
    )
    for game in results:
        game["on_watchlist"] = bool(game["on_watchlist"])
    return jsonify({"results": results})


# ----------------------------
# ALERTS
# ----------------------------

@watchlist_bp.get("/alerts")
@jwt_required()
def get_alerts():
    alerts = query(
        """
        SELECT
            n.notification_id,
            g.game_id,
            g.title,
            p.name AS store,
            ph.price,
            l.currency,
            n.target_price,
            NULL AS discount_percent,
            ph.price <= (
                SELECT MIN(earlier.price)
                FROM price_history earlier
                JOIN listings earlier_listing
                    ON earlier_listing.listing_id = earlier.listing_id
                WHERE earlier_listing.game_id = g.game_id
                  AND earlier_listing.currency = l.currency
                  AND earlier.history_id <= ph.history_id
            ) AS is_lowest_ever,
            n.triggered_at,
            n.is_read
        FROM notifications n
        JOIN user_games ug
            ON ug.user_game_id = n.user_game_id
        JOIN games g
            ON g.game_id = ug.game_id
        JOIN price_history ph
            ON ph.history_id = n.price_history_id
        JOIN listings l
            ON l.listing_id = ph.listing_id
        JOIN platforms p
            ON p.platform_id = l.platform_id
        WHERE ug.user_id = %s
        ORDER BY n.triggered_at DESC, n.notification_id DESC
        LIMIT 100
        """,
        (current_user_id(),),
    )
    for alert in alerts:
        alert["is_read"] = bool(alert["is_read"])
        alert["is_lowest_ever"] = bool(alert["is_lowest_ever"])
    return jsonify({"alerts": alerts})
