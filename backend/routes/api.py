"""JSON API endpoints consumed by the Next.js frontend."""
import json
from collections import defaultdict
from datetime import date, datetime, timedelta
from functools import wraps

from flask import Blueprint, Response, current_app, jsonify, request
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import func

from ai import nlp
from ai.alns import DEFAULT_PARAMS
from ai.pipeline import (generate_itinerary, known_regions, load_alns_settings,
                         save_alns_settings)
from models import (AlgorithmMetrics, Itinerary, ItinerarySegment, TravelAsset,
                    TravelProfile, TripRequest, User, db)
from utils.pdf import itinerary_pdf

api_bp = Blueprint("api", __name__)
INTERESTS = list(nlp.INTEREST_KEYWORDS.keys())


def api_admin_required(view):
    @wraps(view)
    @login_required
    def wrapper(*args, **kwargs):
        if not current_user.is_admin:
            return jsonify({"error": "Admin access required."}), 403
        return view(*args, **kwargs)
    return wrapper


def _serialize_profile(prof):
    if not prof:
        return {
            "home_state": "",
            "travel_style": "moderate",
            "pace": "normal",
            "default_budget": 1000,
            "interests": [],
        }
    return {
        "home_state": prof.home_state or "",
        "travel_style": prof.travel_style or "moderate",
        "pace": prof.pace or "normal",
        "default_budget": int(prof.default_budget or 1000),
        "interests": [i for i in (prof.interests or "").split(",") if i],
    }


def _serialize_user(user):
    if not user or not user.is_authenticated:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_admin": user.is_admin,
        "is_active_account": user.is_active_account,
        "created_at": user.created_at.strftime("%d %b %Y") if user.created_at else "",
        "profile": _serialize_profile(user.profile),
    }


def _serialize_asset(a):
    return {
        "id": a.id,
        "name": a.name,
        "asset_type": a.asset_type,
        "category": a.category,
        "tags": a.tags or "",
        "region": a.region,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "est_cost": a.est_cost,
        "visit_minutes": a.visit_minutes,
        "open_time": a.open_time,
        "close_time": a.close_time,
        "rating": a.rating,
        "description": a.description or "",
        "is_active": a.is_active,
    }


def _own_trip_or_403(trip_id):
    trip = db.session.get(TripRequest, trip_id)
    if not trip:
        return None, (jsonify({"error": "Trip not found."}), 404)
    if trip.user_id != current_user.id and not current_user.is_admin:
        return None, (jsonify({"error": "Forbidden."}), 403)
    return trip, None


# ---------------------------------------------------------------------- auth
@api_bp.route("/auth/me", methods=["GET"])
def api_me():
    return jsonify({"user": _serialize_user(current_user)})


@api_bp.route("/auth/register", methods=["POST"])
def api_register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    pw = data.get("password") or ""
    confirm = data.get("confirm") or ""

    if not name or not email or len(pw) < 6:
        return jsonify({"error": "Please fill in all fields. Password needs at least 6 characters."}), 400
    if pw != confirm:
        return jsonify({"error": "Passwords do not match."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "That email is already registered. Please log in."}), 400

    user = User(name=name, email=email)
    user.set_password(pw)
    user.profile = TravelProfile()
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify({
        "user": _serialize_user(user),
        "message": "Account created. Complete your travel profile to set default preferences.",
    }), 201


