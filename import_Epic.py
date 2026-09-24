"""
import_epic.py

pulls game data + current pricing from the Epic Games Store and drops
it into our games/listings tables, same pattern as import_steam.py and
import_gog.py -- then logs a price check through the record_price_check
stored procedure so price_history and price_alerts get exercised too.

Epic has no official public API for store/catalog data at all (unlike
Steam). This uses the same GraphQL endpoint the Epic Games Store
website itself calls in your browser -- it's undocumented, unofficial,
and can change or break without notice. It's the same approach used by
community libraries like epicstore_api.

One extra wrinkle vs Steam/GOG: Epic sometimes puts up anti-bot
protection in front of this endpoint. If requests.get/post starts
getting blocked (403s, weird HTML back instead of JSON), the usual fix
people reach for is swapping the `requests` session for `cloudscraper`
(`pip install cloudscraper`), which handles that challenge. This script
uses plain requests to start since it works most of the time -- swap it
if you start getting blocked.

setup before running this:
1. pip install requests mysql-connector-python python-dotenv
   (add cloudscraper too if you hit anti-bot blocks -- see note above)
2. copy .env.example to a new file called .env (same folder), and put
   your actual mysql password in there. .env is in .gitignore so it
   never gets committed
3. run: python import_epic.py

what it does:
- searches the Epic store's GraphQL endpoint for each title in
  GAME_TITLES below
- unlike Steam/GOG, one search call returns everything we need in one
  shot: title, developer/publisher, description, categories, and
  current USD price -- no separate "details" call required
- upserts the game into games, and its price into listings
- calls the record_price_check() procedure from schema.sql so the price
  also gets logged to price_history AND checked against everyone's
  price_alerts, same as the other importers
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
    "Control",
    "Death Stranding",
    "Subnautica",
]

# small delay between games to be a reasonable citizen -- Epic doesn't
# publish a documented rate limit like GOG does, so this is just being
# polite rather than tuned to a known number
REQUEST_DELAY_SECONDS = 2

EPIC_GRAPHQL_URL = "https://www.epicgames.com/graphql"

# a real browser UA helps somewhat with Epic's anti-bot layer -- see
# the cloudscraper note at the top of this file if this isn't enough
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Content-Type": "application/json",
}

# this is the same searchStore query the Epic Games Store website
# itself sends -- reverse-engineered/documented by community projects
# like epicstore_api. one call gets us title, seller, description,
# categories, custom attributes (dev/publisher), and price all at once
SEARCH_STORE_QUERY = """
query searchStoreQuery(
  $keywords: String,
  $country: String!,
  $locale: String,
  $count: Int
) {
  Catalog {
    searchStore(
      keywords: $keywords,
      country: $country,
      locale: $locale,
      count: $count
    ) {
      elements {
        id
        namespace
        title
        description
        effectiveDate
        productSlug
        urlSlug
        seller { name }
        customAttributes { key value }
        categories { path }
        price(country: $country) {
          totalPrice {
            discountPrice
            originalPrice
            currencyCode
            currencyInfo { decimals }
          }
        }
      }
    }
  }
}
"""


def search_game(title):
    """looks up a game by name using Epic's storefront GraphQL endpoint
    -- the same one store.epicgames.com calls when you use the search
    box. returns the first matching element (a dict), or None if
    nothing came up"""
    resp = requests.post(
        EPIC_GRAPHQL_URL,
        headers=HEADERS,
        json={
            "query": SEARCH_STORE_QUERY,
            "variables": {
                "keywords": title,
                "country": "US",
                "locale": "en-US",
                "count": 1,
            },
        },
    )
    resp.raise_for_status()
    payload = resp.json()
    elements = (
        payload.get("data", {})
        .get("Catalog", {})
        .get("searchStore", {})
        .get("elements", [])
    )
    return elements[0] if elements else None


def map_app_to_game_row(element):
    """takes one element from Epic's search response and pulls out
    just what our games table cares about. developer/publisher aren't
    real fields on the element -- they're buried in a generic
    key/value customAttributes list, so we dig those out here"""
    release_year = None
    effective_date = element.get("effectiveDate") or ""
    if len(effective_date) >= 4 and effective_date[:4].isdigit():
        release_year = int(effective_date[:4])

    genres = [c["path"] for c in element.get("categories", []) if c.get("path")]

    attrs = {a["key"]: a["value"] for a in element.get("customAttributes", []) if a.get("key")}
    developer = attrs.get("developerName")
    publisher = attrs.get("publisherName") or (element.get("seller") or {}).get("name")

    slug = element.get("productSlug") or element.get("urlSlug") or ""

    return {
        "title": element.get("title"),
        "genre": ", ".join(genres) if genres else None,
        "developer": developer,
        "publisher": publisher,
        "release_year": release_year,
        "synopsis": element.get("description"),
        "source": "epic",
        "external_id": element.get("id"),
        "source_url": f"https://store.epicgames.com/p/{slug}" if slug else None,
    }


def map_app_to_price(element):
    """pulls current price out of the same search element. epic gives
    prices as integers in minor units (cents, mostly) alongside a
    currencyInfo.decimals field telling you how many places to shift --
    games with no active store price (delisted, region-locked) come
    back with price data missing entirely, so we handle that instead
    of crashing on a missing key"""
    price_block = (element.get("price") or {}).get("totalPrice")
    if not price_block:
        return None
    decimals = (price_block.get("currencyInfo") or {}).get("decimals", 2)
    discount_price = price_block.get("discountPrice")
    if discount_price is None:
        return None
    return discount_price / (10 ** decimals)


def get_or_create_platform(cursor, name):
    """makes sure the platform row exists (e.g. 'Epic Games Store') and
    returns its platform_id. INSERT IGNORE means this is a no-op if
    it's already there instead of throwing a duplicate key error"""
    cursor.execute(
        "INSERT IGNORE INTO platforms (name) VALUES (%s)", (name,)
    )
    cursor.execute(
        "SELECT platform_id FROM platforms WHERE name = %s", (name,)
    )
    return cursor.fetchone()[0]


def upsert_game(cursor, row):
    """inserts the game into games, or updates it if we've already
    imported this exact Epic product id before. returns the game_id
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
    cursor.execute(sql, ("epic", datetime.now(), added, updated, status, error))


def main():
    print("connecting to epic...")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    epic_platform_id = get_or_create_platform(cursor, "Epic Games Store")

    added_count = 0
    updated_count = 0

    try:
        for title in GAME_TITLES:
            element = search_game(title)
            if element is None:
                print(f"  no epic match for: {title}")
                continue

            row = map_app_to_game_row(element)
            price = map_app_to_price(element)

            game_id = upsert_game(cursor, row)
            listing_id = upsert_listing(cursor, game_id, epic_platform_id)

            if price is not None:
                # this is the stored procedure from schema.sql -- it logs
                # the price to price_history, updates listings.current_price,
                # AND checks/triggers anyone's price_alerts, all as one
                # transaction -- same as the steam/gog importers
                cursor.callproc("record_price_check", [listing_id, price])
                print(f"  {row['title']}: ${price:.2f}")
            else:
                print(f"  {row['title']}: no price available")

            added_count += 1  # not distinguishing added vs updated here since
                               # upsert_game/upsert_listing don't tell us --
                               # good enough for the starter version

            time.sleep(REQUEST_DELAY_SECONDS)  # be polite to epic's endpoint

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