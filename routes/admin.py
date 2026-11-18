"""Administrator pages: dashboard/reports, travel assets (CRUD), users, ALNS settings."""
import json
from functools import wraps

from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import func

from ai.alns import DEFAULT_PARAMS
from ai.nlp import INTEREST_KEYWORDS
from ai.pipeline import known_regions, load_alns_settings, save_alns_settings
from models import AlgorithmMetrics, Itinerary, TravelAsset, TripRequest, User, db

admin_bp = Blueprint("admin", __name__)


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapper(*args, **kwargs):
        if not current_user.is_admin:
            abort(403)
        return view(*args, **kwargs)
    return wrapper


@admin_bp.route("/")
@admin_required
def dashboard():
    stats = {
        "users": User.query.filter_by(role="traveller").count(),
        "assets": TravelAsset.query.count(),
        "trips": TripRequest.query.count(),
        "itineraries": Itinerary.query.count(),
        "avg_runtime": db.session.query(func.avg(AlgorithmMetrics.runtime_ms)).scalar() or 0,
        "avg_improve": db.session.query(func.avg(AlgorithmMetrics.improvement_pct)).scalar() or 0,
        "avg_cost": db.session.query(func.avg(Itinerary.total_cost)).scalar() or 0,
    }
    by_region = dict(db.session.query(TripRequest.region, func.count(TripRequest.id))
                     .group_by(TripRequest.region).all())
    interest_count = {k: 0 for k in INTEREST_KEYWORDS}
    for (ints,) in db.session.query(TripRequest.interests).all():
        for i in (ints or "").split(","):
            if i in interest_count:
                interest_count[i] += 1
    recent_metrics = AlgorithmMetrics.query.order_by(AlgorithmMetrics.created_at.desc()).limit(10).all()
    latest = recent_metrics[0] if recent_metrics else None
    latest_hist = json.loads(latest.operator_stats).get("history", []) if latest else []
    latest_weights = json.loads(latest.operator_stats).get("weights", {}) if latest else {}
    recent_trips = TripRequest.query.order_by(TripRequest.created_at.desc()).limit(8).all()
    return render_template("admin/dashboard.html", stats=stats, by_region=by_region,
                           interest_count=interest_count, recent_metrics=recent_metrics,
                           latest_hist=latest_hist, latest_weights=latest_weights, recent_trips=recent_trips)


# ------------------------------------------------------------- travel assets
@admin_bp.route("/assets")
@admin_required
def assets():
    region = request.args.get("region", "")
    q = TravelAsset.query
    if region:
        q = q.filter_by(region=region)
    items = q.order_by(TravelAsset.region, TravelAsset.asset_type, TravelAsset.name).all()
    return render_template("admin/assets.html", items=items, regions=known_regions(), region=region)


def _fill_asset(a, f):
    a.name = f.get("name", "").strip()
    a.asset_type = f.get("asset_type", "attraction")
    a.category = f.get("category", "culture")
    a.tags = f.get("tags", "").lower()
    a.region = (f.get("new_region") or f.get("region") or "").strip()
    a.latitude = float(f.get("latitude"))
    a.longitude = float(f.get("longitude"))
    a.est_cost = float(f.get("est_cost") or 0)
    a.visit_minutes = int(f.get("visit_minutes") or 60)
    a.open_time = f.get("open_time") or "09:00"
    a.close_time = f.get("close_time") or "18:00"
    a.rating = float(f.get("rating") or 4)
    a.description = f.get("description", "")
    a.is_active = bool(f.get("is_active"))


@admin_bp.route("/assets/new", methods=["GET", "POST"])
@admin_bp.route("/assets/<int:asset_id>/edit", methods=["GET", "POST"])
@admin_required
def asset_form(asset_id=None):
    a = db.get_or_404(TravelAsset, asset_id) if asset_id else TravelAsset(is_active=True)
    if request.method == "POST":
        try:
            _fill_asset(a, request.form)
            if not a.name or not a.region:
                raise ValueError("Name and region are required.")
        except (ValueError, TypeError) as e:
            flash(f"Please check the form: {e}", "error")
            return render_template("admin/asset_form.html", a=a, regions=known_regions(),
                                   categories=list(INTEREST_KEYWORDS))
        db.session.add(a)
        db.session.commit()
        flash(f"Saved '{a.name}'.", "success")
        return redirect(url_for("admin.assets", region=a.region))
    return render_template("admin/asset_form.html", a=a, regions=known_regions(), categories=list(INTEREST_KEYWORDS))


@admin_bp.route("/assets/<int:asset_id>/delete", methods=["POST"])
@admin_required
def asset_delete(asset_id):
    a = db.get_or_404(TravelAsset, asset_id)
    # Assets used in saved itineraries are hidden instead of deleted, to keep history correct
    from models import ItinerarySegment
    if ItinerarySegment.query.filter_by(asset_id=a.id).first() or Itinerary.query.filter_by(accommodation_id=a.id).first():
        a.is_active = False
        flash(f"'{a.name}' is used in saved trips, so it was hidden instead of deleted.", "info")
    else:
        db.session.delete(a)
        flash(f"Deleted '{a.name}'.", "info")
    db.session.commit()
    return redirect(url_for("admin.assets"))


# --------------------------------------------------------------------- users
@admin_bp.route("/users")
@admin_required
def users():
    rows = db.session.query(User, func.count(TripRequest.id)).outerjoin(TripRequest) \
        .group_by(User.id).order_by(User.created_at.desc()).all()
    return render_template("admin/users.html", rows=rows)


@admin_bp.route("/users/<int:user_id>/toggle", methods=["POST"])
@admin_required
def user_toggle(user_id):
    u = db.get_or_404(User, user_id)
    if u.id == current_user.id:
        flash("You cannot deactivate your own account.", "error")
    else:
        u.is_active_account = not u.is_active_account
        db.session.commit()
        flash(f"{u.name} is now {'active' if u.is_active_account else 'deactivated'}.", "info")
    return redirect(url_for("admin.users"))


# ------------------------------------------------------------- ALNS settings
@admin_bp.route("/settings", methods=["GET", "POST"])
@admin_required
def settings():
    path = current_app.config["ALNS_SETTINGS_FILE"]
    params = load_alns_settings(path)
    if request.method == "POST":
        if request.form.get("reset"):
            params = dict(DEFAULT_PARAMS)
        else:
            try:
                params.update({
                    "iterations": max(10, min(int(request.form["iterations"]), 3000)),
                    "destroy_min": float(request.form["destroy_min"]),
                    "destroy_max": float(request.form["destroy_max"]),
                    "start_temperature_pct": float(request.form["start_temperature_pct"]),
                    "cooling_rate": float(request.form["cooling_rate"]),
                    "reaction_factor": float(request.form["reaction_factor"]),
                    "distance_weight": float(request.form["distance_weight"]),
                })
                if not 0 < params["destroy_min"] <= params["destroy_max"] <= 1:
                    raise ValueError("destroy min/max must be between 0 and 1, min <= max")
            except (ValueError, KeyError) as e:
                flash(f"Invalid value: {e}", "error")
                return render_template("admin/settings.html", p=params)
        save_alns_settings(path, params)
        flash("ALNS parameters saved. New itineraries will use them.", "success")
        return redirect(url_for("admin.settings"))
    return render_template("admin/settings.html", p=params)
