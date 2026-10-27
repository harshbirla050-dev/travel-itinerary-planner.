"""Prompt engineering + generation. Falls back to an offline demo generator without an API key."""
import json
import os
from datetime import date, timedelta

SYSTEM = """You are an expert travel planner. Produce realistic, geographically sensible
itineraries that group nearby places on the same day, respect opening-hour logic
(breakfast in the morning, dinner in the evening), the stated pace, and the budget.
All costs are TOTAL for the whole group in the requested currency.
Respond with ONLY valid JSON, no markdown fences, no commentary."""

DAY_SCHEMA = """{
  "day": <int>, "date": "YYYY-MM-DD", "theme": "<short theme>",
  "activities": [
    {"time": "HH:MM", "title": "<place or activity>",
     "type": "attraction|dining|experience|transport|rest",
     "description": "<one or two sentences>", "location": "<area/neighbourhood>",
     "duration": "<e.g. 2h>", "cost": <number>}
  ]
}"""

TRIP_SCHEMA = (
    '{"summary": "<2 sentences>", '
    '"accommodation": {"name": "<hotel/stay>", "description": "<why it fits>", "cost_per_night": <number>}, '
    '"transport_tips": ["<tip>", "..."], '
    '"days": [' + DAY_SCHEMA + "]}"
)

PACE_COUNT = {"relaxed": "3-4", "balanced": "4-5", "packed": "6-7"}


def num_days(req) -> int:
    d0, d1 = date.fromisoformat(req["start_date"]), date.fromisoformat(req["end_date"])
    return max(1, min(14, (d1 - d0).days + 1))


def _brief(req) -> str:
    return (
        f"Destination: {req['destination']}\nDates: {req['start_date']} to {req['end_date']} "
        f"({num_days(req)} days)\nTravelers: {req['travelers']} ({req['trip_type']})\n"
        f"Total budget: {req['budget']} {req['currency']}\nPace: {req['pace']} "
        f"({PACE_COUNT.get(req['pace'], '4-5')} activities/day)\n"
        f"Stay level: {req['accommodation_level']}\n"
        f"Interests: {', '.join(req.get('interests') or []) or 'general sightseeing'}\n"
        f"Notes: {req.get('notes') or 'none'}"
    )


def _extract_json(text: str):
    text = text.strip()
    return json.loads(text[text.find("{"): text.rfind("}") + 1])


def _call(prompt: str, max_tokens: int):
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        return None
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    msg = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
        max_tokens=max_tokens,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return _extract_json("".join(b.text for b in msg.content if b.type == "text"))


def generate_itinerary(req: dict) -> dict:
    prompt = f"Create a day-by-day itinerary.\n\n{_brief(req)}\n\nReturn JSON in exactly this shape:\n{TRIP_SCHEMA}"
    try:
        result = _call(prompt, 8000)
        if result and result.get("days"):
            return result
    except Exception as e:  # fall back so the app stays usable
        print("AI generation failed, using demo generator:", e)
    return _demo_itinerary(req)


def regenerate_day(req: dict, itinerary: dict, day_no: int, feedback: str) -> dict:
    others = [
        {"day": d["day"], "theme": d["theme"], "places": [a["title"] for a in d["activities"]]}
        for d in itinerary["days"] if d["day"] != day_no
    ]
    prompt = (
        f"Regenerate ONLY day {day_no} of this trip with a fresh plan. Do not repeat places "
        f"used on other days.\n\n{_brief(req)}\n\nOther days: {json.dumps(others)}\n"
        f"User feedback: {feedback or 'none'}\n\nReturn JSON in exactly this shape:\n{DAY_SCHEMA}"
    )
    try:
        result = _call(prompt, 2500)
        if result and result.get("activities"):
            result["day"] = day_no
            return result
    except Exception as e:
        print("AI regeneration failed, using demo generator:", e)
    return _demo_day(req, day_no, variant=1)


# ---------- offline demo generator ----------
def _demo_day(req, n, variant=0):
    dest = req["destination"]
    start = date.fromisoformat(req["start_date"]) + timedelta(days=n - 1)
    interests = req.get("interests") or ["sightseeing"]
    focus = interests[(n - 1 + variant) % len(interests)]
    per = req["budget"] / num_days(req) / 5
    return {
        "day": n, "date": start.isoformat(), "theme": f"{focus.title()} in {dest}",
        "activities": [
            {"time": "08:30", "title": "Breakfast at a local cafe", "type": "dining",
             "description": "Start with a regional breakfast near your stay.", "location": "Old town",
             "duration": "1h", "cost": round(per * 0.4)},
            {"time": "10:00", "title": f"{dest} {focus} highlight #{n}", "type": "attraction",
             "description": f"Top {focus} spot, best visited before the crowds.", "location": "Central",
             "duration": "2h", "cost": round(per * 0.6)},
            {"time": "13:00", "title": "Lunch at a popular local spot", "type": "dining",
             "description": "Try a signature dish at a well-reviewed restaurant.", "location": "Central",
             "duration": "1h 30m", "cost": round(per * 0.7)},
            {"time": "15:00", "title": f"Neighbourhood walk and {focus}", "type": "experience",
             "description": "Unhurried exploration of nearby streets, markets and viewpoints.", "location": "Nearby district",
             "duration": "2h 30m", "cost": round(per * 0.4)},
            {"time": "19:30", "title": "Dinner with a view", "type": "dining",
             "description": "Evening meal at a recommended restaurant.", "location": "Waterfront / centre",
             "duration": "2h", "cost": round(per * 1.2)},
        ],
    }


def _demo_itinerary(req):
    level = {"budget": 0.08, "mid-range": 0.15, "premium": 0.3}.get(req["accommodation_level"], 0.15)
    nights = max(1, num_days(req) - 1)
    return {
        "summary": f"A {req['pace']} {num_days(req)}-day plan for {req['destination']} (offline demo mode: add an API key for real AI plans).",
        "accommodation": {
            "name": f"{req['accommodation_level'].title()} stay in central {req['destination']}",
            "description": "Central base to minimise daily travel time.",
            "cost_per_night": round(req["budget"] * level / nights),
        },
        "transport_tips": ["Use public transit or walking for central areas.", "Book popular attractions in advance."],
        "days": [_demo_day(req, n) for n in range(1, num_days(req) + 1)],
    }
