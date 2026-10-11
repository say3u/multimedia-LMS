"""
game_matching.py

shared by all the import scripts (steam, gog, epic) so they all decide
"is this the same game?" the exact same way. before this, every store
made its own row in games, so hades on steam and hades on gog were two
different games and we couldn't compare their prices.

how it works now, for each game an import script finds:
1. if we've already imported this exact store id before (game_sources),
   use that game -- fastest, and handles re-running the script
2. otherwise look for a game with the same cleaned-up title
   (match_title) -- this is what links steam/gog/epic together
3. otherwise it's a new game, insert it
then save/refresh this store's row in game_sources either way

known limitation: matching is title only, so editions with different
names ("Disco Elysium - The Final Cut" vs "Disco Elysium") won't link
up, and two different games with the exact same name would get merged.
good enough for the draft, can add developer/release year checks later
"""

import re
import unicodedata


def normalize_title(title):
    """cleans a title up so the same game from different stores matches.
    "HADES™", "Hades" and "hades" all become "hades" """
    t = re.sub(r"[™®©]", "", title or "")     # has to go first, NFKD turns ™ into "TM"
    t = unicodedata.normalize("NFKD", t)
    t = t.encode("ascii", "ignore").decode()  # drops accents, é -> e
    t = re.sub(r"['’]", "", t)                # baldur's -> baldurs, not "baldur s"
    t = t.lower().replace("&", " and ")
    t = re.sub(r"[^a-z0-9]+", " ", t)         # punctuation -> spaces
    return " ".join(t.split())                # collapse extra spaces


def find_or_create_game(cursor, row, platform_id):
    """returns the game_id for this store's game, linking it to an
    existing game if we already have it from another store. row needs:
    title, genre, developer, publisher, release_year, synopsis,
    external_id, source_url"""
    match = normalize_title(row["title"])

    # 1. already imported from this store before?
    cursor.execute(
        "SELECT game_id FROM game_sources WHERE platform_id = %s AND external_id = %s",
        (platform_id, row["external_id"])
    )
    found = cursor.fetchone()

    # 2. same game already in from a different store?
    if found is None:
        cursor.execute(
            "SELECT game_id FROM games WHERE match_title = %s ORDER BY game_id LIMIT 1",
            (match,)
        )
        found = cursor.fetchone()

    if found is not None:
        game_id = found[0]
        # fill in anything the first store didn't have, but don't
        # overwrite what's already there -- keeps one consistent version
        cursor.execute(
            """
            UPDATE games SET
                genre        = COALESCE(genre, %s),
                developer    = COALESCE(developer, %s),
                publisher    = COALESCE(publisher, %s),
                release_year = COALESCE(release_year, %s),
                synopsis     = COALESCE(synopsis, %s)
            WHERE game_id = %s
            """,
            (row["genre"], row["developer"], row["publisher"],
             row["release_year"], row["synopsis"], game_id)
        )
    else:
        # 3. brand new game
        cursor.execute(
            """
            INSERT INTO games
                (title, match_title, genre, developer, publisher, release_year, synopsis)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (row["title"], match, row["genre"], row["developer"],
             row["publisher"], row["release_year"], row["synopsis"])
        )
        game_id = cursor.lastrowid

    # save this store's version of the game (or refresh it if it changed)
    cursor.execute(
        """
        INSERT INTO game_sources
            (game_id, platform_id, external_id, store_title, store_synopsis, source_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            external_id    = VALUES(external_id),
            store_title    = VALUES(store_title),
            store_synopsis = VALUES(store_synopsis),
            source_url     = VALUES(source_url)
        """,
        (game_id, platform_id, row["external_id"], row["title"],
         row["synopsis"], row["source_url"])
    )
    return game_id
