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
    (also gives genres, devs, publisher, release date and price)
  - api.gog.com/products/{id}   -> description

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
- links it to the same game from another store if we already have it
  (see game_matching.py), otherwise adds it as a new game, then makes
  sure there's a listings row for its price
- calls the record_price_check() procedure from schema.sql so the price
  also gets logged to price_history AND checked against everyone's
  price_alerts, same as the steam importer
- logs the whole run into import_log
"""

import html
import os
import re
import time
import requests
import mysql.connector
from datetime import datetime
from dotenv import load_dotenv

from game_matching import find_or_create_game

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
# only costs 1 request to that host now (details, for the description),
# since the catalog search already gives us the price
REQUEST_DELAY_SECONDS = 2

GOG_CATALOG_URL = "https://catalog.gog.com/v1/catalog"
GOG_PRODUCT_URL = "https://api.gog.com/products/{id}"


def search_game(title):
    """looks up a game by name using GOG's catalog search endpoint --
    the same one gog.com's own search box calls. returns the first
    result that's actually a game, or None if nothing came up.
    the search puts soundtracks and dlc first a lot of the time
    ("Disco Elysium" gave back the soundtrack), so we skip anything
    whose productType isn't 'game'"""
    resp = requests.get(
        GOG_CATALOG_URL,
        params={
            "query": f"like:{title}",
            "limit": 10,
            "countryCode": "US",
            "locale": "en-US",
            "currencyCode": "USD",
        },
    )
    resp.raise_for_status()
    products = resp.json().get("products", [])
    games = [p for p in products if p.get("productType") == "game"]
    return games[0] if games else None


def get_description(product_id):
    """the catalog search has almost everything except a description,
    so this grabs just that from the product endpoint. returns None if
    GOG doesn't have anything for this id -- not worth failing the
    import over a missing description"""
    resp = requests.get(
        GOG_PRODUCT_URL.format(id=product_id),
        params={"expand": "description", "locale": "en-US"},
    )
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    lead = (resp.json().get("description") or {}).get("lead")
    if not lead:
        return None
    # some of these come back with html in them (<p class="module">...)
    # so strip the tags + extra whitespace and just keep the text
    text = html.unescape(re.sub(r"<[^>]+>", " ", lead))
    return " ".join(text.split()) or None


def map_app_to_price(product):
    """pulls current USD price straight out of the catalog search
    result, e.g. {"finalMoney": {"amount": "39.99"}}. games with no
    price block (delisted, coming soon, etc) come back as None"""
    amount = ((product.get("price") or {}).get("finalMoney") or {}).get("amount")
    return float(amount) if amount is not None else None


def map_app_to_game_row(product, description):
    """takes one catalog search result and pulls out just what our
    games table cares about. genres/devs/publishers live here, NOT on
    the product endpoint (that one doesn't have them at all)"""
    release_year = None
    release_date = product.get("releaseDate") or ""
    # catalog gives the date like "2019.10.15"
    if len(release_date) >= 4 and release_date[:4].isdigit():
        release_year = int(release_date[:4])

    genres = [g.get("name") for g in product.get("genres", []) if g.get("name")]

    return {
        "title": product.get("title"),
        "genre": ", ".join(genres) if genres else None,
        "developer": ", ".join(product.get("developers", [])) or None,
        "publisher": ", ".join(product.get("publishers", [])) or None,
        "release_year": release_year,
        "synopsis": description,
        "external_id": str(product["id"]),
        "source_url": product.get("storeLink") or f"https://www.gog.com/game/{product.get('slug', '')}",
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
            product = search_game(title)
            if product is None:
                print(f"  no gog match for: {title}")
                continue

            row = map_app_to_game_row(product, get_description(product["id"]))
            price = map_app_to_price(product)

            game_id = find_or_create_game(cursor, row, gog_platform_id)
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
                               # find_or_create_game/upsert_listing don't tell us --
                               # good enough for the starter version

            time.sleep(REQUEST_DELAY_SECONDS)  # be polite to api.gog.com

        log_import(cursor, added_count, updated_count, status="success")
        conn.commit()
        print(f"\ndone. processed {added_count} games")

    except Exception as e:
        # same as import_steam -- record_price_check commits on its own,
        # so games that already went through before the error are saved.
        # this rollback only undoes what was pending for the game that broke
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