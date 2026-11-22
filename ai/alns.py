"""
MODULE 3 - ALNS-Based Itinerary Planning and Optimisation
=========================================================
Adaptive Large Neighbourhood Search (Ropke & Pisinger, 2006), as in Chapter 4.

Workflow (same as the report):
    1. Initial solution  - simple method: add attractions in fuzzy-rank order to the
                           first day that still has room (end of the route).
    2. Destroy phase     - remove some stops (random / worst / related / whole day).
    3. Repair phase      - insert stops back (greedy / regret-2 / random-order greedy).
    4. Local search      - 2-opt intra-day route polish to eliminate backtracking.
    5. Constraint check  - opening hours, daily time window, budget, no duplicates.
    + Adaptive weights   - operators that find better itineraries get picked more often.
    + Simulated annealing acceptance - sometimes accept a worse itinerary to escape local optima.

Objective (maximise):
    100 x (sum of fuzzy suitability of visited places)  -  distance_weight x (total km)
    - 40 x (number of empty days)  -  12 x (repeated categories within the same day)

A solution is a list of days; each day is a list of candidate indexes (visit order).
Every day starts and ends at the base (the hotel).
"""
import math
import random
import time

from .fuzzy import haversine_km

ROAD_FACTOR = 1.3  # roads are longer than a straight line
AVG_SPEED_KMH = 35  # average driving speed in Malaysian towns
STOP_BUFFER_MIN = 10  # parking / walking buffer per move
LUNCH_MIN = 60
EMPTY_DAY_PENALTY = 40  # encourages spreading places across all trip days
REPEAT_CATEGORY_PENALTY = 12  # encourages varied categories within each day

DEFAULT_PARAMS = {
    "iterations": 400,
    "destroy_min": 0.15,  # remove 15% .. 40% of the stops each iteration
    "destroy_max": 0.40,
    "start_temperature_pct": 0.05,  # a 5% worse solution is accepted with 50% chance at the start
    "cooling_rate": 0.995,
    "reaction_factor": 0.2,  # how quickly operator weights adapt
    "distance_weight": 1.0,
    "seed": None,
}

PACE_SETTINGS = {  # day start, day end (minutes after midnight), max stops per day
    "relaxed": (10 * 60, 20 * 60, 3),
    "normal": (9 * 60, 21 * 60, 4),
    "packed": (8 * 60, 22 * 60 + 30, 6),
}

SIGMA_BEST, SIGMA_BETTER, SIGMA_ACCEPTED = 33, 9, 13  # operator rewards


def to_min(hhmm):
    h, m = (hhmm or "00:00").split(":")
    return int(h) * 60 + int(m)


def to_hhmm(minutes):
    minutes = int(round(minutes))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


