"""
import_gog.py

pulls game data + current pricing from GOG's public (but unofficial and
undocumented) endpoints and drops it into our games/listings tables,
same pattern as import_steam.py -- then logs a price check through the
record_price_check stored procedure so price_history and price_alerts
get exercised too.

GOG has no official public API for this (unlike Steam's storesearch/
appdetails), so this uses the same endpoints gog.com's own website
calls in your browser:
  - catalog.gog.com/v1/catalog  -> search by title
  - api.gog.com/products/{id}   -> game details (genres, devs, etc)
  - api.gog.com/products/{id}/prices -> current price

These are unofficial and can change or break without notice -- that's
just the nature of not having a real public API here. GOG's own support
docs mention a 200 requests/hour/IP limit specifically on the
api.gog.com/products/* endpoint, so this script sleeps briefly between
games to stay well under that. If you're importing more than a
handful of titles, space runs out over time rather than looping fast.

setup before running this:
1. pip install requests mysql-connector-python python-dotenv
2. copy .env.example to a new file called .env (same folder), and put
   your actual mysql password in there. .env is in .gitignore so it
   never gets committed
3. run: python import_gog.py

what it does:
- searches GOG's catalog for each game title in GAME_TITLES below
- pulls full details (genre, devs, publisher, release year, description)
  plus current USD price for whatever it finds
- upserts the game into games, and its price into listings
- calls the record_price_check() procedure from schema.sql so the price
  also gets logged to price_history AND checked against everyone's
  price_alerts, same as the steam importer
- logs the whole run into import_log
"""

import os
import time
import requests
import mysql.connector
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # reads the .env file (if present) into the environment

# ----------------------------
# CONFIG
# ----------------------------
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

# games to pull for testing -- swap these out for whatever, or wire this
# up to read from a real wishlist table instead of a hardcoded list later
GAME_TITLES = [
    "Baldur's Gate",
    "Disco Elysium",
    "Divinity Original Sin 2",
]

# small delay between games so we stay well under GOG's documented
# 200 requests/hour/IP limit on api.gog.com/products/* -- each game
# costs 2 requests to that host (details + prices), so this is
# deliberately conservative
REQUEST_DELAY_SECONDS = 2

GOG_CATALOG_URL = "https://catalog.gog.com/v1/catalog"
GOG_PRODUCT_URL = "https://api.gog.com/products/{id}"
GOG_PRICE_URL = "https://api.gog.com/products/{id}/prices"


def search_game(title):
    """looks up a game by name using GOG's catalog search endpoint --
    the same one gog.com's own search box calls. returns the first
    match's product id, or None if nothing came up"""
    resp = requests.get(
        GOG_CATALOG_URL,
        params={
            "query": f"like:{title}",
            "limit": 5,
            "countryCode": "US",
            "locale": "en-US",
            "currencyCode": "USD",
        },
    )
    resp.raise_for_status()
    products = resp.json().get("products", [])
    return products[0]["id"] if products else None


