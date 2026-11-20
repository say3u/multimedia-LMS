"""
migrate_db.py

brings an EXISTING database (like the one on railway) up to date with
schema.sql without deleting anything. init_db.py can't do this by itself:
schema.sql uses CREATE TABLE IF NOT EXISTS, so a table that's already
there (but older) gets skipped and keeps its old columns.

how it works:
1. builds the current schema.sql in a scratch database next to yours
   (<your db>_migrate_ref), so we know exactly what it should look like
2. compares the two and ADDS what yours is missing: tables, columns,
   wider enums (like the new 'backlog' status), indexes, foreign keys,
   checks. it never drops a table, column or row
3. fills in data the new code needs (default notification categories for
   every user, a category for wishlist games, match_title for old games)
4. runs schema.sql on top, which (re)creates the views, stored procedures
   and triggers
5. compares again and tells you if anything still doesn't match, then
   deletes the scratch database

    python migrate_db.py            # dry run: shows what it WOULD do
    python migrate_db.py --apply    # does it (asks you to type the db name)

uses DATABASE_URL if it's set (railway), otherwise the DB_ values in .env.
**back up first** -- mysql can't undo ALTER TABLE. see the README.
safe to run more than once, a second run should find nothing to do.
"""

import argparse
import os
import re
import sys

import pymysql
from pymysql.cursors import DictCursor

from db_config import connection_settings
from game_matching import normalize_title
from init_db import statements

SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

# same as backend/routes/watchlist.py DEFAULT_CATEGORIES
DEFAULT_CATEGORIES = [("Hunting hard", 60), ("Someday maybe", 10080), ("Muted", None)]


def connect(settings, database=None):
    # UTC on purpose: harish's old tables stored times as UTC DATETIMEs, so
    # converting them to TIMESTAMP in a UTC session keeps them correct
    return pymysql.connect(
        host=settings["host"], port=settings["port"], user=settings["user"],
        password=settings["password"], database=database, autocommit=True,
        cursorclass=DictCursor, init_command="SET time_zone = '+00:00'",
    )


