"""
backend/routes/submissions.py

phase 2 -- games users add themselves: mods, obscure / delisted games,
stuff on stores we don't import from. they live in the same games table
as imported games (submitted_by says who added it), so they show up in
search, can go on wishlists, and get price alerts like anything else.

who can edit them? (open question in the design doc) -- the team decided
only the person who submitted it can edit it or log prices for it.
easy to loosen later (e.g. let anyone suggest a price).
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from pymysql.err import OperationalError

from game_matching import normalize_title

from ..db import call_proc, execute, query

submissions_bp = Blueprint("submissions", __name__)

TEXT_FIELDS = {"genre": 100, "developer": 255, "publisher": 255, "synopsis": 5000}
STORE_TYPES = ("pc", "console", "vr", "mobile", "mods")  # platforms.platform_type


def current_user_id():
    return int(get_jwt_identity())


def check_game_fields(data, creating):
    """validates the game fields from the request. returns an error
    message or None"""
    title = data.get("title")
    if creating or "title" in data:
        if not isinstance(title, str) or not title.strip() or len(title) > 255:
            return "title is required (max 255 characters)"
    for field, limit in TEXT_FIELDS.items():
        value = data.get(field)
        if value is not None and (not isinstance(value, str) or len(value) > limit):
            return f"{field} must be text (max {limit} characters)"
    year = data.get("release_year")
    if year is not None and (isinstance(year, bool) or not isinstance(year, int) or not 1950 <= year <= 2100):
        return "release_year must be a year like 2017"
    tags = data.get("tags")
    if tags is not None and (not isinstance(tags, list) or
                             not all(isinstance(t, str) and 0 < len(t.strip()) <= 50 for t in tags)):
        return "tags must be a list of short labels like [\"mod\", \"vr\"]"
    return None


def set_tags(game_id, tags):
    """replaces the game's tags. tags is many-to-many (tags + game_tags),
    new labels get created the first time someone uses them"""
    execute("DELETE FROM game_tags WHERE game_id = %s", (game_id,))
    for tag in {t.strip().lower() for t in tags}:
        execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag,))
        execute(
            "INSERT IGNORE INTO game_tags (game_id, tag_id) "
            "SELECT %s, tag_id FROM tags WHERE name = %s",
            (game_id, tag),
        )


def owned_submission(game_id, user_id):
    """returns (game row, error response). the error is set if the game
    doesn't exist or this user didn't submit it"""
    game = query("SELECT game_id, submitted_by FROM games WHERE game_id = %s", (game_id,), one=True)
    if game is None:
        return None, (jsonify(error="game not found"), 404)
    if game["submitted_by"] != user_id:
        return None, (jsonify(error="only the person who added this game can change it"), 403)
    return game, None


@submissions_bp.post("")
@jwt_required()
def submit_game():
    user_id = current_user_id()
    data = request.get_json(silent=True) or {}
    problem = check_game_fields(data, creating=True)
    if problem:
        return jsonify(error=problem), 400

    base_game_id = data.get("base_game_id")
    if base_game_id is not None:
        if not isinstance(base_game_id, int) or query(
                "SELECT 1 FROM games WHERE game_id = %s", (base_game_id,), one=True) is None:
            return jsonify(error="base_game_id doesn't match a game"), 404

    # don't let people re-add a game we already have (unless it's a mod,
    # mods share names with their game all the time). send "force": true
    # if it really is a different game with the same name
    match = normalize_title(data["title"])
    if base_game_id is None and not data.get("force"):
        existing = query(
            "SELECT game_id, title FROM games WHERE match_title = %s LIMIT 1", (match,), one=True)
        if existing:
            return jsonify(error="we already have a game with that name", game=existing), 409

    _, game_id = execute(
        """
        INSERT INTO games
            (title, match_title, genre, developer, publisher, release_year,
             synopsis, submitted_by, base_game_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (data["title"].strip(), match, data.get("genre"), data.get("developer"),
         data.get("publisher"), data.get("release_year"), data.get("synopsis"),
         user_id, base_game_id),
    )
    tags = list(data.get("tags") or [])
    if base_game_id is not None:
        tags.append("mod")  # mods always get the mod tag so you can filter on it
    if tags:
        set_tags(game_id, tags)
    return jsonify(game=game_summary(game_id)), 201


