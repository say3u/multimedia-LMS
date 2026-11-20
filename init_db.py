"""
init_db.py

sets up the database from schema.sql without needing mysql workbench --
handy for teammates and for the hosted (railway) database, where we
can't just open workbench.

    python init_db.py

uses DATABASE_URL if it's set (railway), otherwise the DB_ values in
.env. safe to run more than once, schema.sql only creates what's missing.

the CREATE DATABASE / USE lines at the top of schema.sql are skipped
since we connect straight to the right database (on railway it isn't
called game_tracker). DELIMITER lines are a workbench/mysql-client
thing, not real sql, so we split the procedures out by hand
"""

import os
import pymysql

from db_config import connection_settings


def statements(sql_text):
    """splits schema.sql into statements, following DELIMITER changes"""
    delimiter, buf = ";", []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if stripped.upper().startswith("DELIMITER "):
            delimiter = stripped.split()[1]
            continue
        buf.append(line)
        if stripped.endswith(delimiter):
            stmt = "\n".join(buf).strip()
            buf = []
            stmt = stmt[: -len(delimiter)].strip()
            body = "\n".join(l for l in stmt.splitlines() if not l.strip().startswith("--")).strip()
            if body and not body.upper().startswith(("CREATE DATABASE", "USE ")):
                yield stmt


def main():
    settings = connection_settings()
    db_name = settings.pop("database")

    # make the database if it doesn't exist yet (local only -- on railway
    # it already exists and we might not be allowed to create one)
    conn = pymysql.connect(**settings, autocommit=True)
    conn.cursor().execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}`")
    conn.select_db(db_name)

    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
    count = 0
    with conn.cursor() as cur:
        for stmt in statements(open(path, encoding="utf-8").read()):
            cur.execute(stmt)
            count += 1
    conn.close()
    print(f"schema.sql applied to {db_name} ({count} statements)")


if __name__ == "__main__":
    main()
