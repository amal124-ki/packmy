"""
ALNS Evaluation & Benchmark Script (for Workshop 2 Chapter 5 Testing)
=====================================================================
Compares the Greedy initial solution against ALNS (100, 400, 800 iterations)
across all 5 Malaysian regions using the sample data in seed.py.

Run:
    python benchmark_alns.py
"""
from types import SimpleNamespace

from ai import fuzzy
from ai.alns import ALNS, PACE_SETTINGS
from ai.pipeline import TRANSPORT_RATE_PER_KM
from seed import ATTRACTIONS, HOTELS


def _make_asset(name, cat, tags, lat, lon, cost, mins, op, cl, rating, desc, region):
    obj = SimpleNamespace(
        name=name, category=cat, tags=tags, region=region,
        latitude=lat, longitude=lon, est_cost=cost, visit_minutes=mins,
        open_time=op, close_time=cl, rating=rating, description=desc,
    )
    obj.tag_list = lambda: {w.strip().lower() for w in ([cat] + tags.split(",")) if w.strip()}
    return obj


TEST_CASES = [
    ("Kuala Lumpur", 3, 1800, 2, ["culture", "food", "nature"], "normal"),
    ("Penang", 3, 1500, 2, ["food", "history", "nature"], "normal"),
    ("Melaka", 2, 1000, 2, ["history", "culture", "food"], "normal"),
    ("Langkawi", 3, 2200, 2, ["beach", "nature", "adventure"], "normal"),
    ("Kota Kinabalu", 3, 2000, 2, ["nature", "beach", "culture"], "normal"),
]


def run_benchmark():
    print("\n=== PackMY ALNS Benchmark (Greedy Baseline vs ALNS) ===\n")
    header = (f"{'Region':<15} | {'Iter':>4} | {'Init Obj':>8} | {'Best Obj':>8} | "
              f"{'Impr %':>7} | {'Init km':>7} | {'Best km':>7} | {'Stops':>5} | {'Time ms':>7}")
    print(header)
    print("-" * len(header))

    for region, days, budget, travellers, interests, pace in TEST_CASES:
        attractions = [_make_asset(*row, region) for row in ATTRACTIONS[region]]
        hotel = HOTELS[region][1]  # mid-range hotel as base
        base = (hotel[1], hotel[2])
        budget_left = budget - hotel[3] * (days - 1) - 75 * travellers * days
        max_stops = PACE_SETTINGS[pace][2]
        allowance = budget_left / travellers / max(days * 3, 1)

        ranked = fuzzy.rank_attractions(
            attractions, interests, allowance, *base,
            top_n=min(30, days * max_stops * 2 + 6), min_keep=days * 2,
        )

        for iters in (100, 400, 800):
            solver = ALNS(
                ranked, base, days, pace, budget_left, travellers,
                TRANSPORT_RATE_PER_KM, params={"iterations": iters, "seed": 42},
            )
            init_sol = solver.initial_solution()
            _, init_km = solver.cost(init_sol)
            res = solver.run()
            stops = sum(len(d) for d in res["solution"])
            print(
                f"{region:<15} | {iters:>4} | {res['initial_objective']:>8.1f} | "
                f"{res['objective']:>8.1f} | {res['improvement_pct']:>6.1f}% | "
                f"{init_km:>7.1f} | {res['total_km']:>7.1f} | {stops:>5} | {res['runtime_ms']:>7.1f}"
            )
        print("-" * len(header))


if __name__ == "__main__":
    run_benchmark()
