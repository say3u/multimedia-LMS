"""
import_steam.py

pulls game data + current pricing from Steam's store api and drops it
into our games/listings tables, then logs a price check through the
record_price_check stored procedure so price_history and price_alerts
actually get exercised too.

setup before running this:
1. pip install requests mysql-connector-python python-dotenv
2. copy .env.example to a new file called .env (same folder), and put
   your actual mysql password in there. .env is in .gitignore so it
   never gets committed -- this keeps passwords out of github entirely,
   which matters since a lot of people reuse the same password in
   multiple places
3. run: python import_steam.py

what it does:
- searches steam for each game title in GAME_TITLES below
- pulls full details (genre, devs, publisher, release year, description,
  current price) for whatever it finds
- upserts the game into games, and its price into listings
- calls the record_price_check() procedure from schema.sql so the price
  also gets logged to price_history AND checked against everyone's
  price_alerts, same as it would if this were running on a schedule
- logs the whole run into import_log
"""

import os
import requests
import mysql.connector
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()  # reads the .env file (if present) into the environment

# ----------------------------
# CONFIG
# ----------------------------
# password comes from the .env file now instead of being typed directly
# in here -- see the setup notes above
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
    "Hollow Knight",
    "Stardew Valley",
    "Hades",
]

STEAM_SEARCH_URL = "https://store.steampowered.com/api/storesearch/"
STEAM_DETAILS_URL = "https://store.steampowered.com/api/appdetails"


def search_game(title):
    """looks up a game by name using steam's (undocumented but widely
    used) storesearch endpoint. returns the first match's appid, or
    None if nothing came up"""
    resp = requests.get(
        STEAM_SEARCH_URL,
        params={"term": title, "cc": "us", "l": "en"}
    )
    resp.raise_for_status()
    results = resp.json().get("items", [])
    return results[0]["id"] if results else None


def get_app_details(appid):
    """pulls the full details for one game -- genres, devs, publisher,
    release date, description, and current price. steam nests
    everything under the appid as a string key which is a little
    annoying so we unwrap that here"""
    resp = requests.get(
        STEAM_DETAILS_URL,
        params={"appids": appid, "cc": "us", "l": "en"}
    )
    resp.raise_for_status()
    payload = resp.json()[str(appid)]
    if not payload.get("success"):
        return None
    return payload["data"]


def map_app_to_game_row(appid, data):
    """takes steam's raw json and pulls out just what our games table
    cares about"""
    release_year = None
    release_date = data.get("release_date", {}).get("date", "")
    # steam's date format is inconsistent ("21 Mar, 2024" vs just a
    # year sometimes) so we just grab the last 4 digits we can find
    for chunk in release_date.replace(",", "").split():
        if chunk.isdigit() and len(chunk) == 4:
            release_year = int(chunk)

    genres = [g["description"] for g in data.get("genres", [])]

    return {
        "title": data.get("name"),
        "genre": ", ".join(genres) if genres else None,
        "developer": ", ".join(data.get("developers", [])) or None,
        "publisher": ", ".join(data.get("publishers", [])) or None,
        "release_year": release_year,
        "synopsis": data.get("short_description"),
        "source": "steam",
        "external_id": str(appid),
        "source_url": f"https://store.steampowered.com/app/{appid}",
    }


def map_app_to_price(data):
    """pulls out current price info. free games and games with no
    price_overview (delisted, region-locked, etc) come back as None so
    we handle that instead of crashing on a missing key"""
    price_block = data.get("price_overview")
    if price_block is None:
        if data.get("is_free"):
            return 0.00
        return None
    # steam gives prices in cents, e.g. 1999 = $19.99
    return price_block["final"] / 100.0


def get_or_create_platform(cursor, name):
    """makes sure the platform row exists (e.g. 'Steam') and returns
    its platform_id. INSERT IGNORE means this is a no-op if it's
    already there instead of throwing a duplicate key error"""
    cursor.execute(
        "INSERT IGNORE INTO platforms (name) VALUES (%s)", (name,)
    )
    cursor.execute(
        "SELECT platform_id FROM platforms WHERE name = %s", (name,)
    )
    return cursor.fetchone()[0]


def upsert_game(cursor, row):
    """inserts the game into games, or updates it if we've already
    imported this exact steam appid before. returns the game_id either
    way so we can use it for the listing"""
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
    cursor.execute(sql, ("steam", datetime.now(), added, updated, status, error))


def main():
    print("connecting to steam...")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    steam_platform_id = get_or_create_platform(cursor, "Steam")

    added_count = 0
    updated_count = 0

    try:
        for title in GAME_TITLES:
            appid = search_game(title)
            if appid is None:
                print(f"  no steam match for: {title}")
                continue

            data = get_app_details(appid)
            if data is None:
                print(f"  couldn't get details for appid {appid} ({title})")
                continue

            row = map_app_to_game_row(appid, data)
            price = map_app_to_price(data)

            game_id = upsert_game(cursor, row)
            listing_id = upsert_listing(cursor, game_id, steam_platform_id)

            if price is not None:
                # this is the stored procedure from schema.sql -- it logs
                # the price to price_history, updates listings.current_price,
                # AND checks/triggers anyone's price_alerts, all as one
                # transaction
                cursor.callproc("record_price_check", [listing_id, price])
                print(f"  {row['title']}: ${price:.2f}")
            else:
                print(f"  {row['title']}: no price available")

            added_count += 1  # not distinguishing added vs updated here since
                               # upsert_game/upsert_listing don't tell us --
                               # good enough for the starter version

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
