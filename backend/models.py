import re
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db


def _make_match_title(title):
    return re.sub(r'[^a-z0-9 ]', '', title.lower()).strip()


class User(db.Model):
    __tablename__ = 'users'

    user_id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username      = db.Column(db.String(50),  nullable=False, unique=True)
    email         = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at    = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'user_id':    self.user_id,
            'username':   self.username,
            'email':      self.email,
            'created_at': self.created_at.isoformat(),
        }


class Game(db.Model):
    __tablename__ = 'games'

    game_id      = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title        = db.Column(db.String(255), nullable=False)
    match_title  = db.Column(db.String(255), nullable=False)
    genre        = db.Column(db.String(100))
    developer    = db.Column(db.String(255))
    publisher    = db.Column(db.String(255))
    release_year = db.Column(db.SmallInteger)
    synopsis     = db.Column(db.Text)
    icon_url     = db.Column(db.String(500))
    banner_url   = db.Column(db.String(500))
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __init__(self, **kwargs):
        if 'match_title' not in kwargs and 'title' in kwargs:
            kwargs['match_title'] = _make_match_title(kwargs['title'])
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            'game_id':      self.game_id,
            'title':        self.title,
            'genre':        self.genre,
            'developer':    self.developer,
            'publisher':    self.publisher,
            'release_year': self.release_year,
            'synopsis':     self.synopsis,
            'icon_url':     self.icon_url,
            'banner_url':   self.banner_url,
        }
