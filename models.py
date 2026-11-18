"""
PackMY database models - the 8 tables from the Progress 1 report:

    User, Travel_Profile, Travel_Asset, Trip_Request,
    Itinerary, Itinerary_Segment, Expense_Log, Algorithm_Metrics
"""
from datetime import datetime

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = "user"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)  # never store plain passwords
    role = db.Column(db.String(20), default="traveller")  # "traveller" or "admin"
    is_active_account = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    profile = db.relationship("TravelProfile", backref="user", uselist=False, cascade="all, delete-orphan")
    trips = db.relationship("TripRequest", backref="user", cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self):
        return self.role == "admin"

    @property
    def is_active(self):  # used by Flask-Login
        return self.is_active_account


class TravelProfile(db.Model):
    __tablename__ = "travel_profile"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    home_state = db.Column(db.String(60))
    travel_style = db.Column(db.String(20), default="moderate")  # budget / moderate / luxury
    pace = db.Column(db.String(20), default="normal")  # relaxed / normal / packed
    default_budget = db.Column(db.Float, default=1000)
    interests = db.Column(db.String(255), default="")  # comma separated, e.g. "nature,food"


class TravelAsset(db.Model):
    """A place in the directory: an attraction or an accommodation."""
    __tablename__ = "travel_asset"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    asset_type = db.Column(db.String(20), default="attraction")  # attraction / accommodation
    category = db.Column(db.String(40))  # nature, culture, food, shopping, adventure, beach, family, history
    tags = db.Column(db.String(255), default="")  # extra keywords, comma separated
    region = db.Column(db.String(60), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    est_cost = db.Column(db.Float, default=0)  # RM per person (per night for accommodation)
    visit_minutes = db.Column(db.Integer, default=90)
    open_time = db.Column(db.String(5), default="09:00")  # "HH:MM"
    close_time = db.Column(db.String(5), default="18:00")
    rating = db.Column(db.Float, default=4.0)
    description = db.Column(db.Text, default="")
    is_active = db.Column(db.Boolean, default=True)

    def tag_list(self):
        words = [self.category or ""] + (self.tags or "").split(",")
        return {w.strip().lower() for w in words if w.strip()}


class TripRequest(db.Model):
    __tablename__ = "trip_request"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    region = db.Column(db.String(60), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    days = db.Column(db.Integer, nullable=False)
    budget = db.Column(db.Float, nullable=False)
    travellers = db.Column(db.Integer, default=1)
    interests = db.Column(db.String(255), default="")
    prompt = db.Column(db.Text, default="")
    parsed_json = db.Column(db.Text, default="{}")  # output of the NLP module
    status = db.Column(db.String(20), default="pending")  # pending / done / failed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    itinerary = db.relationship("Itinerary", backref="trip", uselist=False, cascade="all, delete-orphan")


class Itinerary(db.Model):
    __tablename__ = "itinerary"
    id = db.Column(db.Integer, primary_key=True)
    trip_request_id = db.Column(db.Integer, db.ForeignKey("trip_request.id"), nullable=False)
    title = db.Column(db.String(150))
    accommodation_id = db.Column(db.Integer, db.ForeignKey("travel_asset.id"))
    total_cost = db.Column(db.Float, default=0)
    total_distance_km = db.Column(db.Float, default=0)
    summary_text = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    accommodation = db.relationship("TravelAsset")
    segments = db.relationship("ItinerarySegment", backref="itinerary", cascade="all, delete-orphan",
                               order_by="(ItinerarySegment.day_no, ItinerarySegment.order_no)")
    expenses = db.relationship("ExpenseLog", backref="itinerary", cascade="all, delete-orphan")
    metrics = db.relationship("AlgorithmMetrics", backref="itinerary", uselist=False, cascade="all, delete-orphan")


class ItinerarySegment(db.Model):
    """One stop in the itinerary (day X, stop Y)."""
    __tablename__ = "itinerary_segment"
    id = db.Column(db.Integer, primary_key=True)
    itinerary_id = db.Column(db.Integer, db.ForeignKey("itinerary.id"), nullable=False)
    asset_id = db.Column(db.Integer, db.ForeignKey("travel_asset.id"), nullable=False)
    day_no = db.Column(db.Integer, nullable=False)
    order_no = db.Column(db.Integer, nullable=False)
    arrive_time = db.Column(db.String(5))
    depart_time = db.Column(db.String(5))
    travel_km = db.Column(db.Float, default=0)  # distance from previous stop
    cost = db.Column(db.Float, default=0)
    suitability = db.Column(db.Float, default=0)  # fuzzy score 0-1

    asset = db.relationship("TravelAsset")


class ExpenseLog(db.Model):
    __tablename__ = "expense_log"
    id = db.Column(db.Integer, primary_key=True)
    itinerary_id = db.Column(db.Integer, db.ForeignKey("itinerary.id"), nullable=False)
    day_no = db.Column(db.Integer, default=0)  # 0 = whole trip
    category = db.Column(db.String(30))  # Accommodation / Attractions / Transport / Food
    description = db.Column(db.String(200))
    amount = db.Column(db.Float, default=0)


class AlgorithmMetrics(db.Model):
    __tablename__ = "algorithm_metrics"
    id = db.Column(db.Integer, primary_key=True)
    itinerary_id = db.Column(db.Integer, db.ForeignKey("itinerary.id"), nullable=False)
    algorithm = db.Column(db.String(30), default="ALNS")
    iterations = db.Column(db.Integer)
    runtime_ms = db.Column(db.Float)
    candidates = db.Column(db.Integer)  # attractions passed from fuzzy ranking
    initial_objective = db.Column(db.Float)
    best_objective = db.Column(db.Float)
    improvement_pct = db.Column(db.Float)
    operator_stats = db.Column(db.Text, default="{}")  # how often each destroy/repair operator won
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
