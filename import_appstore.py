"""
import_appstore.py

pulls mobile games + their current price from Apple's App Store, same
pattern as import_steam.py / import_GOG.py / import_Epic.py. mobile was
the first niche source we picked for phase 2.

uses the iTunes Search API, which unlike GOG/Epic is an actual public
api from apple -- free and no key needed:
  https://itunes.apple.com/search?term=...&entity=software

a couple of things that are different from the pc stores:
- the search also returns non-game apps ("Database for Stardew Valley"),
  so we only keep results whose primaryGenreName is "Games"
- apple doesn't tell us the normal price vs a sale price, just the
  current price, so regular_price is left NULL (no discount % for these)
- apple arcade games come back with no price at all, those get skipped
- the store is added with platform_type = 'mobile', so the app can
  filter mobile prices in/out -- a $4.99 iphone sale doesn't help
  someone who only plays on pc (from alice's question on our draft)

game_matching links it to the same game from steam/gog/epic, so
"Stardew Valley" on the app store and on steam end up as one game with
two listings.

setup: same .env as the other importers, then python import_appstore.py
"""

import os
import time
from datetime import datetime

import mysql.connector
import requests
from dotenv import load_dotenv

from game_matching import find_or_create_game

load_dotenv()

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD"),
    "database": os.environ.get("DB_NAME", "game_tracker"),
}

if not DB_CONFIG["password"]:
    raise RuntimeError(
        "DB_PASSWORD is not set. Copy .env.example to .env and fill in "
        "your actual mysql password there."
    )

# games to pull for testing -- picked ones that are also on pc so you
# can see the same game with a mobile + pc price side by side
GAME_TITLES = [
    "Stardew Valley",
    "Dead Cells",
    "Slay the Spire",
]

# apple asks for roughly 20 calls a minute max on this api
REQUEST_DELAY_SECONDS = 3

ITUNES_SEARCH_URL = "https://itunes.apple.com/search"
STORE_NAME = "Apple App Store"


def search_game(title):
    """searches the app store and returns the first result that's
    actually a game (not a guide / companion app), or None"""
    resp = requests.get(
        ITUNES_SEARCH_URL,
        params={"term": title, "entity": "software", "country": "us", "limit": 10},
        timeout=20,
    )
    resp.raise_for_status()
    for app in resp.json().get("results", []):
        if app.get("primaryGenreName") == "Games":
            return app
    return None


def map_app_to_game_row(app):
    """takes one search result and pulls out what our games table wants"""
    release_date = app.get("releaseDate") or ""
    release_year = int(release_date[:4]) if release_date[:4].isdigit() else None
    # genres always starts with "Games", the useful ones come after
    genres = [g for g in app.get("genres", []) if g != "Games"]
    description = (app.get("description") or "").strip()

    return {
        "title": app.get("trackName"),
        "genre": ", ".join(genres)[:100] or None,
        "developer": app.get("artistName"),
        "publisher": app.get("sellerName"),
        "release_year": release_year,
        # first paragraph is plenty, these descriptions are really long
        "synopsis": description.split("\n")[0][:1000] or None,
        "external_id": str(app["trackId"]),
        "source_url": app.get("trackViewUrl"),
    }


def map_app_to_price(app):
    """current USD price, or None for apple arcade / unpriced apps"""
    price = app.get("price")
    if price is None or app.get("currency") != "USD":
        return None
    return float(price)


def get_or_create_platform(cursor, name):
    """same as the other importers, except this store is marked as
    mobile so the app can tell it apart from the pc stores"""
    cursor.execute(
        "INSERT IGNORE INTO platforms (name, platform_type) VALUES (%s, 'mobile')", (name,)
    )
    cursor.execute("SELECT platform_id FROM platforms WHERE name = %s", (name,))
    return cursor.fetchone()[0]


def upsert_listing(cursor, game_id, platform_id, url):
    """makes sure a listings row exists for this game on the app store
    and returns its listing_id. the price itself goes through
    record_price_check so it ends up in price_history"""
    cursor.execute(
        "INSERT IGNORE INTO listings (game_id, platform_id, listing_url) VALUES (%s, %s, %s)",
        (game_id, platform_id, url),
    )
    cursor.execute(
        "SELECT listing_id FROM listings WHERE game_id = %s AND platform_id = %s",
        (game_id, platform_id),
    )
    return cursor.fetchone()[0]


def log_import(cursor, added, updated, status="success", error=None):
    cursor.execute(
        """
        INSERT INTO import_log (source, run_at, items_added, items_updated, status, error_message)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        ("appstore", datetime.now(), added, updated, status, error),
    )


def main():
    print("connecting to the app store...")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    platform_id = get_or_create_platform(cursor, STORE_NAME)
    added_count = 0

    try:
        for title in GAME_TITLES:
            app = search_game(title)
            if app is None:
                print(f"  no app store game for: {title}")
                continue

            row = map_app_to_game_row(app)
            price = map_app_to_price(app)

            game_id = find_or_create_game(cursor, row, platform_id)
            listing_id = upsert_listing(cursor, game_id, platform_id, row["source_url"])

            if price is not None:
                # regular price unknown on the app store -> NULL
                cursor.callproc("record_price_check", [listing_id, price, None])
                print(f"  {row['title']}: ${price:.2f}")
            else:
                print(f"  {row['title']}: no price (apple arcade?)")

            added_count += 1
            time.sleep(REQUEST_DELAY_SECONDS)

        log_import(cursor, added_count, 0, status="success")
        conn.commit()
        print(f"\ndone. processed {added_count} games")

    except Exception as e:
        # same as the other importers -- record_price_check commits on its
        # own, so games that already went through before the error are saved
        conn.rollback()
        log_import(cursor, added_count, 0, status="failed", error=str(e))
        conn.commit()
        print(f"something broke: {e}")
        raise

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
