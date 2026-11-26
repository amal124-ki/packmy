"""
MODULE 4 - Itinerary & Response Generation (and the glue for the whole AI pipeline)
==================================================================================
    Trip_Request --> NLP (Module 1) --> Fuzzy ranking (Module 2) --> ALNS (Module 3)
                 --> times, costs, expenses, summary, metrics saved to the database (Module 4)
"""
import json
import math
import os

from models import (AlgorithmMetrics, ExpenseLog, Itinerary, ItinerarySegment,
                    TravelAsset, db)
from . import fuzzy, nlp
from .alns import ALNS, DEFAULT_PARAMS, PACE_SETTINGS, ROAD_FACTOR, to_hhmm

FOOD_PER_PERSON_PER_DAY = {"budget": 40, "moderate": 75, "luxury": 150}  # RM
TRANSPORT_RATE_PER_KM = 0.8  # RM per km (e-hailing / fuel + parking estimate, per group)
HOTEL_SHARE_OF_BUDGET = 0.45  # try to keep the hotel under 45% of the budget


# ----------------------------------------------------------- admin settings
def load_alns_settings(path):
    params = dict(DEFAULT_PARAMS)
    if path and os.path.exists(path):
        with open(path) as f:
            params.update(json.load(f))
    return params


def save_alns_settings(path, params):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(params, f, indent=2)


def known_regions():
    return sorted({r for (r,) in db.session.query(TravelAsset.region).distinct()})


# ------------------------------------------------------------ main pipeline
def choose_hotel(hotels, budget, nights, rooms):
    if not hotels or nights == 0:
        return None, 0.0
    affordable = [h for h in hotels if h.est_cost * nights * rooms <= budget * HOTEL_SHARE_OF_BUDGET]
    pick = max(affordable, key=lambda h: (h.rating, -h.est_cost)) if affordable \
        else min(hotels, key=lambda h: h.est_cost)
    return pick, pick.est_cost * nights * rooms