@api_bp.route("/auth/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    pw = data.get("password") or ""
    remember = bool(data.get("remember"))

    user = User.query.filter_by(email=email).first()
    if user and user.check_password(pw):
        if not user.is_active_account:
            return jsonify({"error": "This account has been deactivated by the admin."}), 403
        login_user(user, remember=remember)
        return jsonify({"user": _serialize_user(user)})
    return jsonify({"error": "Wrong email or password."}), 401


@api_bp.route("/auth/logout", methods=["POST"])
@login_required
def api_logout():
    logout_user()
    return jsonify({"message": "You have logged out."})


# -------------------------------------------------------------------- public
@api_bp.route("/home", methods=["GET"])
def api_home():
    regions = known_regions()
    counts = {r: TravelAsset.query.filter_by(region=r, asset_type="attraction").count() for r in regions}
    return jsonify({"regions": regions, "counts": counts})


# ----------------------------------------------------------------- traveller
@api_bp.route("/profile", methods=["GET", "POST"])
@login_required
def api_profile():
    prof = current_user.profile or TravelProfile(user_id=current_user.id)
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or current_user.name).strip()
        current_user.name = name or current_user.name
        prof.home_state = data.get("home_state", "")
        prof.travel_style = data.get("travel_style", "moderate")
        prof.pace = data.get("pace", "normal")
        prof.default_budget = float(data.get("default_budget") or 1000)
        interests = data.get("interests") or []
        if isinstance(interests, list):
            prof.interests = ",".join(interests)
        db.session.add(prof)
        db.session.commit()
        return jsonify({
            "user": _serialize_user(current_user),
            "profile": _serialize_profile(prof),
            "interests": INTERESTS,
            "message": "Profile saved.",
        })
    return jsonify({
        "user": _serialize_user(current_user),
        "profile": _serialize_profile(prof),
        "interests": INTERESTS,
    })


@api_bp.route("/trips", methods=["GET", "POST"])
@login_required
def api_trips():
    if request.method == "GET":
        trips = TripRequest.query.filter_by(user_id=current_user.id).order_by(TripRequest.created_at.desc()).all()
        result = []
        for t in trips:
            result.append({
                "id": t.id,
                "region": t.region,
                "days": t.days,
                "start_date": t.start_date.strftime("%d %b %Y"),
                "budget": t.budget,
                "travellers": t.travellers,
                "interests": [i for i in (t.interests or "").split(",") if i],
                "status": t.status,
                "has_itinerary": t.itinerary is not None,
                "total_cost": t.itinerary.total_cost if t.itinerary else None,
                "places_count": len(t.itinerary.segments) if t.itinerary else 0,
            })
        return jsonify({"trips": result})

    # POST: create a new trip and run NLP -> Fuzzy -> ALNS
    data = request.get_json(silent=True) or {}
    prof = current_user.profile
    regions = known_regions()
    try:
        form_data = {
            "region": data.get("region") or None,
            "days": int(data["days"]) if data.get("days") not in (None, "") else None,
            "budget": float(data["budget"]) if data.get("budget") not in (None, "") else None,
            "travellers": int(data["travellers"]) if data.get("travellers") not in (None, "") else None,
            "interests": data.get("interests") or [],
            "pace": data.get("pace") or None,
        }
        start = (datetime.strptime(data["start_date"], "%Y-%m-%d").date()
                 if data.get("start_date") else date.today() + timedelta(days=7))
    except (ValueError, TypeError):
        return jsonify({"error": "Please check the numbers and date you entered."}), 400

    prompt_text = data.get("prompt") or ""
    parsed = nlp.parse_request(form_data, prompt_text, regions)
    if not parsed["region"] or parsed["region"] not in regions:
        return jsonify({"error": "Please choose a destination region (or mention one in your request)."}), 400
    parsed["days"] = max(1, min(int(parsed["days"]), 7))

    trip = TripRequest(
        user_id=current_user.id,
        region=parsed["region"],
        start_date=start,
        days=parsed["days"],
        budget=parsed["budget"],
        travellers=parsed["travellers"],
        interests=",".join(parsed["interests"]),
        prompt=prompt_text,
        parsed_json=json.dumps(parsed),
    )
    db.session.add(trip)
    db.session.commit()
    try:
        generate_itinerary(trip, prof.travel_style if prof else "moderate",
                           current_app.config["ALNS_SETTINGS_FILE"])
    except Exception as e:
        db.session.rollback()
        trip.status = "failed"
        db.session.commit()
        return jsonify({"error": f"Could not create an itinerary: {e}", "trip_id": trip.id}), 422
    return jsonify({"trip_id": trip.id}), 201


@api_bp.route("/trip/meta", methods=["GET"])
@login_required
def api_trip_meta():
    return jsonify({
        "regions": known_regions(),
        "interests": INTERESTS,
        "profile": _serialize_profile(current_user.profile),
        "default_date": (date.today() + timedelta(days=7)).isoformat(),
    })


@api_bp.route("/parse", methods=["POST"])
@login_required
def api_parse():
    """Live NLP preview used by the trip form (shows what the AI understood)."""
    text = (request.get_json(silent=True) or {}).get("prompt", "")
    found = nlp.extract_entities(text, known_regions())
    found.pop("tokens", None)
    return jsonify(found)


