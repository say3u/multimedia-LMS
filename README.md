# Media Library Tracker | CS 514 Final Team Project

## What it is
A personal media tracker for books, movies, shows, and games. Track what
you want to try, what you're in progress on, and what you've finished, with
your own notes and ratings. Includes a social layer (following other users,
lending items to friends) and pulls item data in automatically from public
APIs (TMDb, Open Library, IGDB) instead of manual entry.

## Team
- David Nguyen - [role]
- Eugene Vinnichenko - [role]
- Elmer Mendez - [role]
- Brandon Tse - [role]
- Harish Raaj Sivakumar - [role]

## Tech stack
- MySQL
- Python (data import scripts)

## Project structure
- `schema.sql` — database schema (tables + a stored procedure for the
  lending/transaction logic)

## Setup (so far..)
1. Run `schema.sql` in MySQL Workbench (or `mysql -u root -p < schema.sql`
   from the command line) to create the database and tables.

## Status
Phase 1 - schema built and tested, draft website in progress.
