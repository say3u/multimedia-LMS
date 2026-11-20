"""
backend/routes/social.py

phase 2 social: following people, profiles (with privacy), the friends
activity feed, "friends who want this too", and reviews.

privacy rule everywhere: you can see someone's wishlist / library /
activity if it's you, their profile is public, or it's followers-only
and you follow them. (CAN_SEE_SQL below, so it's the same rule in every
query.) the feed itself is filled by triggers in schema.sql.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from pymysql.err import IntegrityError

from ..db import execute, query

social_bp = Blueprint("social", __name__)

VISIBILITY = ("public", "followers", "private")

# true if %(viewer)s is allowed to see user u's stuff
CAN_SEE_SQL = """(
    u.user_id = %(viewer)s
    OR u.profile_visibility = 'public'
    OR (u.profile_visibility = 'followers' AND EXISTS (
        SELECT 1 FROM follows fv
        WHERE fv.follower_id = %(viewer)s AND fv.followee_id = u.user_id))
)"""


def viewer_id():
    return int(get_jwt_identity())


def find_user(username):
    return query(
        "SELECT user_id, username, profile_visibility, created_at FROM users WHERE username = %s",
        (username,), one=True,
    )


# ----------------------------
# SETTINGS / FINDING PEOPLE
# ----------------------------

@social_bp.patch("/me")
@jwt_required()
def update_settings():
    vis = (request.get_json(silent=True) or {}).get("profile_visibility")
    if vis not in VISIBILITY:
        return jsonify(error=f"profile_visibility must be one of: {', '.join(VISIBILITY)}"), 400
    execute("UPDATE users SET profile_visibility = %s WHERE user_id = %s", (vis, viewer_id()))
    return jsonify(profile_visibility=vis)


@social_bp.get("/users")
@jwt_required()
def search_users():
    text = (request.args.get("q") or "").strip()
    if len(text) < 2:
        return jsonify(error="Enter at least 2 characters"), 400
    text = text.replace("!", "!!").replace("%", "!%").replace("_", "!_")
    users = query(
        """
        SELECT u.username,
               EXISTS (SELECT 1 FROM follows f
                       WHERE f.follower_id = %(viewer)s AND f.followee_id = u.user_id) AS is_following
        FROM users u
        WHERE u.username LIKE %(text)s ESCAPE '!'
          AND u.user_id <> %(viewer)s
        ORDER BY u.username
        LIMIT 20
        """,
        {"viewer": viewer_id(), "text": f"{text}%"},
    )
    for u in users:
        u["is_following"] = bool(u["is_following"])
    return jsonify(users=users)


# ----------------------------
# FOLLOWING
# ----------------------------

@social_bp.post("/users/<username>/follow")
@jwt_required()
def follow(username):
    user = find_user(username)
    if user is None:
        return jsonify(error="user not found"), 404
    if user["user_id"] == viewer_id():
        return jsonify(error="you can't follow yourself"), 400
    try:
        execute("INSERT INTO follows (follower_id, followee_id) VALUES (%s, %s)",
                (viewer_id(), user["user_id"]))
    except IntegrityError:
        return jsonify(error="already following"), 409
    return jsonify(following=username), 201


@social_bp.delete("/users/<username>/follow")
@jwt_required()
def unfollow(username):
    user = find_user(username)
    if user is None:
        return jsonify(error="user not found"), 404
    removed, _ = execute("DELETE FROM follows WHERE follower_id = %s AND followee_id = %s",
                         (viewer_id(), user["user_id"]))
    if removed == 0:
        return jsonify(error="not following"), 404
    return "", 204


# ----------------------------
# PROFILES
# ----------------------------

@social_bp.get("/users/<username>")
@jwt_required()
def profile(username):
    me = viewer_id()
    user = query(
        f"""
        SELECT u.user_id, u.username, u.profile_visibility, u.created_at,
               (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.user_id) AS followers,
               (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.user_id) AS following,
               EXISTS (SELECT 1 FROM follows f
                       WHERE f.follower_id = %(viewer)s AND f.followee_id = u.user_id) AS is_following,
               {CAN_SEE_SQL} AS can_see
        FROM users u
        WHERE u.username = %(name)s
        """,
        {"viewer": me, "name": username}, one=True,
    )
    if user is None:
        return jsonify(error="user not found"), 404
    for k in ("is_following", "can_see"):
        user[k] = bool(user[k])
    owner = user.pop("user_id")

    if not user["can_see"]:
        # just the basics, so you can still decide to follow them
        return jsonify(user=user, wishlist=None, library=None, activity=None)

    wishlist = query(
        """
        SELECT g.game_id, g.title, cbp.current_price AS best_price, cbp.platform_name AS store
        FROM user_games ug
        JOIN games g ON g.game_id = ug.game_id
        LEFT JOIN (SELECT game_id, MIN(current_price) AS current_price, MIN(platform_name) AS platform_name
                   FROM current_best_prices GROUP BY game_id) cbp ON cbp.game_id = g.game_id
        WHERE ug.user_id = %s AND ug.status = 'want_to_play'
        ORDER BY ug.added_at DESC
        """,
        (owner,),
    )
    # library as counts per status ("12 in backlog, 30 finished")
    library = {r["status"]: r["games"] for r in query(
        """
        SELECT status, COUNT(*) AS games FROM user_games
        WHERE user_id = %s AND status <> 'want_to_play'
        GROUP BY status
        """,
        (owner,),
    )}
    activity = query(
        """
        SELECT e.event_type, e.detail, e.created_at, g.game_id, g.title
        FROM activity_events e JOIN games g ON g.game_id = e.game_id
        WHERE e.user_id = %s
        ORDER BY e.created_at DESC, e.event_id DESC
        LIMIT 20
        """,
        (owner,),
    )
    return jsonify(user=user, wishlist=wishlist, library=library, activity=activity)


# ----------------------------
# FEED
# ----------------------------

@social_bp.get("/feed")
@jwt_required()
def feed():
    """latest things the people you follow did. ?before=<event_id> gets
    the next page (older stuff) -- keyset paging, so it stays fast and
    doesn't skip/repeat rows if new events come in while you scroll"""
    before = request.args.get("before", type=int)
    events = query(
        f"""
        SELECT e.event_id, u.username, e.event_type, e.detail, e.created_at,
               g.game_id, g.title
        FROM follows f
        JOIN users u           ON u.user_id = f.followee_id
        JOIN activity_events e ON e.user_id = f.followee_id
        JOIN games g           ON g.game_id = e.game_id
        WHERE f.follower_id = %(viewer)s
          AND {CAN_SEE_SQL}
          AND (%(before)s IS NULL OR e.event_id < %(before)s)
        ORDER BY e.event_id DESC
        LIMIT 30
        """,
        {"viewer": viewer_id(), "before": before},
    )
    return jsonify(events=events, next_before=events[-1]["event_id"] if len(events) == 30 else None)


