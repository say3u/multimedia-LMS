"""
db_config.py

one place that works out how to connect to mysql, shared by the import
scripts, init_db.py and migrate_db.py (the flask backend has its own
version in backend/app.py since it needs a SQLAlchemy url).

- if DATABASE_URL (or MYSQL_URL) is set, use that -- this is what railway
  gives us, e.g. mysql://user:pass@host:33066/railway
- otherwise use DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME from
  .env like before

before this the import scripts only knew host/user/password/name, so
they couldn't reach railway (it's not on the default port 3306).
"""

import os
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

load_dotenv()


def connection_settings():
    """returns {host, port, user, password, database} -- works for both
    mysql.connector.connect(**settings) and pymysql.connect(**settings)"""
    url = os.environ.get("DATABASE_URL") or os.environ.get("MYSQL_URL")
    if url:
        u = urlparse(url.replace("mysql+pymysql://", "mysql://", 1))
        settings = dict(host=u.hostname, port=u.port or 3306, user=unquote(u.username or ""),
                        password=unquote(u.password or ""), database=u.path.lstrip("/"))
    else:
        settings = dict(host=os.environ.get("DB_HOST", "localhost"),
                        port=int(os.environ.get("DB_PORT", 3306)),
                        user=os.environ.get("DB_USER", "root"),
                        password=os.environ.get("DB_PASSWORD"),
                        database=os.environ.get("DB_NAME", "game_tracker"))
    if not settings["password"]:
        raise RuntimeError(
            "No database password. Copy .env.example to .env and fill in "
            "DB_PASSWORD, or set DATABASE_URL."
        )
    return settings
