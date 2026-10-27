from typing import List, Optional
from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    destination: str = Field(min_length=2)
    start_date: str  # YYYY-MM-DD
    end_date: str
    budget: float = Field(gt=0, description="Total budget for the whole group")
    currency: str = "USD"
    travelers: int = Field(default=1, ge=1, le=30)
    trip_type: str = "solo"  # solo | couple | group
    pace: str = "balanced"  # relaxed | balanced | packed
    accommodation_level: str = "mid-range"  # budget | mid-range | premium
    interests: List[str] = []
    notes: Optional[str] = ""


class RegenerateDayRequest(BaseModel):
    feedback: Optional[str] = ""


class TripUpdate(BaseModel):
    title: Optional[str] = None
    itinerary: dict