@api_bp.route("/trips/<int:trip_id>", methods=["GET"])
@login_required
def api_trip_detail(trip_id):
    trip, err = _own_trip_or_403(trip_id)
    if err:
        return err
    it = trip.itinerary
    if not it:
        return jsonify({"error": "This trip has no itinerary yet. Try regenerating it."}), 404

    days = defaultdict(list)
    for s in it.segments:
        days[s.day_no].append({
            "id": s.id,
            "day_no": s.day_no,
            "order_no": s.order_no,
            "arrive_time": s.arrive_time,
            "depart_time": s.depart_time,
            "travel_km": s.travel_km,
            "cost": s.cost,
            "suitability": s.suitability,
            "asset": {
                "id": s.asset.id,
                "name": s.asset.name,
                "category": s.asset.category,
                "description": s.asset.description,
                "open_time": s.asset.open_time,
                "close_time": s.asset.close_time,
                "latitude": s.asset.latitude,
                "longitude": s.asset.longitude,
            },
        })

    by_cat, by_day = defaultdict(float), defaultdict(float)
    for e in it.expenses:
        by_cat[e.category] += e.amount
        if e.day_no:
            by_day[e.day_no] += e.amount

    map_data = {
        "hotel": ({"name": it.accommodation.name, "lat": it.accommodation.latitude,
                   "lng": it.accommodation.longitude} if it.accommodation else None),
        "days": [
            [{"name": s["asset"]["name"], "lat": s["asset"]["latitude"], "lng": s["asset"]["longitude"],
              "time": f"{s['arrive_time']}-{s['depart_time']}"} for s in days[d]]
            for d in range(1, trip.days + 1)
        ],
    }
    dates = [trip.start_date + timedelta(days=d) for d in range(trip.days)]
    parsed = json.loads(trip.parsed_json or "{}")
    expenses = sorted(it.expenses, key=lambda e: e.day_no)

    return jsonify({
        "trip": {
            "id": trip.id,
            "region": trip.region,
            "days": trip.days,
            "budget": trip.budget,
            "travellers": trip.travellers,
            "status": trip.status,
            "date_range": f"{dates[0].strftime('%d %b')} – {dates[-1].strftime('%d %b %Y')}",
            "day_dates": [d.strftime("%A, %d %b") for d in dates],
        },
        "itinerary": {
            "id": it.id,
            "title": it.title,
            "total_cost": it.total_cost,
            "total_distance_km": it.total_distance_km,
            "summary_text": it.summary_text,
            "places_count": len(it.segments),
            "accommodation": ({"name": it.accommodation.name} if it.accommodation else None),
            "days": {str(d): days[d] for d in range(1, trip.days + 1)},
            "expenses": [
                {"id": e.id, "day_no": e.day_no, "category": e.category,
                 "description": e.description, "amount": e.amount}
                for e in expenses
            ],
            "metrics": ({
                "iterations": it.metrics.iterations,
                "runtime_ms": it.metrics.runtime_ms,
                "candidates": it.metrics.candidates,
                "initial_objective": it.metrics.initial_objective,
                "best_objective": it.metrics.best_objective,
                "improvement_pct": it.metrics.improvement_pct,
            } if it.metrics else None),
        },
        "by_cat": dict(by_cat),
        "by_day": [round(by_day[d], 2) for d in range(1, trip.days + 1)],
        "map_data": map_data,
        "parsed": parsed,
    })


@api_bp.route("/trips/<int:trip_id>/regenerate", methods=["POST"])
@login_required
def api_regenerate(trip_id):
    trip, err = _own_trip_or_403(trip_id)
    if err:
        return err
    if trip.itinerary:
        db.session.delete(trip.itinerary)
        db.session.commit()
    prof = current_user.profile
    try:
        generate_itinerary(trip, prof.travel_style if prof else "moderate",
                           current_app.config["ALNS_SETTINGS_FILE"])
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Could not create an itinerary: {e}"}), 422
    return jsonify({"trip_id": trip.id, "message": "A new itinerary was generated."})


@api_bp.route("/trips/<int:trip_id>/delete", methods=["POST"])
@login_required
def api_delete_trip(trip_id):
    trip, err = _own_trip_or_403(trip_id)
    if err:
        return err
    db.session.delete(trip)
    db.session.commit()
    return jsonify({"message": "Trip deleted."})


