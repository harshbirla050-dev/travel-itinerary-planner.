import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import ai  # noqa: E402
import store  # noqa: E402
from schemas import RegenerateDayRequest, TripRequest, TripUpdate  # noqa: E402

app = FastAPI(title="Personalized Travel Itinerary Planner")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _user(x_user_id: Optional[str]) -> str:
    if not x_user_id:
        raise HTTPException(401, "Missing X-User-Id header")
    return x_user_id


def _trip_or_404(trip_id: str) -> dict:
    trip = store.get_trip(trip_id)
    if not trip:
        raise HTTPException(404, "Trip not found")
    return trip


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "ai": "claude" if os.getenv("ANTHROPIC_API_KEY") else "demo",
        "storage": "supabase" if os.getenv("SUPABASE_URL") else "local-json",
    }


@app.post("/api/trips/generate")
def generate(req: TripRequest, x_user_id: Optional[str] = Header(default=None)):
    user_id = _user(x_user_id)
    if req.end_date < req.start_date:
        raise HTTPException(400, "End date must be on or after the start date")
    data = req.model_dump()
    trip = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": f"{req.destination}, {req.start_date}",
        "request": data,
        "itinerary": ai.generate_itinerary(data),
        "created_at": store.now(),
    }
    return store.save_trip(trip)


@app.get("/api/trips")
def list_trips(x_user_id: Optional[str] = Header(default=None)):
    return store.list_trips(_user(x_user_id))


@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str):
    # Anyone with the link can open a trip (used for group sharing)
    return _trip_or_404(trip_id)


@app.put("/api/trips/{trip_id}")
def update_trip(trip_id: str, body: TripUpdate):
    trip = _trip_or_404(trip_id)
    trip["itinerary"] = body.itinerary
    if body.title:
        trip["title"] = body.title
    return store.save_trip(trip)


@app.post("/api/trips/{trip_id}/regenerate-day/{day}")
def regenerate_day(trip_id: str, day: int, body: RegenerateDayRequest):
    trip = _trip_or_404(trip_id)
    days = trip["itinerary"]["days"]
    idx = next((i for i, d in enumerate(days) if d["day"] == day), None)
    if idx is None:
        raise HTTPException(404, "Day not found")
    days[idx] = ai.regenerate_day(trip["request"], trip["itinerary"], day, body.feedback or "")
    return store.save_trip(trip)


@app.delete("/api/trips/{trip_id}")
def delete_trip(trip_id: str, x_user_id: Optional[str] = Header(default=None)):
    if not store.delete_trip(trip_id, _user(x_user_id)):
        raise HTTPException(404, "Trip not found")
    return {"deleted": True}