@submissions_bp.patch("/<int:game_id>")
@jwt_required()
def edit_game(game_id):
    _, err = owned_submission(game_id, current_user_id())
    if err:
        return err
    data = request.get_json(silent=True) or {}
    problem = check_game_fields(data, creating=False)
    if problem:
        return jsonify(error=problem), 400

    fields = {k: data[k] for k in ("genre", "developer", "publisher", "release_year", "synopsis") if k in data}
    if "title" in data:
        fields["title"] = data["title"].strip()
        fields["match_title"] = normalize_title(data["title"])
    if fields:
        # column names come from the fixed list above, never the request
        execute(
            f"UPDATE games SET {', '.join(f'{k} = %s' for k in fields)} WHERE game_id = %s",
            (*fields.values(), game_id),
        )
    if "tags" in data:
        set_tags(game_id, data["tags"])
    if not fields and "tags" not in data:
        return jsonify(error="nothing to change"), 400
    return jsonify(game=game_summary(game_id))


@submissions_bp.post("/<int:game_id>/prices")
@jwt_required()
def log_price(game_id):
    """log a price you found for your game (on itch.io, a mod store, the
    app store, wherever). goes through record_price_check like the import
    scripts do, so it lands in price_history and can trigger alerts"""
    _, err = owned_submission(game_id, current_user_id())
    if err:
        return err
    data = request.get_json(silent=True) or {}
    store, price = data.get("store"), data.get("price")
    regular = data.get("regular_price", price)
    store_type = data.get("store_type", "pc")
    url = data.get("url")

    if not isinstance(store, str) or not store.strip() or len(store) > 100:
        return jsonify(error="store is required, like \"itch.io\""), 400
    for name, value in (("price", price), ("regular_price", regular)):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
            return jsonify(error=f"{name} must be a number >= 0"), 400
    if store_type not in STORE_TYPES:
        return jsonify(error=f"store_type must be one of: {', '.join(STORE_TYPES)}"), 400
    if url is not None and (not isinstance(url, str) or len(url) > 500 or
                            not url.startswith(("http://", "https://"))):
        return jsonify(error="url must start with http:// or https://"), 400

    store = store.strip()
    execute("INSERT IGNORE INTO platforms (name, platform_type) VALUES (%s, %s)", (store, store_type))
    platform = query("SELECT platform_id FROM platforms WHERE name = %s", (store,), one=True)
    execute(
        """
        INSERT INTO listings (game_id, platform_id, listing_url)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE listing_url = COALESCE(VALUES(listing_url), listing_url)
        """,
        (game_id, platform["platform_id"], url),
    )
    listing = query(
        "SELECT listing_id FROM listings WHERE game_id = %s AND platform_id = %s",
        (game_id, platform["platform_id"]), one=True,
    )
    try:
        call_proc("record_price_check", [listing["listing_id"], price, regular])
    except OperationalError as e:  # the procedure's own checks (SIGNAL)
        return jsonify(error=str(e.args[-1])), 400
    return jsonify(game=game_summary(game_id)), 201


@submissions_bp.get("/<int:game_id>/mods")
def get_mods(game_id):
    if query("SELECT 1 FROM games WHERE game_id = %s", (game_id,), one=True) is None:
        return jsonify(error="game not found"), 404
    mods = query(
        """
        SELECT g.game_id, g.title, g.developer, u.username AS submitted_by,
               MIN(l.current_price) AS best_price
        FROM games g
        LEFT JOIN users u    ON u.user_id = g.submitted_by
        LEFT JOIN listings l ON l.game_id = g.game_id
        WHERE g.base_game_id = %s
        GROUP BY g.game_id, g.title, g.developer, u.username
        ORDER BY g.title
        """,
        (game_id,),
    )
    return jsonify(mods=mods)


def game_summary(game_id):
    """the extra info a user-submitted game / mod has: who added it, what
    it's a mod for, its tags. also used by the game page"""
    game = query(
        """
        SELECT g.game_id, g.title, g.genre, g.developer, g.publisher,
               g.release_year, g.synopsis,
               u.username   AS submitted_by,
               base.game_id AS base_game_id,
               base.title   AS base_game_title,
               (SELECT COUNT(*) FROM games m WHERE m.base_game_id = g.game_id) AS mod_count
        FROM games g
        LEFT JOIN users u    ON u.user_id = g.submitted_by
        LEFT JOIN games base ON base.game_id = g.base_game_id
        WHERE g.game_id = %s
        """,
        (game_id,), one=True,
    )
    game["tags"] = [r["name"] for r in query(
        "SELECT t.name FROM game_tags gt JOIN tags t ON t.tag_id = gt.tag_id "
        "WHERE gt.game_id = %s ORDER BY t.name", (game_id,))]
    return game