# ----------------------------
# GAME PAGE: FRIENDS + REVIEWS
# ----------------------------

def friends_who_want(game_id, me):
    """people you follow (who let you see their stuff) with this game on
    their wishlist -- for co-op games, so you can buy together on sale"""
    return [r["username"] for r in query(
        f"""
        SELECT u.username
        FROM follows f
        JOIN users u       ON u.user_id = f.followee_id
        JOIN user_games ug ON ug.user_id = u.user_id
        WHERE f.follower_id = %(viewer)s
          AND ug.game_id = %(game)s
          AND ug.status = 'want_to_play'
          AND {CAN_SEE_SQL}
        ORDER BY u.username
        """,
        {"viewer": me, "game": game_id},
    )]


@social_bp.get("/games/<int:game_id>/friends")
@jwt_required()
def game_friends(game_id):
    return jsonify(friends_want=friends_who_want(game_id, viewer_id()))


@social_bp.get("/games/<int:game_id>/reviews")
@jwt_required()
def get_reviews(game_id):
    """reviews for a game, people you follow first (from the design doc:
    "show your friends' ratings first"). private profiles' reviews only
    show to themselves"""
    params = {"viewer": viewer_id(), "game": game_id}
    reviews = query(
        f"""
        SELECT u.username, r.rating, r.review_text, r.created_at,
               EXISTS (SELECT 1 FROM follows f
                       WHERE f.follower_id = %(viewer)s AND f.followee_id = u.user_id) AS is_friend
        FROM reviews r
        JOIN users u ON u.user_id = r.user_id
        WHERE r.game_id = %(game)s
          AND {CAN_SEE_SQL}
        ORDER BY is_friend DESC, r.created_at DESC
        LIMIT 50
        """,
        params,
    )
    for r in reviews:
        r["is_friend"] = bool(r["is_friend"])
    stats = query(
        "SELECT ROUND(AVG(rating), 1) AS average, COUNT(*) AS count FROM reviews WHERE game_id = %s",
        (game_id,), one=True,
    )
    return jsonify(average_rating=stats["average"], review_count=stats["count"], reviews=reviews)


@social_bp.post("/games/<int:game_id>/reviews")
@jwt_required()
def write_review(game_id):
    """write or update your review (one per game). a new review shows up
    in your followers' feeds through a trigger, edits don't spam it"""
    data = request.get_json(silent=True) or {}
    rating, text = data.get("rating"), data.get("review_text")
    if isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 10:
        return jsonify(error="rating must be a whole number from 1 to 10"), 400
    if text is not None and (not isinstance(text, str) or len(text) > 5000):
        return jsonify(error="review_text must be text (max 5000 characters)"), 400
    if query("SELECT 1 FROM games WHERE game_id = %s", (game_id,), one=True) is None:
        return jsonify(error="game not found"), 404
    existed = query("SELECT 1 FROM reviews WHERE user_id = %s AND game_id = %s",
                    (viewer_id(), game_id), one=True) is not None
    execute(
        """
        INSERT INTO reviews (user_id, game_id, rating, review_text)
        VALUES (%s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE rating = VALUES(rating), review_text = VALUES(review_text)
        """,
        (viewer_id(), game_id, rating, text),
    )
    return jsonify(game_id=game_id, rating=rating, review_text=text), (200 if existed else 201)


@social_bp.delete("/games/<int:game_id>/reviews")
@jwt_required()
def delete_review(game_id):
    removed, _ = execute("DELETE FROM reviews WHERE user_id = %s AND game_id = %s",
                         (viewer_id(), game_id))
    if removed == 0:
        return jsonify(error="you haven't reviewed this game"), 404
    return "", 204
