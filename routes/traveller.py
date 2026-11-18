"""Traveller pages: home, dashboard, profile, trip request, itinerary view, PDF."""
import json
from collections import defaultdict
from datetime import date, datetime, timedelta

from flask import (Blueprint, Response, abort, current_app, flash, jsonify, redirect,
                   render_template, request, url_for)
from flask_login import current_user, login_required

from ai import nlp
from ai.pipeline import generate_itinerary, known_regions
from models import TravelAsset, TravelProfile, TripRequest, db
from utils.pdf import itinerary_pdf

traveller_bp = Blueprint("traveller", __name__)
INTERESTS = list(nlp.INTEREST_KEYWORDS.keys())


def _own_trip(trip_id):
    trip = db.get_or_404(TripRequest, trip_id)
    if trip.user_id != current_user.id and not current_user.is_admin:
        abort(403)
    return trip


@traveller_bp.route("/")
def home():
    regions = known_regions()
    counts = {r: TravelAsset.query.filter_by(region=r, asset_type="attraction").count() for r in regions}
    return render_template("home.html", regions=regions, counts=counts)


@traveller_bp.route("/dashboard")
@login_required
def dashboard():
    trips = TripRequest.query.filter_by(user_id=current_user.id).order_by(TripRequest.created_at.desc()).all()
    return render_template("traveller/dashboard.html", trips=trips)


@traveller_bp.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    prof = current_user.profile or TravelProfile(user_id=current_user.id)
    if request.method == "POST":
        current_user.name = request.form.get("name", current_user.name).strip() or current_user.name
        prof.home_state = request.form.get("home_state", "")
        prof.travel_style = request.form.get("travel_style", "moderate")
        prof.pace = request.form.get("pace", "normal")
        prof.default_budget = float(request.form.get("default_budget") or 1000)
        prof.interests = ",".join(request.form.getlist("interests"))
        db.session.add(prof)
        db.session.commit()
        flash("Profile saved.", "success")
        return redirect(url_for("traveller.dashboard"))
    return render_template("traveller/profile.html", prof=prof, interests=INTERESTS)


@traveller_bp.route("/api/parse", methods=["POST"])
@login_required
def api_parse():
    """Live NLP preview used by the trip form (shows what the AI understood)."""
    text = (request.get_json(silent=True) or {}).get("prompt", "")
    found = nlp.extract_entities(text, known_regions())
    found.pop("tokens", None)
    return jsonify(found)


@traveller_bp.route("/trip/new", methods=["GET", "POST"])
@login_required
def new_trip():
    prof = current_user.profile
    regions = known_regions()
    if request.method == "POST":
        f = request.form
        try:
            form_data = {
                "region": f.get("region") or None,
                "days": int(f["days"]) if f.get("days") else None,
                "budget": float(f["budget"]) if f.get("budget") else None,
                "travellers": int(f["travellers"]) if f.get("travellers") else None,
                "interests": f.getlist("interests"),
                "pace": f.get("pace") or None,
            }
            start = datetime.strptime(f.get("start_date"), "%Y-%m-%d").date() if f.get("start_date") else date.today() + timedelta(days=7)
        except ValueError:
            flash("Please check the numbers and date you entered.", "error")
            return redirect(url_for("traveller.new_trip"))

        parsed = nlp.parse_request(form_data, f.get("prompt", ""), regions)
        if not parsed["region"] or parsed["region"] not in regions:
            flash("Please choose a destination region (or mention one in your request).", "error")
            return redirect(url_for("traveller.new_trip"))
        parsed["days"] = max(1, min(int(parsed["days"]), 7))

        trip = TripRequest(user_id=current_user.id, region=parsed["region"], start_date=start,
                           days=parsed["days"], budget=parsed["budget"], travellers=parsed["travellers"],
                           interests=",".join(parsed["interests"]), prompt=f.get("prompt", ""),
                           parsed_json=json.dumps(parsed))
        db.session.add(trip)
        db.session.commit()
        try:
            generate_itinerary(trip, prof.travel_style if prof else "moderate",
                               current_app.config["ALNS_SETTINGS_FILE"])
        except Exception as e:  # show a friendly message instead of a crash page
            db.session.rollback()
            trip.status = "failed"
            db.session.commit()
            flash(f"Could not create an itinerary: {e}", "error")
            return redirect(url_for("traveller.dashboard"))
        return redirect(url_for("traveller.view_trip", trip_id=trip.id))
    return render_template("traveller/new_trip.html", prof=prof, regions=regions,
                           interests=INTERESTS, default_date=(date.today() + timedelta(days=7)).isoformat())


@traveller_bp.route("/trip/<int:trip_id>")
@login_required
def view_trip(trip_id):
    trip = _own_trip(trip_id)
    it = trip.itinerary
    if not it:
        flash("This trip has no itinerary yet. Try regenerating it.", "info")
        return redirect(url_for("traveller.dashboard"))

    days = defaultdict(list)
    for s in it.segments:
        days[s.day_no].append(s)
    by_cat, by_day = defaultdict(float), defaultdict(float)
    for e in it.expenses:
        by_cat[e.category] += e.amount
        if e.day_no:
            by_day[e.day_no] += e.amount
    map_data = {
        "hotel": ({"name": it.accommodation.name, "lat": it.accommodation.latitude,
                   "lng": it.accommodation.longitude} if it.accommodation else None),
        "days": [[{"name": s.asset.name, "lat": s.asset.latitude, "lng": s.asset.longitude,
                   "time": f"{s.arrive_time}-{s.depart_time}"} for s in days[d]]
                 for d in range(1, trip.days + 1)],
    }
    parsed = json.loads(trip.parsed_json or "{}")
    return render_template("traveller/itinerary.html", trip=trip, it=it, days=days,
                           by_cat=dict(by_cat), by_day=[round(by_day[d], 2) for d in range(1, trip.days + 1)],
                           map_data=map_data, parsed=parsed,
                           dates=[trip.start_date + timedelta(days=d) for d in range(trip.days)])


@traveller_bp.route("/trip/<int:trip_id>/regenerate", methods=["POST"])
@login_required
def regenerate(trip_id):
    trip = _own_trip(trip_id)
    if trip.itinerary:
        db.session.delete(trip.itinerary)
        db.session.commit()
    prof = current_user.profile
    try:
        generate_itinerary(trip, prof.travel_style if prof else "moderate", current_app.config["ALNS_SETTINGS_FILE"])
        flash("A new itinerary was generated.", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Could not create an itinerary: {e}", "error")
        return redirect(url_for("traveller.dashboard"))
    return redirect(url_for("traveller.view_trip", trip_id=trip.id))


@traveller_bp.route("/trip/<int:trip_id>/delete", methods=["POST"])
@login_required
def delete_trip(trip_id):
    db.session.delete(_own_trip(trip_id))
    db.session.commit()
    flash("Trip deleted.", "info")
    return redirect(url_for("traveller.dashboard"))


@traveller_bp.route("/trip/<int:trip_id>/pdf")
@login_required
def trip_pdf(trip_id):
    trip = _own_trip(trip_id)
    if not trip.itinerary:
        abort(404)
    data = itinerary_pdf(trip, trip.itinerary)
    return Response(data, mimetype="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=PackMY_trip_{trip.id}.pdf"})