def generate_itinerary(trip, travel_style="moderate", settings_path=None):
    parsed = json.loads(trip.parsed_json or "{}")
    region, days, budget = trip.region, trip.days, trip.budget
    travellers = max(1, trip.travellers or 1)
    interests = parsed.get("interests") or (trip.interests or "").split(",")
    pace = parsed.get("pace", "normal")
    max_stops = PACE_SETTINGS.get(pace, PACE_SETTINGS["normal"])[2]

    assets = TravelAsset.query.filter_by(region=region, is_active=True).all()
    attractions = [a for a in assets if a.asset_type == "attraction"]
    hotels = [a for a in assets if a.asset_type == "accommodation"]
    if not attractions:
        raise ValueError(f"No attractions found for {region}. Ask the admin to add some.")

    # Fixed costs first: hotel + food
    nights = max(days - 1, 0)
    rooms = math.ceil(travellers / 2)
    hotel, hotel_cost = choose_hotel(hotels, budget, nights, rooms)
    food_cost = FOOD_PER_PERSON_PER_DAY.get(travel_style, 75) * travellers * days
    if hotel_cost + food_cost > budget and travel_style != "budget":
        travel_style = "budget"  # try cheaper meals before giving up
        food_cost = FOOD_PER_PERSON_PER_DAY["budget"] * travellers * days
    if hotel_cost + food_cost > budget:
        raise ValueError(f"A budget of RM{budget:,.0f} is too low for {days} day(s) and {travellers} "
                         f"traveller(s) in {region}. Hotel and meals alone need about "
                         f"RM{hotel_cost + food_cost:,.0f}. Please increase the budget or shorten the trip.")
    budget_left = budget - hotel_cost - food_cost

    # Base point = hotel, or the centre of all attractions in the region
    if hotel:
        base = (hotel.latitude, hotel.longitude)
    else:
        base = (sum(a.latitude for a in attractions) / len(attractions),
                sum(a.longitude for a in attractions) / len(attractions))

    # Module 2: fuzzy ranking
    allowance = budget_left / travellers / max(days * 3, 1)  # rough RM per stop per person
    ranked = fuzzy.rank_attractions(attractions, interests, allowance, *base,
                                    top_n=min(30, days * max_stops * 2 + 6), min_keep=days * 2)

    # Module 3: ALNS optimisation
    params = load_alns_settings(settings_path)
    result = ALNS(ranked, base, days, pace, budget_left, travellers, TRANSPORT_RATE_PER_KM, params).run()
    if not any(result["solution"]):
        raise ValueError(f"After the hotel and meals (about RM{hotel_cost + food_cost:,.0f}) there is only "
                         f"RM{budget_left:,.0f} left, which is not enough to travel to any attraction. "
                         f"Please increase the budget or shorten the trip.")

    # Module 4: build the itinerary rows
    it = Itinerary(trip=trip, title=f"{days}-Day {region} Trip", accommodation=hotel,
                   total_distance_km=round(result["total_km"], 1))
    db.session.add(it)

    plan_days = []
    for day_no, (route, sched) in enumerate(zip(result["solution"], result["schedule"]), start=1):
        day_items = []
        for order, s in enumerate(sched, start=1):
            cand = ranked[s["idx"]]
            a = cand["asset"]
            seg_cost = a.est_cost * travellers
            it.segments.append(ItinerarySegment(
                asset=a, day_no=day_no, order_no=order, arrive_time=to_hhmm(s["arrive"]),
                depart_time=to_hhmm(s["depart"]), travel_km=round(s["km"], 1),
                cost=seg_cost, suitability=cand["score"]))
            if seg_cost > 0:
                it.expenses.append(ExpenseLog(day_no=day_no, category="Attractions",
                                              description=f"{a.name} entry x{travellers}", amount=seg_cost))
            day_items.append({"asset": a, "score": cand["score"]})
        plan_days.append(day_items)

    # Transport per day (uses the ALNS distance including return to hotel)
    solver_km = [_route_km(ranked, route, base) for route in result["solution"]]
    for day_no, km in enumerate(solver_km, start=1):
        if km > 0:
            it.expenses.append(ExpenseLog(day_no=day_no, category="Transport",
                                          description=f"Driving / e-hailing approx. {km:.0f} km",
                                          amount=round(km * TRANSPORT_RATE_PER_KM, 2)))
    for day_no in range(1, days + 1):
        it.expenses.append(ExpenseLog(day_no=day_no, category="Food",
                                      description=f"Meals for {travellers} ({travel_style})",
                                      amount=FOOD_PER_PERSON_PER_DAY.get(travel_style, 75) * travellers))
    if hotel:
        it.expenses.append(ExpenseLog(day_no=0, category="Accommodation",
                                      description=f"{hotel.name}: {nights} night(s) x {rooms} room(s)",
                                      amount=hotel_cost))

    it.total_cost = round(sum(e.amount for e in it.expenses), 2)
    it.summary_text = nlp.generate_summary({**parsed, "region": region, "days": days,
                                            "travellers": travellers, "interests": interests},
                                           plan_days, hotel, it.total_cost, budget, result["total_km"])
    it.metrics = AlgorithmMetrics(
        algorithm="ALNS", iterations=result["iterations"], runtime_ms=round(result["runtime_ms"], 1),
        candidates=len(ranked), initial_objective=round(result["initial_objective"], 2),
        best_objective=round(result["objective"], 2), improvement_pct=round(result["improvement_pct"], 2),
        operator_stats=json.dumps({"wins": result["operator_wins"], "weights": result["operator_weights"],
                                   "history": result["history"]}))
    trip.status = "done"
    db.session.commit()
    return it


def _route_km(ranked, route, base):
    if not route:
        return 0.0
    pts = [base] + [(ranked[i]["asset"].latitude, ranked[i]["asset"].longitude) for i in route] + [base]
    return sum(fuzzy.haversine_km(*a, *b) * ROAD_FACTOR for a, b in zip(pts, pts[1:]))
