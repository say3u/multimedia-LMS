"""
backend/routes/library.py

phase 1.5 -- games you already own ("my library"). a library game is a
user_games row with status backlog / playing / completed. none of those
get price tracked (record_price_check only looks at want_to_play), so
moving a game from the wishlist into the library is how you say "I
already have this, stop tracking its price".

status changes get logged to status_history by triggers in schema.sql,
so nothing here has to remember to do that.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..db import execute, query

library_bp = Blueprint("library", __name__)

OWNED_STATUSES = ("backlog", "playing", "completed")

# sort options for the library page (from the mockup). whitelisted so
# user input never goes straight into ORDER BY
LIBRARY_SORTS = {
    "recent": "ug.bought_at IS NULL, ug.bought_at DESC, ug.updated_at DESC",
    "name":   "g.title",
    "paid_asc":  "ug.paid_price IS NULL, ug.paid_price ASC, g.title",
    "paid_desc": "ug.paid_price IS NULL, ug.paid_price DESC, g.title",
    "saved":  "saved IS NULL, saved DESC, g.title",
}

LIBRARY_SQL = """
    SELECT
        g.game_id,
        g.title,
        ug.status,
        p.name          AS store,
        ug.paid_price,
        ug.bought_at,
        ug.updated_at,
        -- how much you saved vs that store's normal price. NULL if we
        -- don't know what you paid or don't track that store
        CASE WHEN ug.paid_price IS NOT NULL AND l.regular_price IS NOT NULL
             THEN GREATEST(l.regular_price - ug.paid_price, 0)
        END             AS saved
    FROM user_games ug
    JOIN games g          ON g.game_id = ug.game_id
    LEFT JOIN platforms p ON p.platform_id = ug.owned_platform_id
    LEFT JOIN listings l  ON l.game_id = ug.game_id
                         AND l.platform_id = ug.owned_platform_id
    WHERE ug.user_id = %s
      AND ug.status IN ('backlog', 'playing', 'completed')
"""


def current_user_id():
    return int(get_jwt_identity())


def platform_id_for(store):
    """store name -> platform_id. you can own a game on a store we don't
    import prices from (playstation, a physical copy, itch.io...), so it
    gets added to platforms if it's new"""
    if not store:
        return None
    execute("INSERT IGNORE INTO platforms (name) VALUES (%s)", (store,))
    return query("SELECT platform_id FROM platforms WHERE name = %s", (store,), one=True)["platform_id"]


def library_item(user_id, game_id):
    return query(LIBRARY_SQL + " AND ug.game_id = %s", (user_id, game_id), one=True)


def validate(data):
    """checks the optional fields shared by POST and PATCH. returns an
    error message or None"""
    if "status" in data and data["status"] not in OWNED_STATUSES:
        return f"status must be one of: {', '.join(OWNED_STATUSES)}"
    paid = data.get("paid_price")
    if paid is not None and (not isinstance(paid, (int, float)) or paid < 0):
        return "paid_price must be a number >= 0"
    if "store" in data and data["store"] is not None and not isinstance(data["store"], str):
        return "store must be a store name like \"Steam\""
    return None


@library_bp.get("/library")
@jwt_required()
def get_library():
    sort = request.args.get("sort", "recent")
    if sort not in LIBRARY_SORTS:
        return jsonify(error=f"sort must be one of: {', '.join(LIBRARY_SORTS)}"), 400

    sql, params = LIBRARY_SQL, [current_user_id()]
    status = request.args.get("status")
    if status:
        if status not in OWNED_STATUSES:
            return jsonify(error=f"status must be one of: {', '.join(OWNED_STATUSES)}"), 400
        sql += " AND ug.status = %s"
        params.append(status)

    games = query(sql + " ORDER BY " + LIBRARY_SORTS[sort], params)
    return jsonify(
        total=len(games),
        total_saved=round(sum(g["saved"] or 0 for g in games), 2),
        games=games,
    )


@library_bp.post("/library")
@jwt_required()
def add_to_library():
    """add a game you own. if it was on your wishlist it moves over
    (same row, status changes) -- so price tracking stops for it"""
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}
    game_id = data.get("game_id")
    if not isinstance(game_id, int):
        return jsonify(error="game_id is required"), 400
    problem = validate(data)
    if problem:
        return jsonify(error=problem), 400
    if query("SELECT 1 FROM games WHERE game_id = %s", (game_id,), one=True) is None:
        return jsonify(error="game not found"), 404

    existing = query(
        "SELECT status FROM user_games WHERE user_id = %s AND game_id = %s",
        (user_id, game_id), one=True,
    )
    if existing and existing["status"] in OWNED_STATUSES:
        return jsonify(error="already in your library"), 409

    # one statement either way: insert it, or flip the wishlist row over
    execute(
        """
        INSERT INTO user_games
            (user_id, game_id, status, owned_platform_id, paid_price, bought_at)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            status            = VALUES(status),
            owned_platform_id = VALUES(owned_platform_id),
            paid_price        = VALUES(paid_price),
            bought_at         = VALUES(bought_at)
        """,
        (user_id, game_id, data.get("status", "backlog"),
         platform_id_for(data.get("store")), data.get("paid_price"), data.get("bought_at")),
    )
    return jsonify(library_item(user_id, game_id)), (200 if existing else 201)


@library_bp.patch("/library/<int:game_id>")
@jwt_required()
def update_library(game_id):
    """change status (backlog -> playing -> completed), store, what you
    paid, or when you bought it"""
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}
    problem = validate(data)
    if problem:
        return jsonify(error=problem), 400
    if library_item(user_id, game_id) is None:
        return jsonify(error="not in your library"), 404

    fields = {}
    for key in ("status", "paid_price", "bought_at"):
        if key in data:
            fields[key] = data[key]
    if "store" in data:
        fields["owned_platform_id"] = platform_id_for(data["store"])
    if not fields:
        return jsonify(error="send status, store, paid_price or bought_at"), 400

    # column names come from the fixed list above, not the request
    execute(
        f"UPDATE user_games SET {', '.join(f'{k} = %s' for k in fields)} "
        "WHERE user_id = %s AND game_id = %s",
        (*fields.values(), user_id, game_id),
    )
    return jsonify(library_item(user_id, game_id))


@library_bp.delete("/library/<int:game_id>")
@jwt_required()
def remove_from_library(game_id):
    removed, _ = execute(
        "DELETE FROM user_games WHERE user_id = %s AND game_id = %s "
        "AND status IN ('backlog', 'playing', 'completed')",
        (current_user_id(), game_id),
    )
    if removed == 0:
        return jsonify(error="not in your library"), 404
    return "", 204


@library_bp.get("/library/<int:game_id>/history")
@jwt_required()
def status_timeline(game_id):
    """when you wishlisted, bought, started, finished a game -- straight
    from status_history (which the triggers fill in)"""
    return jsonify(history=query(
        """
        SELECT sh.old_status, sh.new_status, sh.changed_at
        FROM status_history sh
        JOIN user_games ug ON ug.user_game_id = sh.user_game_id
        WHERE ug.user_id = %s AND ug.game_id = %s
        ORDER BY sh.changed_at, sh.history_id
        """,
        (current_user_id(), game_id),
    ))
