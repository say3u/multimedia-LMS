import os
from datetime import date, datetime
from decimal import Decimal

import mysql.connector
from flask import Flask, jsonify, request
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)


def get_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "game_tracker"),
    )


def json_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


@app.get("/api/watchlist")
def get_watchlist():
    user_id = 1  # temporary until login is implemented

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
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
            (user_id,),
        )

        rows = cursor.fetchall()
        games = {}

        for row in rows:
            game_id = row["game_id"]

            if game_id not in games:
                games[game_id] = {
                    "game_id": game_id,
                    "title": row["title"],
                    "category": {
                        "category_id": row["category_id"],
                        "name": row["category_name"],
                        "check_interval_minutes": row[
                            "check_interval_minutes"
                        ],
                    },
                    "target_price": json_value(row["target_price"]),
                    "notify_enabled": row["notify_enabled"],
                    "notify": row["notify_enabled"],
                    "best_price": json_value(row["best_price"]),
                    "regular_price": json_value(row["regular_price"]),
                    "discount_percent": json_value(row["discount_percent"]),
                    "store": row["store"],
                    "last_checked_at": json_value(row["last_checked_at"]),
                    "added_at": json_value(row["added_at"]),
                }

        return jsonify({
            "total": len(games),
            "stores": sorted({
                row["store"] for row in rows if row["store"] is not None
            }),
            "games": list(games.values()),
        })

    finally:
        cursor.close()
        connection.close()

@app.post("/api/watchlist")
def add_to_watchlist():
    user_id = 1  # temporary until login is implemented
    data = request.get_json(silent=True) or {}

    game_id = data.get("game_id")
    category_id = data.get("category_id")
    target_price = data.get("target_price")
    notify_enabled = data.get("notify_enabled", True)

    if not isinstance(game_id, int) or not isinstance(category_id, int):
        return jsonify({
            "error": "game_id and category_id are required"
        }), 400

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            "SELECT game_id, title FROM games WHERE game_id = %s",
            (game_id,),
        )
        game = cursor.fetchone()

        if game is None:
            return jsonify({"error": "Game not found"}), 404

        cursor.execute(
            """
            SELECT category_id
            FROM notification_categories
            WHERE category_id = %s
              AND user_id = %s
            """,
            (category_id, user_id),
        )

        if cursor.fetchone() is None:
            return jsonify({"error": "Category not found"}), 404

        cursor.execute(
            """
            INSERT INTO user_games
                (user_id, game_id, category_id, target_price,
                 notify_enabled, status)
            VALUES
                (%s, %s, %s, %s, %s, 'want_to_play')
            """,
            (
                user_id,
                game_id,
                category_id,
                target_price,
                notify_enabled,
            ),
        )

        connection.commit()

        return jsonify({
            "message": "Game added to watchlist",
            "game_id": game_id,
            "title": game["title"],
        }), 201

    except mysql.connector.IntegrityError:
        connection.rollback()
        return jsonify({
            "error": "Game is already on the watchlist"
        }), 409

    finally:
        cursor.close()
        connection.close()


@app.patch("/api/watchlist/<int:game_id>")
def update_watchlist(game_id):
    user_id = 1  # temporary until login is implemented
    data = request.get_json(silent=True) or {}

    allowed_fields = {
        "category_id",
        "target_price",
        "notify_enabled",
    }

    if not any(field in data for field in allowed_fields):
        return jsonify({
            "error": "Provide category_id, target_price, or notify_enabled"
        }), 400

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
            """
            SELECT user_game_id
            FROM user_games
            WHERE user_id = %s
              AND game_id = %s
              AND status = 'want_to_play'
            """,
            (user_id, game_id),
        )

        if cursor.fetchone() is None:
            return jsonify({"error": "Game is not on the watchlist"}), 404

        if "category_id" in data and data["category_id"] is not None:
            cursor.execute(
                """
                SELECT category_id
                FROM notification_categories
                WHERE category_id = %s
                  AND user_id = %s
                """,
                (data["category_id"], user_id),
            )

            if cursor.fetchone() is None:
                return jsonify({"error": "Category not found"}), 404

        updates = []
        values = []

        if "category_id" in data:
            updates.append("category_id = %s")
            values.append(data["category_id"])

        if "target_price" in data:
            updates.append("target_price = %s")
            values.append(data["target_price"])

        if "notify_enabled" in data:
            updates.append("notify_enabled = %s")
            values.append(data["notify_enabled"])

        values.extend([user_id, game_id])

        cursor.execute(
            f"""
            UPDATE user_games
            SET {", ".join(updates)}
            WHERE user_id = %s
              AND game_id = %s
              AND status = 'want_to_play'
            """,
            values,
        )

        connection.commit()

        return jsonify({
            "message": "Watchlist item updated",
            "game_id": game_id,
        })

    finally:
        cursor.close()
        connection.close()

@app.delete("/api/watchlist/<int:game_id>")
def remove_from_watchlist(game_id):
    user_id = 1  # temporary until login is implemented

    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute(
            """
            DELETE FROM user_games
            WHERE user_id = %s
              AND game_id = %s
              AND status = 'want_to_play'
            """,
            (user_id, game_id),
        )

        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({
                "error": "Game is not on the watchlist"
            }), 404

        connection.commit()
        return "", 204

    finally:
        cursor.close()
        connection.close()

@app.get("/api/search")
def search_games():
    user_id = 1  # temporary until login is implemented
    query = request.args.get("q", "").strip()

    if len(query) < 2:
        return jsonify({
            "error": "Enter at least 2 characters"
        }), 400

    # Treat search text literally, including % and _ characters.
    search_text = (
        query.replace("!", "!!")
        .replace("%", "!%")
        .replace("_", "!_")
    )

    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    try:
        cursor.execute(
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
            (user_id, f"%{search_text}%"),
        )

        results = cursor.fetchall()

        for game in results:
            game["best_price"] = json_value(game["best_price"])
            game["on_watchlist"] = bool(game["on_watchlist"])

        return jsonify({"results": results})

    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    app.run(debug=True, port=5000)