def rows(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchall()


# ----------------------------
# READING WHAT A DATABASE LOOKS LIKE (information_schema)
# ----------------------------

def read_schema(cur, db):
    """tables -> columns / indexes / foreign keys / checks for one database"""
    tables = [r["TABLE_NAME"] for r in rows(cur,
        "SELECT TABLE_NAME FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'", (db,))]

    cols = {t: {} for t in tables}
    for r in rows(cur,
            "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, ORDINAL_POSITION "
            "FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME, ORDINAL_POSITION", (db,)):
        if r["TABLE_NAME"] in cols:
            cols[r["TABLE_NAME"]][r["COLUMN_NAME"]] = r

    idx = {t: {} for t in tables}
    for r in rows(cur,
            "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = %s AND INDEX_NAME <> 'PRIMARY' ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX", (db,)):
        if r["TABLE_NAME"] in idx:
            unique, cols_ = idx[r["TABLE_NAME"]].get(r["INDEX_NAME"], (not r["NON_UNIQUE"], ()))
            idx[r["TABLE_NAME"]][r["INDEX_NAME"]] = (unique, cols_ + (r["COLUMN_NAME"],))

    fks = {t: [] for t in tables}
    for r in rows(cur, """
            SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
                   k.REFERENCED_COLUMN_NAME, rc.DELETE_RULE
            FROM information_schema.KEY_COLUMN_USAGE k
            JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
              ON rc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME
            WHERE k.TABLE_SCHEMA = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL""", (db,)):
        if r["TABLE_NAME"] in fks:
            fks[r["TABLE_NAME"]].append(r)

    checks = {t: [] for t in tables}
    for r in rows(cur, """
            SELECT tc.TABLE_NAME, cc.CHECK_CLAUSE
            FROM information_schema.TABLE_CONSTRAINTS tc
            JOIN information_schema.CHECK_CONSTRAINTS cc
              ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
            WHERE tc.TABLE_SCHEMA = %s AND tc.CONSTRAINT_TYPE = 'CHECK'""", (db,)):
        if r["TABLE_NAME"] in checks:
            checks[r["TABLE_NAME"]].append(r["CHECK_CLAUSE"])

    return {"tables": tables, "cols": cols, "idx": idx, "fks": fks, "checks": checks}


def clean_extra(extra):
    return " ".join((extra or "").replace("DEFAULT_GENERATED", "").split())


def same_column(a, b):
    return (a["COLUMN_TYPE"] == b["COLUMN_TYPE"] and a["IS_NULLABLE"] == b["IS_NULLABLE"]
            and a["COLUMN_DEFAULT"] == b["COLUMN_DEFAULT"]
            and clean_extra(a["EXTRA"]).lower() == clean_extra(b["EXTRA"]).lower())


def column_sql(conn, c, force_nullable=False):
    """the definition for ALTER TABLE ... ADD/MODIFY COLUMN, built from
    the reference database's information_schema row"""
    parts = [f"`{c['COLUMN_NAME']}`", c["COLUMN_TYPE"]]
    parts.append("NULL" if (c["IS_NULLABLE"] == "YES" or force_nullable) else "NOT NULL")
    default = c["COLUMN_DEFAULT"]
    if default is not None:
        is_expr = "DEFAULT_GENERATED" in (c["EXTRA"] or "") or default.upper().startswith("CURRENT_TIMESTAMP")
        parts.append(f"DEFAULT {default}" if is_expr else f"DEFAULT {conn.escape(default)}")
    extra = clean_extra(c["EXTRA"])
    if extra:
        parts.append(extra)  # e.g. "on update CURRENT_TIMESTAMP"
    return " ".join(parts)


def enum_values(column_type):
    return re.findall(r"'((?:[^']|'')*)'", column_type) if column_type.startswith("enum(") else None


def varchar_len(column_type):
    m = re.fullmatch(r"varchar\((\d+)\)", column_type)
    return int(m.group(1)) if m else None


def norm_clause(clause):
    return re.sub(r"[`\s()]", "", clause).lower()


# ----------------------------
# THE MIGRATION
# ----------------------------

class Migration:
    def __init__(self, conn, db, apply):
        self.conn, self.db, self.apply = conn, db, apply
        self.cur = conn.cursor()
        self.done, self.skipped = [], []

    def run_sql(self, sql, why):
        """runs one statement (or just prints it on a dry run). failures
        are reported and skipped instead of stopping everything"""
        print(f"  {'->' if self.apply else 'would run:'} {sql if len(sql) < 220 else sql[:220] + ' ...'}")
        print(f"     ({why})")
        if not self.apply:
            self.done.append(sql)
            return True
        try:
            self.cur.execute(sql)
            self.done.append(sql)
            return True
        except pymysql.MySQLError as e:
            self.skipped.append(f"{sql[:120]} -> {e.args[-1]}")
            print(f"     !! failed, skipped: {e.args[-1]}")
            return False

    def warn(self, msg):
        self.skipped.append(msg)
        print(f"  !! {msg}")

    def count(self, sql, args=()):
        return list(rows(self.cur, sql, args)[0].values())[0]

    # -- step 1: tables that don't exist at all
    def create_missing_tables(self, ref, mine):
        missing = [t for t in ref["tables"] if t not in mine["tables"]]
        print(f"\n[1] missing tables: {', '.join(missing) or 'none'}")
        if not missing:
            return
        for stmt in statements(open(SCHEMA_PATH, encoding="utf-8").read()):
            m = re.match(r"\s*(?:--.*\n\s*)*CREATE TABLE IF NOT EXISTS (\w+)", stmt)
            if m and m.group(1) in missing:
                self.run_sql(stmt.strip(), f"create table {m.group(1)}")

    # -- step 2: columns
    def fix_columns(self, ref, mine):
        print("\n[2] columns")
        changed = False
        for table in ref["tables"]:
            if table not in mine["tables"]:
                continue
            have, want = mine["cols"][table], ref["cols"][table]
            prev = None
            for name, c in want.items():
                if name not in have:
                    after = f" AFTER `{prev}`" if prev in have else ""
                    # a NOT NULL column with no default can't be added to a
                    # table that already has rows -- add it nullable, the
                    # data fixes fill it in, and the next pass tightens it
                    no_default = c["IS_NULLABLE"] == "NO" and c["COLUMN_DEFAULT"] is None
                    rows_ = self.count(f"SELECT COUNT(*) FROM `{table}`") if no_default else 0
                    sql = f"ALTER TABLE `{table}` ADD COLUMN {column_sql(self.conn, c, force_nullable=rows_ > 0)}{after}"
                    changed |= self.run_sql(sql, f"{table}.{name} is missing")
                elif not same_column(have[name], c):
                    changed |= self.modify_column(table, have[name], c)
                prev = name
        if not changed:
            print("  nothing to change")

    def modify_column(self, table, old, new):
        name = new["COLUMN_NAME"]
        old_enum, new_enum = enum_values(old["COLUMN_TYPE"]), enum_values(new["COLUMN_TYPE"])
        if old_enum is not None and new_enum is not None and not set(old_enum) <= set(new_enum):
            self.warn(f"{table}.{name}: enum {old['COLUMN_TYPE']} has values schema.sql doesn't -- left alone")
            return False
        old_len, new_len = varchar_len(old["COLUMN_TYPE"]), varchar_len(new["COLUMN_TYPE"])
        if old_len and new_len and new_len < old_len:
            self.warn(f"{table}.{name}: would shrink {old['COLUMN_TYPE']} -> {new['COLUMN_TYPE']} -- left alone")
            return False

        # going NOT NULL: fill existing NULLs with the default first
        if new["IS_NULLABLE"] == "NO" and old["IS_NULLABLE"] == "YES":
            nulls = self.count(f"SELECT COUNT(*) FROM `{table}` WHERE `{name}` IS NULL")
            if nulls:
                default = new["COLUMN_DEFAULT"]
                if default is None:
                    self.warn(f"{table}.{name}: {nulls} rows are NULL and there's no default -- left nullable")
                    return False
                value = "CURRENT_TIMESTAMP" if default.upper().startswith("CURRENT_TIMESTAMP") else self.conn.escape(default)
                self.run_sql(f"UPDATE `{table}` SET `{name}` = {value} WHERE `{name}` IS NULL",
                             f"{nulls} rows need a value before {name} becomes NOT NULL")

        # old rows with NULL timestamps (harish's tables had no db default):
        # give them "now" so the app doesn't choke on them
        if new["COLUMN_DEFAULT"] and new["COLUMN_DEFAULT"].upper().startswith("CURRENT_TIMESTAMP") \
                and new["IS_NULLABLE"] == "YES":
            nulls = self.count(f"SELECT COUNT(*) FROM `{table}` WHERE `{name}` IS NULL")
            if nulls:
                self.run_sql(f"UPDATE `{table}` SET `{name}` = CURRENT_TIMESTAMP WHERE `{name}` IS NULL",
                             f"{nulls} rows have no {name}")

        why = (f"{table}.{name}: {old['COLUMN_TYPE']} {'NULL' if old['IS_NULLABLE'] == 'YES' else 'NOT NULL'}"
               f" default {old['COLUMN_DEFAULT']} -> what schema.sql has")
        return self.run_sql(f"ALTER TABLE `{table}` MODIFY COLUMN {column_sql(self.conn, new)}", why)

    # -- step 3: data the new code needs
    def fix_data(self, mine):
        print("\n[3] data fixes")
        did = False
        if "games" in mine["tables"] and "match_title" in mine["cols"]["games"]:
            todo = rows(self.cur, "SELECT game_id, title FROM games WHERE match_title IS NULL OR match_title = ''")
            if todo:
                did = True
                print(f"  {'->' if self.apply else 'would'} fill in match_title for {len(todo)} games")
                if self.apply:
                    for g in todo:
                        self.cur.execute("UPDATE games SET match_title = %s WHERE game_id = %s",
                                         (normalize_title(g["title"]), g["game_id"]))

        if "notification_categories" in mine["tables"] and "users" in mine["tables"]:
            # users with no categories at all get the 3 defaults (new signups
            # get them in auth.register). one statement, so a user who gets
            # the first default isn't skipped for the other two
            missing = self.count(
                "SELECT COUNT(*) FROM users u WHERE NOT EXISTS "
                "(SELECT 1 FROM notification_categories nc WHERE nc.user_id = u.user_id)")
            if missing:
                did = True
                defaults = " UNION ALL ".join(
                    f"SELECT {self.conn.escape(n)} AS name, {self.conn.escape(m)} AS minutes"
                    for n, m in DEFAULT_CATEGORIES)
                self.run_sql(
                    "INSERT IGNORE INTO notification_categories (user_id, name, check_interval_minutes) "
                    f"SELECT u.user_id, d.name, d.minutes FROM users u CROSS JOIN ({defaults}) d "
                    "WHERE NOT EXISTS (SELECT 1 FROM notification_categories nc WHERE nc.user_id = u.user_id)",
                    f"{missing} users have no notification categories")
        elif "users" in mine["tables"]:
            n = self.count("SELECT COUNT(*) FROM users")
            if n:  # dry run, the table isn't created yet
                did = True
                print(f"  would give {n} users the default notification categories")

        # wishlist games without a category never trigger alerts
        if "category_id" in mine["cols"].get("user_games", {}):
            n = self.count("SELECT COUNT(*) FROM user_games WHERE status = 'want_to_play' AND category_id IS NULL")
            if n:
                did = True
                self.run_sql(
                    "UPDATE user_games ug SET category_id = (SELECT MIN(nc.category_id) FROM notification_categories nc "
                    "WHERE nc.user_id = ug.user_id) WHERE ug.status = 'want_to_play' AND ug.category_id IS NULL",
                    f"{n} wishlist games have no notification category, so they'd never alert")
        elif "user_games" in mine["tables"]:
            n = self.count("SELECT COUNT(*) FROM user_games WHERE status = 'want_to_play'")
            if n:
                did = True
                print(f"  would put {n} wishlist games in their owner's default category")
        if not did:
            print("  nothing to change")

    # -- step 4: indexes, foreign keys, checks
    def fix_keys(self, ref, mine):
        print("\n[4] indexes, foreign keys, checks")
        changed = False
        for table in ref["tables"]:
            if table not in mine["tables"]:
                continue
            have_idx = set(mine["idx"][table].values())
            for name, (unique, cols) in ref["idx"][table].items():
                if (unique, cols) in have_idx or (not unique and (True, cols) in have_idx):
                    continue
                if unique:
                    dupes = self.count(
                        f"SELECT COUNT(*) FROM (SELECT 1 FROM `{table}` GROUP BY {', '.join(f'`{c}`' for c in cols)} "
                        "HAVING COUNT(*) > 1) d") if all(c in mine["cols"][table] for c in cols) else 0
                    if dupes:
                        self.warn(f"{table}: can't add UNIQUE ({', '.join(cols)}), {dupes} duplicate groups -- fix those first")
                        continue
                if name in mine["idx"][table]:
                    name = f"{name}_m"
                changed |= self.run_sql(
                    f"ALTER TABLE `{table}` ADD {'UNIQUE ' if unique else ''}INDEX `{name}` "
                    f"({', '.join(f'`{c}`' for c in cols)})", f"{table} is missing this index")

            have_fk = {(f["COLUMN_NAME"], f["REFERENCED_TABLE_NAME"], f["REFERENCED_COLUMN_NAME"]) for f in mine["fks"][table]}
            for f in ref["fks"][table]:
                key = (f["COLUMN_NAME"], f["REFERENCED_TABLE_NAME"], f["REFERENCED_COLUMN_NAME"])
                if key in have_fk:
                    continue
                col, rt, rc = key
                if rt in mine["tables"] and col in mine["cols"][table]:
                    orphans = self.count(
                        f"SELECT COUNT(*) FROM `{table}` t WHERE t.`{col}` IS NOT NULL AND NOT EXISTS "
                        f"(SELECT 1 FROM `{rt}` r WHERE r.`{rc}` = t.`{col}`)")
                    if orphans:
                        self.warn(f"{table}.{col}: {orphans} rows point at missing {rt} rows -- foreign key not added")
                        continue
                rule = {"CASCADE": "CASCADE", "SET NULL": "SET NULL"}.get(f["DELETE_RULE"], "RESTRICT")
                changed |= self.run_sql(
                    f"ALTER TABLE `{table}` ADD FOREIGN KEY (`{col}`) REFERENCES `{rt}` (`{rc}`) ON DELETE {rule}",
                    f"{table}.{col} -> {rt}.{rc} foreign key is missing")

            have_chk = {norm_clause(c) for c in mine["checks"][table]}
            for clause in ref["checks"][table]:
                if norm_clause(clause) not in have_chk:
                    changed |= self.run_sql(f"ALTER TABLE `{table}` ADD CHECK {clause}",
                                            f"{table} is missing this check")
        if not changed:
            print("  nothing to change")

    # -- step 5: views, procedures, triggers
    def apply_schema(self):
        print("\n[5] views, stored procedures, triggers (runs schema.sql on top)")
        if not self.apply:
            print("  would run schema.sql (only creates what's missing + replaces procedures/triggers/view)")
            return
        n = 0
        for stmt in statements(open(SCHEMA_PATH, encoding="utf-8").read()):
            self.cur.execute(stmt)
            n += 1
        print(f"  -> ran {n} statements")


def differences(ref, mine):
    """what still doesn't match, for the final check"""
    out = []
    for t in ref["tables"]:
        if t not in mine["tables"]:
            out.append(f"table {t} missing")
            continue
        for name, c in ref["cols"][t].items():
            if name not in mine["cols"][t]:
                out.append(f"{t}.{name} missing")
            elif not same_column(mine["cols"][t][name], c):
                out.append(f"{t}.{name}: {mine['cols'][t][name]['COLUMN_TYPE']} vs {c['COLUMN_TYPE']}")
        have_fk = {(f["COLUMN_NAME"], f["REFERENCED_TABLE_NAME"]) for f in mine["fks"][t]}
        out += [f"{t}.{f['COLUMN_NAME']} foreign key missing" for f in ref["fks"][t]
                if (f["COLUMN_NAME"], f["REFERENCED_TABLE_NAME"]) not in have_fk]
    return out


def main():
    parser = argparse.ArgumentParser(description="update an existing database to match schema.sql")
    parser.add_argument("--apply", action="store_true", help="actually make the changes (default is a dry run)")
    parser.add_argument("--yes", action="store_true", help="don't ask for confirmation (for scripts)")
    args = parser.parse_args()

    settings = connection_settings()
    db = settings.pop("database")
    ref_db = f"{db}_migrate_ref"
    print(f"database: {db} on {settings['host']}:{settings['port']}  ({'APPLY' if args.apply else 'dry run, nothing will change'})")

    if args.apply and not args.yes:
        print("\nthis changes the real database and can't be undone. make a backup first (see README).")
        if input(f"type the database name ({db}) to go ahead: ").strip() != db:
            print("cancelled")
            return 1

    conn = connect(settings)
    cur = conn.cursor()
    try:
        # 1. build what it SHOULD look like in a scratch database
        cur.execute(f"DROP DATABASE IF EXISTS `{ref_db}`")
        cur.execute(f"CREATE DATABASE `{ref_db}`")
        conn.select_db(ref_db)
        for stmt in statements(open(SCHEMA_PATH, encoding="utf-8").read()):
            cur.execute(stmt)
        ref = read_schema(cur, ref_db)
        conn.select_db(db)

        m = Migration(conn, db, args.apply)
        mine = read_schema(cur, db)
        m.create_missing_tables(ref, mine)
        if args.apply:
            mine = read_schema(cur, db)
        m.fix_columns(ref, mine)
        if args.apply:
            mine = read_schema(cur, db)
        m.fix_data(mine)
        if args.apply:
            m.fix_columns(ref, read_schema(cur, db))  # tighten anything added nullable above
            mine = read_schema(cur, db)
        m.fix_keys(ref, mine)
        m.apply_schema()

        print("\n[done]")
        if args.apply:
            left = differences(ref, read_schema(cur, db))
            print("  database now matches schema.sql" if not left else "  still different:\n    " + "\n    ".join(left))
        else:
            print(f"  dry run: {len(m.done)} changes planned. run with --apply to do them.")
        if m.skipped:
            print("  skipped / needs a look:\n    " + "\n    ".join(m.skipped))
        return 0 if not m.skipped else 2
    finally:
        cur.execute(f"DROP DATABASE IF EXISTS `{ref_db}`")
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
