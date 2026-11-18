"""
MODULE 1 - NLP and User Input Processing
========================================
Turns the traveller's free-text prompt into structured data (JSON) for the
Fuzzy Logic module.

Steps (same as the report):
    1. User input   - text from the trip form
    2. Tokenization - split text into lowercase words
    3. Entity extraction - region, days, budget, travellers, interests, pace
    4. JSON output  - a dict that the next module can use

It also writes the plain-language summary of the finished itinerary
("explain the generated itineraries in simple language").

This is a light rule-based NLP so it runs anywhere with no downloads.
Later you can swap extract_entities() for spaCy/NLTK without touching the rest.
"""
import re

# Interest categories used across the whole system, with words that point to them.
INTEREST_KEYWORDS = {
    "nature": ["nature", "hike", "hiking", "trek", "forest", "jungle", "waterfall", "park", "mountain",
               "hill", "garden", "green", "wildlife", "scenery", "view", "sunset", "sunrise"],
    "beach": ["beach", "island", "sea", "snorkel", "snorkeling", "diving", "swim", "swimming", "coast", "sand"],
    "culture": ["culture", "cultural", "temple", "mosque", "church", "heritage", "art", "museum",
                "street art", "tradition", "traditional", "local"],
    "history": ["history", "historical", "historic", "colonial", "fort", "palace", "old town", "museum", "unesco"],
    "food": ["food", "eat", "eating", "makan", "hawker", "street food", "cuisine", "nasi", "laksa",
             "cafe", "cafes", "dessert", "night market", "foodie", "restaurant"],
    "shopping": ["shop", "shopping", "mall", "market", "souvenir", "bazaar", "boutique"],
    "adventure": ["adventure", "extreme", "zipline", "climb", "climbing", "cable car", "skybridge",
                  "kayak", "rafting", "thrill"],
    "family": ["family", "kids", "children", "child", "theme park", "aquarium", "zoo", "bird park"],
}

# Region names and the words people use for them.
REGION_ALIASES = {
    "Kuala Lumpur": ["kuala lumpur", "kl", "klcc", "bukit bintang"],
    "Penang": ["penang", "pulau pinang", "george town", "georgetown", "batu ferringhi"],
    "Melaka": ["melaka", "malacca", "jonker"],
    "Langkawi": ["langkawi", "kuah", "pantai cenang"],
    "Kota Kinabalu": ["kota kinabalu", "kk", "sabah", "kinabalu"],
}

PACE_WORDS = {
    "relaxed": ["relax", "relaxed", "slow", "chill", "easy", "leisure", "rest"],
    "packed": ["packed", "busy", "maximum", "as much as possible", "many places", "full day", "fast"],
}

NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
                "a": 1, "an": 1, "satu": 1, "dua": 2, "tiga": 3, "empat": 4, "lima": 5}


def tokenize(text):
    """Step 2: lowercase the text and split it into words."""
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _has_phrase(text, phrase):
    return re.search(r"\b" + re.escape(phrase) + r"\b", text) is not None


