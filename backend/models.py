import re
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Enum as SAEnum
from .extensions import db


class Platform(db.Model):
    __tablename__ = 'platforms'

    platform_id   = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name          = db.Column(db.String(100), nullable=False, unique=True)
    platform_type = db.Column(SAEnum('pc', 'console', 'vr', 'mobile', 'mods', name='platform_type_enum'), nullable=False, default='pc')


class Listing(db.Model):
    __tablename__ = 'listings'

    listing_id    = db.Column(db.Integer, primary_key=True, autoincrement=True)
    game_id       = db.Column(db.Integer, db.ForeignKey('games.game_id', ondelete='CASCADE'), nullable=False)
    platform_id   = db.Column(db.Integer, db.ForeignKey('platforms.platform_id', ondelete='CASCADE'), nullable=False)
    current_price = db.Column(db.Numeric(8, 2))
    regular_price = db.Column(db.Numeric(8, 2))
    currency      = db.Column(db.String(3), nullable=False, default='USD')
    listing_url   = db.Column(db.String(500))
    last_checked_at = db.Column(db.DateTime, server_default=db.func.now())

    platform = db.relationship('Platform', backref='listings')


class PriceHistory(db.Model):
    __tablename__ = 'price_history'

    history_id  = db.Column(db.Integer, primary_key=True, autoincrement=True)
    listing_id  = db.Column(db.Integer, db.ForeignKey('listings.listing_id', ondelete='CASCADE'), nullable=False)
    price       = db.Column(db.Numeric(8, 2), nullable=False)
    recorded_at = db.Column(db.DateTime, server_default=db.func.now())


def _make_match_title(title):
    return re.sub(r'[^a-z0-9 ]', '', title.lower()).strip()


class User(db.Model):
    __tablename__ = 'users'

    user_id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username      = db.Column(db.String(50),  nullable=False, unique=True)
    email         = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at    = db.Column(db.DateTime, server_default=db.func.now())

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
    created_at   = db.Column(db.DateTime, server_default=db.func.now())

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


class UserGame(db.Model):
    __tablename__ = 'user_games'

    user_game_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id      = db.Column(db.Integer, db.ForeignKey('users.user_id',  ondelete='CASCADE'), nullable=False)
    game_id      = db.Column(db.Integer, db.ForeignKey('games.game_id',  ondelete='CASCADE'), nullable=False)
    status       = db.Column(SAEnum('want_to_play', 'backlog', 'playing', 'completed', name='user_game_status'), nullable=False, default='want_to_play')
    rating       = db.Column(db.SmallInteger)
    notes        = db.Column(db.Text)
    added_at     = db.Column(db.DateTime, server_default=db.func.now())
    updated_at   = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())
    # wishlist settings (brandon's columns in schema.sql)
    # plain column, no db.ForeignKey -- there's no model for
    # notification_categories, and schema.sql already enforces the FK
    category_id    = db.Column(db.Integer)
    target_price   = db.Column(db.Numeric(8, 2))
    notify_enabled = db.Column(db.Boolean, nullable=False, default=True)
    # library info (phase 1.5) -- where you own it, what you paid, when
    owned_platform_id = db.Column(db.Integer)
    paid_price        = db.Column(db.Numeric(8, 2))
    bought_at         = db.Column(db.Date)

    __table_args__ = (db.UniqueConstraint('user_id', 'game_id', name='uq_user_game'),)

    def to_dict(self):
        return {
            'user_game_id':   self.user_game_id,
            'user_id':        self.user_id,
            'game_id':        self.game_id,
            'status':         self.status,
            'rating':         self.rating,
            'notes':          self.notes,
            'category_id':    self.category_id,
            'target_price':   float(self.target_price) if self.target_price is not None else None,
            'notify_enabled': self.notify_enabled,
            'owned_platform_id': self.owned_platform_id,
            'paid_price':     float(self.paid_price) if self.paid_price is not None else None,
            'bought_at':      self.bought_at.isoformat() if self.bought_at else None,
            'added_at':       self.added_at.isoformat(),
        }
