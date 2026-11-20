"""
backend/db.py

helpers for running plain SQL from the routes. the auth routes use
SQLAlchemy models, but the price tracking stuff is written as straight
SQL on purpose -- it's a database class, and the joins / views / stored
procedures are the interesting part, so we want them visible instead
of hidden behind an ORM.

these borrow a connection from the same SQLAlchemy engine (so there's
only one database config), and pymysql uses %s placeholders just like
mysql.connector did in the old app.py, so the queries carried over as-is.
"""

from datetime import date, datetime
from decimal import Decimal

from pymysql.cursors import DictCursor

from .extensions import db


def _clean(value):
    """Decimal -> float and dates -> ISO strings so jsonify is happy"""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def clean_row(row):
    return {k: _clean(v) for k, v in row.items()}


def query(sql, params=(), one=False):
    """runs a SELECT and returns a list of dicts (or one dict / None)"""
    conn = db.engine.raw_connection()
    try:
        cur = conn.cursor(DictCursor)
        cur.execute(sql, params)
        rows = [clean_row(r) for r in cur.fetchall()]
        return (rows[0] if rows else None) if one else rows
    finally:
        conn.close()


def execute(sql, params=()):
    """runs an INSERT / UPDATE / DELETE, commits, and returns
    (rows changed, last insert id)"""
    conn = db.engine.raw_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        return cur.rowcount, cur.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def call_proc(name, args):
    """calls a stored procedure (like record_price_check). the procedure
    handles its own transaction, so no commit needed here"""
    conn = db.engine.raw_connection()
    try:
        cur = conn.cursor()
        cur.callproc(name, args)
        conn.commit()
    finally:
        conn.close()
