from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db


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