def get_app_details(product_id):
    """pulls the full details for one game -- genres, devs, publisher,
    release date, description. returns None if GOG doesn't have
    anything for this id (delisted, region-locked, etc)"""
    resp = requests.get(
        GOG_PRODUCT_URL.format(id=product_id),
        params={"expand": "description", "locale": "en-US"},
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def get_app_price(product_id):
    """pulls current USD price. not every product id in the catalog
    search has a live store listing (some are delisted or
    region-restricted), so a 404 here just means no price -- not a
    failure of the whole import"""
    resp = requests.get(
        GOG_PRICE_URL.format(id=product_id),
        params={"countryCode": "US"},
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    prices = resp.json().get("_embedded", {}).get("prices", [])
    if not prices:
        return None
    # GOG gives prices as decimal strings already, e.g. "19.99"
    amount = prices[0].get("price", {}).get("finalAmount")
    return float(amount) if amount is not None else None


def map_app_to_game_row(product_id, data):
    """takes GOG's raw json and pulls out just what our games table
    cares about"""
    release_year = None
    release_date = data.get("releaseDate") or ""
    # GOG's release date comes back as an ISO string like
    # "2000-11-30T00:00:00+00:00" when present at all
    if len(release_date) >= 4 and release_date[:4].isdigit():
        release_year = int(release_date[:4])

    genres = [g.get("name") for g in data.get("genres", []) if g.get("name")]

    return {
        "title": data.get("title"),
        "genre": ", ".join(genres) if genres else None,
        "developer": ", ".join(data.get("developers", [])) or None,
        "publisher": ", ".join(data.get("publishers", [])) or None,
        "release_year": release_year,
        "synopsis": (data.get("description") or {}).get("lead"),
        "source": "gog",
        "external_id": str(product_id),
        "source_url": f"https://www.gog.com/game/{data.get('slug', '')}",
    }


def get_or_create_platform(cursor, name):
    """makes sure the platform row exists (e.g. 'GOG') and returns its
    platform_id. INSERT IGNORE means this is a no-op if it's already
    there instead of throwing a duplicate key error"""
    cursor.execute(
        "INSERT IGNORE INTO platforms (name) VALUES (%s)", (name,)
    )
    cursor.execute(
        "SELECT platform_id FROM platforms WHERE name = %s", (name,)
    )
    return cursor.fetchone()[0]


def upsert_game(cursor, row):
    """inserts the game into games, or updates it if we've already
    imported this exact GOG product id before. returns the game_id
    either way so we can use it for the listing"""
    sql = """
        INSERT INTO games
            (title, genre, developer, publisher, release_year, synopsis, source, external_id, source_url)
        VALUES
            (%(title)s, %(genre)s, %(developer)s, %(publisher)s, %(release_year)s, %(synopsis)s, %(source)s, %(external_id)s, %(source_url)s)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            genre = VALUES(genre),
            synopsis = VALUES(synopsis),
            game_id = LAST_INSERT_ID(game_id)
    """
    cursor.execute(sql, row)
    return cursor.lastrowid


def upsert_listing(cursor, game_id, platform_id):
    """makes sure a listings row exists for this (game, platform) combo
    and returns its listing_id. we don't set the price here -- that
    happens through record_price_check so it goes through price_history
    properly instead of getting silently overwritten"""
    cursor.execute(
        "INSERT IGNORE INTO listings (game_id, platform_id) VALUES (%s, %s)",
        (game_id, platform_id)
    )
    cursor.execute(
        "SELECT listing_id FROM listings WHERE game_id = %s AND platform_id = %s",
        (game_id, platform_id)
    )
    return cursor.fetchone()[0]


def log_import(cursor, added, updated, status="success", error=None):
    """writes one row to import_log for this run"""
    sql = """
        INSERT INTO import_log (source, run_at, items_added, items_updated, status, error_message)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, ("gog", datetime.now(), added, updated, status, error))


def main():
    print("connecting to gog...")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    gog_platform_id = get_or_create_platform(cursor, "GOG")

    added_count = 0
    updated_count = 0

    try:
        for title in GAME_TITLES:
            product_id = search_game(title)
            if product_id is None:
                print(f"  no gog match for: {title}")
                continue

            data = get_app_details(product_id)
            if data is None:
                print(f"  couldn't get details for product {product_id} ({title})")
                continue

            row = map_app_to_game_row(product_id, data)
            price = get_app_price(product_id)

            game_id = upsert_game(cursor, row)
            listing_id = upsert_listing(cursor, game_id, gog_platform_id)

            if price is not None:
                # this is the stored procedure from schema.sql -- it logs
                # the price to price_history, updates listings.current_price,
                # AND checks/triggers anyone's price_alerts, all as one
                # transaction -- same as the steam importer
                cursor.callproc("record_price_check", [listing_id, price])
                print(f"  {row['title']}: ${price:.2f}")
            else:
                print(f"  {row['title']}: no price available")

            added_count += 1  # not distinguishing added vs updated here since
                               # upsert_game/upsert_listing don't tell us --
                               # good enough for the starter version

            time.sleep(REQUEST_DELAY_SECONDS)  # be polite to api.gog.com

        log_import(cursor, added_count, updated_count, status="success")
        conn.commit()
        print(f"\ndone. processed {added_count} games")

    except Exception as e:
        conn.rollback()
        log_import(cursor, added_count, updated_count, status="failed", error=str(e))
        conn.commit()
        print(f"something broke: {e}")
        raise

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()