@api_bp.route("/trips/<int:trip_id>/pdf", methods=["GET"])
@login_required
def api_trip_pdf(trip_id):
    trip, err = _own_trip_or_403(trip_id)
    if err:
        return err
    if not trip.itinerary:
        return jsonify({"error": "Itinerary not found."}), 404
    data = itinerary_pdf(trip, trip.itinerary)
    return Response(data, mimetype="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=PackMY_trip_{trip.id}.pdf"})


# --------------------------------------------------------------------- admin
@api_bp.route("/admin/dashboard", methods=["GET"])
@api_admin_required
def api_admin_dashboard():
    stats = {
        "users": User.query.filter_by(role="traveller").count(),
        "assets": TravelAsset.query.count(),
        "trips": TripRequest.query.count(),
        "itineraries": Itinerary.query.count(),
        "avg_runtime": float(db.session.query(func.avg(AlgorithmMetrics.runtime_ms)).scalar() or 0),
        "avg_improve": float(db.session.query(func.avg(AlgorithmMetrics.improvement_pct)).scalar() or 0),
        "avg_cost": float(db.session.query(func.avg(Itinerary.total_cost)).scalar() or 0),
    }
    by_region = dict(db.session.query(TripRequest.region, func.count(TripRequest.id))
                     .group_by(TripRequest.region).all())
    interest_count = {k: 0 for k in INTERESTS}
    for (ints,) in db.session.query(TripRequest.interests).all():
        for i in (ints or "").split(","):
            if i in interest_count:
                interest_count[i] += 1
    recent_metrics = AlgorithmMetrics.query.order_by(AlgorithmMetrics.created_at.desc()).limit(10).all()
    latest = recent_metrics[0] if recent_metrics else None
    latest_hist = json.loads(latest.operator_stats).get("history", []) if latest else []
    latest_weights = json.loads(latest.operator_stats).get("weights", {}) if latest else {}
    recent_trips = TripRequest.query.order_by(TripRequest.created_at.desc()).limit(8).all()

    return jsonify({
        "stats": stats,
        "by_region": by_region,
        "interest_count": interest_count,
        "latest_hist": latest_hist,
        "latest_weights": latest_weights,
        "recent_trips": [
            {
                "id": t.id,
                "user_name": t.user.name,
                "region": t.region,
                "days": t.days,
                "budget": t.budget,
                "status": t.status,
                "has_itinerary": t.itinerary is not None,
            }
            for t in recent_trips
        ],
        "recent_metrics": [
            {
                "id": m.id,
                "iterations": m.iterations,
                "candidates": m.candidates,
                "runtime_ms": m.runtime_ms,
                "initial_objective": m.initial_objective,
                "best_objective": m.best_objective,
                "improvement_pct": m.improvement_pct,
            }
            for m in recent_metrics
        ],
    })


@api_bp.route("/admin/assets", methods=["GET", "POST"])
@api_admin_required
def api_admin_assets():
    if request.method == "GET":
        region = request.args.get("region", "")
        q = TravelAsset.query
        if region:
            q = q.filter_by(region=region)
        items = q.order_by(TravelAsset.region, TravelAsset.asset_type, TravelAsset.name).all()
        return jsonify({
            "items": [_serialize_asset(a) for a in items],
            "regions": known_regions(),
            "categories": INTERESTS + ["hotel"],
        })

    data = request.get_json(silent=True) or {}
    a = TravelAsset(is_active=True)
    try:
        _fill_asset_json(a, data)
        if not a.name or not a.region:
            raise ValueError("Name and region are required.")
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Please check the form: {e}"}), 400
    db.session.add(a)
    db.session.commit()
    return jsonify({"asset": _serialize_asset(a), "message": f"Saved '{a.name}'."}), 201


def _fill_asset_json(a, data):
    a.name = (data.get("name") or "").strip()
    a.asset_type = data.get("asset_type") or "attraction"
    a.category = data.get("category") or "culture"
    a.tags = (data.get("tags") or "").lower()
    a.region = ((data.get("new_region") or data.get("region") or "")).strip()
    a.latitude = float(data["latitude"])
    a.longitude = float(data["longitude"])
    a.est_cost = float(data.get("est_cost") or 0)
    a.visit_minutes = int(data.get("visit_minutes") or 60)
    a.open_time = data.get("open_time") or "09:00"
    a.close_time = data.get("close_time") or "18:00"
    a.rating = float(data.get("rating") or 4)
    a.description = data.get("description") or ""
    a.is_active = bool(data.get("is_active", True))