class ALNS:
    def __init__(self, candidates, base, days, pace, budget_available, travellers,
                 transport_rate_per_km, params=None):
        """
        candidates: list of {"asset": TravelAsset, "score": float} from the fuzzy module
        base:       (lat, lon) of the hotel / region centre
        budget_available: RM left for attraction tickets + transport (after hotel & food)
        """
        self.c = candidates
        self.n = len(candidates)
        self.days = days
        self.day_start, self.day_end, self.max_stops = PACE_SETTINGS.get(pace, PACE_SETTINGS["normal"])
        self.budget = budget_available
        self.travellers = travellers
        self.rate = transport_rate_per_km
        self.p = {**DEFAULT_PARAMS, **(params or {})}
        self.rng = random.Random(self.p["seed"])

        # Distance matrix; index n is the base (hotel)
        pts = [(x["asset"].latitude, x["asset"].longitude) for x in candidates] + [base]
        self.dist = [[haversine_km(*a, *b) * ROAD_FACTOR for b in pts] for a in pts]
        self.base = self.n
        self.open = [to_min(x["asset"].open_time) for x in candidates]
        self.close = [to_min(x["asset"].close_time) for x in candidates]
        self.visit = [x["asset"].visit_minutes for x in candidates]
        self.ticket = [x["asset"].est_cost * travellers for x in candidates]
        self.score = [x["score"] for x in candidates]
        self.cat = [(x["asset"].category or "").lower() for x in candidates]

        self.destroy_ops = [self.random_removal, self.worst_removal, self.related_removal, self.day_removal]
        self.repair_ops = [self.greedy_insert, self.regret_insert, self.random_greedy_insert]
        self.dw = [1.0] * len(self.destroy_ops)
        self.rw = [1.0] * len(self.repair_ops)
        self.stats = {op.__name__: 0 for op in self.destroy_ops + self.repair_ops}

    # ------------------------------------------------------------------ helpers
    def travel_min(self, km):
        return km / AVG_SPEED_KMH * 60 + STOP_BUFFER_MIN

    def simulate_day(self, route):
        """Constraint check for one day. Returns schedule list, or None if infeasible."""
        if len(route) > self.max_stops:
            return None
        t, pos, lunched, sched = self.day_start, self.base, False, []
        for i in route:
            km = self.dist[pos][i]
            t += self.travel_min(km)
            arrive = max(t, self.open[i])  # wait if it is not open yet
            depart = arrive + self.visit[i]
            if depart > self.close[i]:
                return None  # closes before we finish
            sched.append({"idx": i, "km": km, "arrive": arrive, "depart": depart, "lunch_after": False})
            t, pos = depart, i
            if not lunched and t >= 12 * 60:
                t += LUNCH_MIN
                lunched = True
                sched[-1]["lunch_after"] = True
        if route:
            t += self.travel_min(self.dist[pos][self.base])
        if t > self.day_end:
            return None
        return sched

    def day_km(self, route):
        if not route:
            return 0.0
        pts = [self.base] + route + [self.base]
        return sum(self.dist[a][b] for a, b in zip(pts, pts[1:]))

    def cost(self, sol):
        km = sum(self.day_km(d) for d in sol)
        return sum(self.ticket[i] for d in sol for i in d) + km * self.rate, km

    def objective(self, sol):
        km = sum(self.day_km(d) for d in sol)
        empty = sum(1 for d in sol if not d)
        dup_cats = 0
        for d in sol:
            cats = [self.cat[i] for i in d if self.cat[i]]
            dup_cats += len(cats) - len(set(cats))
        return (100 * sum(self.score[i] for d in sol for i in d) - self.p["distance_weight"] * km
                - EMPTY_DAY_PENALTY * empty - REPEAT_CATEGORY_PENALTY * dup_cats)

    def is_feasible(self, sol):
        visited = [i for d in sol for i in d]
        if len(visited) != len(set(visited)):
            return False  # same attraction twice
        if self.cost(sol)[0] > self.budget + 1e-6:
            return False
        return all(self.simulate_day(d) is not None for d in sol)

    def unassigned(self, sol):
        used = {i for d in sol for i in d}
        return [i for i in range(self.n) if i not in used]

    # ----------------------------------------------------------- insertion core
    def best_insertion(self, sol, i, spent):
        """Best (delta, day, pos) for candidate i, or a list of options per day for regret."""
        options = []
        for d, route in enumerate(sol):
            if len(route) >= self.max_stops:
                continue
            best_day = None
            pts = [self.base] + route + [self.base]
            for pos in range(len(route) + 1):
                a, b = pts[pos], pts[pos + 1]
                extra_km = self.dist[a][i] + self.dist[i][b] - self.dist[a][b]
                extra_cost = self.ticket[i] + extra_km * self.rate
                if spent + extra_cost > self.budget + 1e-6:
                    continue
                delta = 100 * self.score[i] - self.p["distance_weight"] * extra_km
                if not route:
                    delta += EMPTY_DAY_PENALTY  # filling an empty day removes its penalty
                elif self.cat[i] and any(self.cat[j] == self.cat[i] for j in route):
                    delta -= REPEAT_CATEGORY_PENALTY  # avoid too many same-category stops in one day
                if best_day is not None and delta <= best_day[0]:
                    continue
                if self.simulate_day(route[:pos] + [i] + route[pos:]) is None:
                    continue
                best_day = (delta, d, pos, extra_cost)
            if best_day:
                options.append(best_day)
        options.sort(reverse=True)
        return options

    def _insert(self, sol, order_fn):
        spent = self.cost(sol)[0]
        pool = self.unassigned(sol)
        while pool:
            pick = order_fn(sol, pool, spent)
            if pick is None:
                break
            i, (delta, d, pos, extra_cost) = pick
            if delta <= 0:  # only add a place if it improves the objective
                break
            sol[d].insert(pos, i)
            spent += extra_cost
            pool.remove(i)
        return sol

    # -------------------------------------------------------------- repair ops
    def greedy_insert(self, sol):
        def pick(sol, pool, spent):
            best = None
            for i in pool:
                opts = self.best_insertion(sol, i, spent)
                if opts and (best is None or opts[0][0] > best[1][0]):
                    best = (i, opts[0])
            return best
        return self._insert(sol, pick)

    def regret_insert(self, sol):
        def pick(sol, pool, spent):
            best, best_regret = None, -math.inf
            for i in pool:
                opts = self.best_insertion(sol, i, spent)
                if not opts:
                    continue
                regret = opts[0][0] - (opts[1][0] if len(opts) > 1 else 0)
                if regret > best_regret:
                    best, best_regret = (i, opts[0]), regret
            return best
        return self._insert(sol, pick)

    def random_greedy_insert(self, sol):
        spent = self.cost(sol)[0]
        pool = self.unassigned(sol)
        self.rng.shuffle(pool)
        for i in pool:
            opts = self.best_insertion(sol, i, spent)
            if opts and opts[0][0] > 0:
                delta, d, pos, extra_cost = opts[0]
                sol[d].insert(pos, i)
                spent += extra_cost
        return sol

    # ------------------------------------------------------------- destroy ops
    def _q(self, sol):
        total = sum(len(d) for d in sol)
        lo = max(1, int(total * self.p["destroy_min"]))
        hi = max(lo, int(total * self.p["destroy_max"]))
        return self.rng.randint(lo, hi)

    def random_removal(self, sol):
        stops = [(d, i) for d, r in enumerate(sol) for i in r]
        for d, i in self.rng.sample(stops, min(self._q(sol), len(stops))):
            sol[d].remove(i)
        return sol

    def worst_removal(self, sol):
        """Remove stops that add a lot of distance compared with their score."""
        contrib = []
        for d, r in enumerate(sol):
            pts = [self.base] + r + [self.base]
            for k, i in enumerate(r):
                a, b = pts[k], pts[k + 2]
                saving = self.dist[a][i] + self.dist[i][b] - self.dist[a][b]
                contrib.append((100 * self.score[i] - self.p["distance_weight"] * saving * 3, d, i))
        contrib.sort()
        for _, d, i in contrib[:self._q(sol)]:
            sol[d].remove(i)
        return sol

    def related_removal(self, sol):
        """Remove a stop and the stops closest to it (Shaw removal)."""
        stops = [(d, i) for d, r in enumerate(sol) for i in r]
        _, seed = self.rng.choice(stops)
        stops.sort(key=lambda s: self.dist[seed][s[1]])
        for d, i in stops[:self._q(sol)]:
            sol[d].remove(i)
        return sol

    def day_removal(self, sol):
        busy = [d for d, r in enumerate(sol) if r]
        sol[self.rng.choice(busy)] = []
        return sol

    # ------------------------------------------------------------ local search
    def two_opt_day(self, route):
        """Reorder stops within one day using 2-opt to shorten travel distance."""
        if len(route) < 2:
            return route
        best = route[:]
        best_km = self.day_km(best)
        improved = True
        while improved:
            improved = False
            for a in range(len(best) - 1):
                for b in range(a + 1, len(best)):
                    trial = best[:a] + best[a:b + 1][::-1] + best[b + 1:]
                    km = self.day_km(trial)
                    if km + 1e-6 < best_km and self.simulate_day(trial) is not None:
                        best, best_km, improved = trial, km, True
                        break
                if improved:
                    break
        return best

    def polish(self, sol):
        return [self.two_opt_day(d) for d in sol]

    # ------------------------------------------------------------ main search
    def initial_solution(self):
        sol = [[] for _ in range(self.days)]
        spent = 0.0
        for i in range(self.n):  # candidates are already in fuzzy-rank order
            for d in range(self.days):
                trial = sol[d] + [i]
                pts = [self.base] + sol[d] + [self.base]
                extra_km = self.dist[pts[-2]][i] + self.dist[i][self.base] - self.dist[pts[-2]][self.base]
                extra = self.ticket[i] + extra_km * self.rate
                if spent + extra <= self.budget and self.simulate_day(trial) is not None:
                    sol[d] = trial
                    spent += extra
                    break
        return sol

    def _roulette(self, weights):
        r, acc = self.rng.random() * sum(weights), 0
        for k, w in enumerate(weights):
            acc += w
            if r <= acc:
                return k
        return len(weights) - 1

    def run(self):
        t0 = time.perf_counter()
        current = self.initial_solution()
        cur_obj = init_obj = self.objective(current)
        best, best_obj = [d[:] for d in current], cur_obj
        temp = max(1e-3, -self.p["start_temperature_pct"] * abs(init_obj or 100) / math.log(0.5))
        history = [round(best_obj, 2)]

        for it in range(int(self.p["iterations"])):
            if self.n == 0 or not any(current):
                break
            di, ri = self._roulette(self.dw), self._roulette(self.rw)
            cand = [d[:] for d in current]
            cand = self.destroy_ops[di](cand)
            cand = self.repair_ops[ri](cand)
            cand = self.polish(cand)
            cand_obj = self.objective(cand)

            sigma = 0
            if self.is_feasible(cand):
                if cand_obj > best_obj + 1e-9:
                    best, best_obj = [d[:] for d in cand], cand_obj
                    current, cur_obj, sigma = cand, cand_obj, SIGMA_BEST
                    self.stats[self.destroy_ops[di].__name__] += 1
                    self.stats[self.repair_ops[ri].__name__] += 1
                elif cand_obj > cur_obj + 1e-9:
                    current, cur_obj, sigma = cand, cand_obj, SIGMA_BETTER
                elif self.rng.random() < math.exp((cand_obj - cur_obj) / temp):
                    current, cur_obj, sigma = cand, cand_obj, SIGMA_ACCEPTED

            rf = self.p["reaction_factor"]
            self.dw[di] = (1 - rf) * self.dw[di] + rf * max(sigma, 0.5)
            self.rw[ri] = (1 - rf) * self.rw[ri] + rf * max(sigma, 0.5)
            temp *= self.p["cooling_rate"]
            if it % 10 == 9:
                history.append(round(best_obj, 2))

        runtime = (time.perf_counter() - t0) * 1000
        total_cost, total_km = self.cost(best)
        return {
            "solution": best,
            "schedule": [self.simulate_day(d) or [] for d in best],
            "objective": best_obj,
            "initial_objective": init_obj,
            "improvement_pct": 0 if not init_obj else (best_obj - init_obj) / abs(init_obj) * 100,
            "runtime_ms": runtime,
            "iterations": int(self.p["iterations"]),
            "transport_cost": total_km * self.rate,
            "ticket_cost": total_cost - total_km * self.rate,
            "total_km": total_km,
            "operator_wins": self.stats,
            "operator_weights": {
                **{op.__name__: round(w, 2) for op, w in zip(self.destroy_ops, self.dw)},
                **{op.__name__: round(w, 2) for op, w in zip(self.repair_ops, self.rw)},
            },
            "history": history,
        }
