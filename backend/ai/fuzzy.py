"""
MODULE 2 - Fuzzy Logic Destination Suitability Evaluation and Ranking
=====================================================================
Uses scikit-fuzzy with Mamdani inference and centroid defuzzification
(as described in Chapter 2.2.2 of the report).

Inputs (crisp values are calculated in compute_inputs()):
    budget    - cost ratio = attraction cost / per-stop budget allowance (0 .. 2)
                Cheap, Moderate, Expensive
    interest  - how well the attraction matches the user's interests (0 .. 1)
                Low, Medium, High
    distance  - km from the trip base (hotel or region centre) (0 .. 60)
                Near, Moderate, Far
Output:
    suitability - 0 .. 1 (higher = more suitable)
"""
import math

import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

_SIM = None  # built once, reused for every attraction


def _build_system():
    budget = ctrl.Antecedent(np.arange(0, 2.01, 0.01), "budget")
    interest = ctrl.Antecedent(np.arange(0, 1.001, 0.01), "interest")
    distance = ctrl.Antecedent(np.arange(0, 60.1, 0.5), "distance")
    suit = ctrl.Consequent(np.arange(0, 1.001, 0.01), "suitability", defuzzify_method="centroid")

    # --- membership functions ---
    budget["cheap"] = fuzz.trapmf(budget.universe, [0, 0, 0.3, 0.7])
    budget["moderate"] = fuzz.trimf(budget.universe, [0.4, 0.9, 1.4])
    budget["expensive"] = fuzz.trapmf(budget.universe, [1.1, 1.5, 2, 2])

    interest["low"] = fuzz.trapmf(interest.universe, [0, 0, 0.2, 0.4])
    interest["medium"] = fuzz.trimf(interest.universe, [0.25, 0.5, 0.75])
    interest["high"] = fuzz.trapmf(interest.universe, [0.6, 0.8, 1, 1])

    distance["near"] = fuzz.trapmf(distance.universe, [0, 0, 5, 12])
    distance["moderate"] = fuzz.trimf(distance.universe, [8, 18, 30])
    distance["far"] = fuzz.trapmf(distance.universe, [24, 35, 60, 60])

    suit["very_low"] = fuzz.trimf(suit.universe, [0, 0, 0.2])
    suit["low"] = fuzz.trimf(suit.universe, [0.1, 0.3, 0.5])
    suit["medium"] = fuzz.trimf(suit.universe, [0.35, 0.55, 0.75])
    suit["high"] = fuzz.trimf(suit.universe, [0.6, 0.78, 0.92])
    suit["very_high"] = fuzz.trimf(suit.universe, [0.82, 1, 1])

    b, i, d, s = budget, interest, distance, suit
    rules = [
        ctrl.Rule(i["high"] & b["cheap"] & d["near"], s["very_high"]),
        ctrl.Rule(i["high"] & b["moderate"] & d["near"], s["high"]),
        ctrl.Rule(i["high"] & (b["cheap"] | b["moderate"]) & d["moderate"], s["high"]),
        ctrl.Rule(i["high"] & d["far"], s["medium"]),
        ctrl.Rule(i["high"] & b["expensive"], s["medium"]),
        ctrl.Rule(i["medium"] & b["cheap"] & d["near"], s["high"]),
        ctrl.Rule(i["medium"] & (b["moderate"] | d["moderate"]), s["medium"]),
        ctrl.Rule(i["medium"] & (b["expensive"] | d["far"]), s["low"]),
        ctrl.Rule(i["low"] & b["cheap"] & d["near"], s["low"]),
        ctrl.Rule(i["low"] & (b["moderate"] | b["expensive"] | d["moderate"] | d["far"]), s["very_low"]),
        ctrl.Rule(b["expensive"] & d["far"], s["very_low"]),
    ]
    return ctrl.ControlSystemSimulation(ctrl.ControlSystem(rules))


def haversine_km(lat1, lon1, lat2, lon2):
    """Straight-line distance between two GPS points in km."""
    r = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def interest_match(asset, interests):
    """0..1 - main category match counts most, extra tag matches add on top."""
    interests = {x.lower() for x in interests}
    if not interests:
        return 0.5
    score = 0.0
    if (asset.category or "").lower() in interests:
        score += 0.7
    tag_hits = len(asset.tag_list() & interests - {(asset.category or "").lower()})
    score += 0.45 * tag_hits
    return min(score, 1.0)


def compute_inputs(asset, interests, allowance, base_lat, base_lon):
    cost_ratio = 0 if allowance <= 0 else asset.est_cost / allowance
    return {
        "budget": float(min(max(cost_ratio, 0), 2)),
        "interest": float(interest_match(asset, interests)),
        "distance": float(min(haversine_km(base_lat, base_lon, asset.latitude, asset.longitude), 60)),
    }


def suitability(inputs):
    """Run Mamdani inference + centroid defuzzification for one attraction."""
    global _SIM
    if _SIM is None:
        _SIM = _build_system()
    for k, v in inputs.items():
        _SIM.input[k] = v
    try:
        _SIM.compute()
        return float(_SIM.output["suitability"])
    except (ValueError, KeyError):  # no rule fired (should not happen with these rules)
        return 0.0


def rank_attractions(assets, interests, allowance, base_lat, base_lon, top_n=25, min_score=0.2, min_keep=6):
    """Step 4 - score every attraction, sort, and keep the best ones for the optimiser.
    Places scoring below min_score are filtered out (unless we would have fewer than min_keep)."""
    ranked = []
    for a in assets:
        inp = compute_inputs(a, interests, allowance, base_lat, base_lon)
        ranked.append({"asset": a, "score": round(suitability(inp), 4), "inputs": inp})
    ranked.sort(key=lambda r: (r["score"], r["asset"].rating), reverse=True)
    good = [r for r in ranked if r["score"] >= min_score]
    if len(good) < min_keep:
        good = ranked[:min_keep]
    return good[:top_n]
