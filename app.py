import os
from datetime import date, datetime
from decimal import Decimal

import mysql.connector
from flask import Flask, jsonify
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


if __name__ == "__main__":
    app.run(debug=True, port=5000)