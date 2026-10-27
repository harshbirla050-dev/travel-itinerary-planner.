"""Persistence: Supabase when configured, otherwise a local JSON file."""
import json
import os
import threading
from datetime import datetime, timezone
from typing import Optional

FILE = os.path.join(os.path.dirname(__file__), "data.json")
_lock = threading.Lock()
_sb = None


def _supabase():
    global _sb
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY")
    if not (url and key):
        return None
    if _sb is None:
        from supabase import create_client
        _sb = create_client(url, key)
    return _sb


def _read():
    if not os.path.exists(FILE):
        return {}
    with open(FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write(data):
    with open(FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def now():
    return datetime.now(timezone.utc).isoformat()


def save_trip(trip: dict) -> dict:
    trip["updated_at"] = now()
    sb = _supabase()
    if sb:
        sb.table("trips").upsert(trip).execute()
    else:
        with _lock:
            data = _read()
            data[trip["id"]] = trip
            _write(data)
    return trip


def get_trip(trip_id: str) -> Optional[dict]:
    sb = _supabase()
    if sb:
        rows = sb.table("trips").select("*").eq("id", trip_id).execute().data
        return rows[0] if rows else None
    return _read().get(trip_id)


def list_trips(user_id: str) -> list:
    sb = _supabase()
    if sb:
        return (
            sb.table("trips").select("*").eq("user_id", user_id)
            .order("updated_at", desc=True).execute().data
        )
    trips = [t for t in _read().values() if t["user_id"] == user_id]
    return sorted(trips, key=lambda t: t["updated_at"], reverse=True)


def delete_trip(trip_id: str, user_id: str) -> bool:
    sb = _supabase()
    if sb:
        sb.table("trips").delete().eq("id", trip_id).eq("user_id", user_id).execute()
        return True
    with _lock:
        data = _read()
        t = data.get(trip_id)
        if not t or t["user_id"] != user_id:
            return False
        del data[trip_id]
        _write(data)
    return True