@api_bp.route("/admin/assets/<int:asset_id>", methods=["GET", "PUT"])
@api_admin_required
def api_admin_asset_detail(asset_id):
    a = db.session.get(TravelAsset, asset_id)
    if not a:
        return jsonify({"error": "Travel asset not found."}), 404
    if request.method == "PUT":
        data = request.get_json(silent=True) or {}
        try:
            _fill_asset_json(a, data)
            if not a.name or not a.region:
                raise ValueError("Name and region are required.")
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Please check the form: {e}"}), 400
        db.session.commit()
        return jsonify({"asset": _serialize_asset(a), "message": f"Saved '{a.name}'."})
    return jsonify({
        "asset": _serialize_asset(a),
        "regions": known_regions(),
        "categories": INTERESTS + ["hotel"],
    })


@api_bp.route("/admin/assets/<int:asset_id>/delete", methods=["POST"])
@api_admin_required
def api_admin_asset_delete(asset_id):
    a = db.session.get(TravelAsset, asset_id)
    if not a:
        return jsonify({"error": "Travel asset not found."}), 404
    if ItinerarySegment.query.filter_by(asset_id=a.id).first() or Itinerary.query.filter_by(accommodation_id=a.id).first():
        a.is_active = False
        msg = f"'{a.name}' is used in saved trips, so it was hidden instead of deleted."
    else:
        db.session.delete(a)
        msg = f"Deleted '{a.name}'."
    db.session.commit()
    return jsonify({"message": msg})


@api_bp.route("/admin/users", methods=["GET"])
@api_admin_required
def api_admin_users():
    rows = (db.session.query(User, func.count(TripRequest.id))
            .outerjoin(TripRequest)
            .group_by(User.id)
            .order_by(User.created_at.desc())
            .all())
    return jsonify({
        "current_user_id": current_user.id,
        "rows": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "is_admin": u.is_admin,
                "is_active_account": u.is_active_account,
                "created_at": u.created_at.strftime("%d %b %Y") if u.created_at else "",
                "trip_count": n,
            }
            for u, n in rows
        ],
    })


@api_bp.route("/admin/users/<int:user_id>/toggle", methods=["POST"])
@api_admin_required
def api_admin_user_toggle(user_id):
    u = db.session.get(User, user_id)
    if not u:
        return jsonify({"error": "User not found."}), 404
    if u.id == current_user.id:
        return jsonify({"error": "You cannot deactivate your own account."}), 400
    u.is_active_account = not u.is_active_account
    db.session.commit()
    msg = f"{u.name} is now {'active' if u.is_active_account else 'deactivated'}."
    return jsonify({"is_active_account": u.is_active_account, "message": msg})


@api_bp.route("/admin/settings", methods=["GET", "POST"])
@api_admin_required
def api_admin_settings():
    path = current_app.config["ALNS_SETTINGS_FILE"]
    params = load_alns_settings(path)
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        if data.get("reset"):
            params = dict(DEFAULT_PARAMS)
        else:
            try:
                params.update({
                    "iterations": max(10, min(int(data["iterations"]), 3000)),
                    "destroy_min": float(data["destroy_min"]),
                    "destroy_max": float(data["destroy_max"]),
                    "start_temperature_pct": float(data["start_temperature_pct"]),
                    "cooling_rate": float(data["cooling_rate"]),
                    "reaction_factor": float(data["reaction_factor"]),
                    "distance_weight": float(data["distance_weight"]),
                })
                if not 0 < params["destroy_min"] <= params["destroy_max"] <= 1:
                    raise ValueError("destroy min/max must be between 0 and 1, min <= max")
            except (ValueError, KeyError, TypeError) as e:
                return jsonify({"error": f"Invalid value: {e}"}), 400
        save_alns_settings(path, params)
        return jsonify({"params": params, "message": "ALNS parameters saved. New itineraries will use them."})
    return jsonify({"params": params})