def extract_entities(text, known_regions=None):
    """Step 3: find region, days, budget, travellers, interests and pace in the text."""
    text_l = (text or "").lower()
    result = {"region": None, "days": None, "budget": None, "travellers": None,
              "interests": [], "pace": None, "tokens": tokenize(text)}

    # Region (also accept any region name the admin added to the database)
    aliases = dict(REGION_ALIASES)
    for r in known_regions or []:
        aliases.setdefault(r, [r.lower()])
    for region, words in aliases.items():
        if any(_has_phrase(text_l, w) for w in words):
            result["region"] = region
            break

    # Budget: "RM800", "rm 1,200", "1500 ringgit", "budget 900"
    m = (re.search(r"rm\s?(\d[\d,]*(?:\.\d+)?)", text_l)
         or re.search(r"(\d[\d,]*(?:\.\d+)?)\s?(?:ringgit|myr)", text_l)
         or re.search(r"budget\D{0,12}(\d[\d,]*)", text_l))
    if m:
        result["budget"] = float(m.group(1).replace(",", ""))

    # Days: "3 days", "3-day", "three days", "2D1N", "weekend"
    m = re.search(r"(\d+)\s?-?\s?(?:days?|hari)\b", text_l) or re.search(r"(\d+)\s?d\s?\d+\s?n\b", text_l)
    if m:
        result["days"] = int(m.group(1))
    else:
        m = re.search(r"\b(" + "|".join(NUMBER_WORDS) + r")[\s-]+days?\b", text_l)
        if m:
            result["days"] = NUMBER_WORDS[m.group(1)]
        elif "weekend" in text_l:
            result["days"] = 2

    # Travellers: "for 4 people", "2 pax", "family of 5"
    m = re.search(r"(\d+)\s?(?:people|persons|pax|adults|of us|travellers|travelers)", text_l) \
        or re.search(r"family of (\d+)", text_l)
    if m:
        result["travellers"] = int(m.group(1))
    elif re.search(r"\b(couple|honeymoon|my (wife|husband|partner|girlfriend|boyfriend))\b", text_l):
        result["travellers"] = 2
    elif re.search(r"\b(solo|alone|myself)\b", text_l):
        result["travellers"] = 1

    # Interests
    for category, words in INTEREST_KEYWORDS.items():
        if any(_has_phrase(text_l, w) for w in words):
            result["interests"].append(category)

    # Pace
    for pace, words in PACE_WORDS.items():
        if any(_has_phrase(text_l, w) for w in words):
            result["pace"] = pace
            break
    return result


def parse_request(form_data, prompt, known_regions=None):
    """
    Step 4: merge the form fields with what the NLP found in the prompt.
    Form fields the user filled in win; the prompt fills the gaps and adds interests.
    Returns a JSON-ready dict.
    """
    found = extract_entities(prompt, known_regions)
    interests = list(dict.fromkeys(list(form_data.get("interests") or []) + found["interests"]))
    return {
        "region": form_data.get("region") or found["region"],
        "days": form_data.get("days") or found["days"] or 2,
        "budget": form_data.get("budget") or found["budget"] or 1000,
        "travellers": form_data.get("travellers") or found["travellers"] or 1,
        "interests": interests or ["culture", "food"],
        "pace": form_data.get("pace") or found["pace"] or "normal",
        "nlp_found": {k: v for k, v in found.items() if k != "tokens" and v},
        "token_count": len(found["tokens"]),
    }


# ---------------------------------------------------------------------------
# Text generation: plain-language explanation of the result
# ---------------------------------------------------------------------------
def generate_summary(parsed, plan_days, hotel, total_cost, budget, total_km):
    """Write a short, friendly explanation of the itinerary."""
    n_stops = sum(len(d) for d in plan_days)
    interests = ", ".join(parsed["interests"])
    lines = [
        f"Here is your {parsed['days']}-day trip to {parsed['region']} for "
        f"{parsed['travellers']} traveller{'s' if parsed['travellers'] > 1 else ''}. "
        f"We picked {n_stops} places that match your interests in {interests}."
    ]
    if hotel:
        lines.append(f"You will stay at {hotel.name}, so every day starts and ends there.")
    for i, day in enumerate(plan_days, start=1):
        if not day:
            lines.append(f"Day {i} is a free day to rest or explore on your own.")
            continue
        names = [s["asset"].name for s in day]
        best = max(day, key=lambda s: s["score"])
        lines.append(f"Day {i}: {', '.join(names)}. Highlight: {best['asset'].name} "
                     f"(match score {best['score']:.2f}).")
    left = budget - total_cost
    lines.append(f"The estimated total is RM{total_cost:,.0f} of your RM{budget:,.0f} budget "
                 f"(RM{left:,.0f} left), with about {total_km:.0f} km of travel between stops.")
    lines.append("The route order was optimised to keep travel distance short while respecting "
                 "opening hours, your daily time and your budget.")
    return " ".join(lines)
