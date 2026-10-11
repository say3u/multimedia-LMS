
#  GameBuddy | CS 514 Final Team Project
Design Planning: https://docs.google.com/document/d/1SZhi5rWudaYoxWQ4refjZ3xmhEVcpnUgkQmJFg961Mw/edit?usp=sharing

Website Link: https://sites.google.com/view/gamebuddyfs

## What it is
A multi-user game wishlist manager and price tracker. Sites like gg.deals
track prices across major platforms but treat every wishlist item the same
way, bombarding you with notifications regardless of how much you actually
care about a given game and they don't cover niche platforms (VR, retro,
mods, mobile). This app lets you build a wishlist across any platform, see
current and historical prices, and organize games into your own notification
categories (e.g. "hunting hard" checked hourly, vs. "someday maybe" checked
weekly) so you only get pinged about what you actually care about.

## Team
- David Nguyen - Team lead, floats across database, backend, and testing/benchmarking
- Eugene Vinnichenko - Backend & database
- Elmer Mendez - Backend Support and Presenting & Website
- Brandon Tse - Frontend Support and Testing/benchmarking
- Harish Raaj Sivakumar - Frontend 

## Tech stack
- MySQL
- Python (data import / price-check scripts)

## Project structure
- `schema.sql` — database schema: games, per-user wishlist tracking, custom
  notification categories with their own check schedules, price history, and
  two stored procedures (lending a physical copy, and recording a price
  check/triggering alerts) demonstrating transactions
- `import_steam.py`, `import_GOG.py`, `import_Epic.py` — pull game details +
  current pricing from each store and log it through the database
- `game_matching.py` — shared by the importers so the same game from
  different stores ends up as one game (with a row per store in
  `game_sources`) instead of duplicates
- `sample_queries.sql` — the queries the backend uses, grouped by feature

## Setup (so far..)
1. Run `schema.sql` in MySQL Workbench (open the file, run the whole
   script) to create the `game_tracker` database and all its tables.
   **If you already ran an older version:** the games table changed
   (Oct 11), so run `DROP DATABASE game_tracker;` first, then run
   schema.sql again, then re-run the import scripts.
2. `pip install requests mysql-connector-python python-dotenv`
3. Copy `.env.example` to `.env` and fill in your own MySQL password.
4. `python import_steam.py` (and `import_GOG.py` / `import_Epic.py`) to
   pull sample game + pricing data in.

## Status
Phase 1 - schema built and tested, Steam import pipeline working
end-to-end (games, prices, and price history confirmed populating
correctly). Draft website content in progress.

## ER Diagram

<img src="images/erdiagram.webp" alt="ER Diagram" width="800">
