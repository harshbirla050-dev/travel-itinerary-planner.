# Wayfinder: Personalized Travel Itinerary Planner

React (Vite) + FastAPI + Supabase + generative AI (Claude).

**Features:** smart trip builder (solo / couple / group), AI day-by-day itineraries
(attractions, dining, stay, transport tips), editable activities, per-day regeneration with
feedback, live cost tracking vs budget, saved trips dashboard, shareable trip links.

## Run it

### 1. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # add ANTHROPIC_API_KEY (and optionally Supabase keys)
uvicorn main:app --reload --port 8000
```
Docs: http://localhost:8000/docs. Health check: `/api/health`.

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

## Modes
| Setting | Empty | Filled |
|---|---|---|
| `ANTHROPIC_API_KEY` | Offline demo generator (placeholder plans) | Real AI itineraries |
| `SUPABASE_URL` + `SUPABASE_KEY` | Trips saved in `backend/data.json` | Saved in Supabase (run `backend/schema.sql` first) |

## API
`POST /api/trips/generate` · `GET /api/trips` · `GET /api/trips/{id}` · `PUT /api/trips/{id}` ·
`POST /api/trips/{id}/regenerate-day/{day}` · `DELETE /api/trips/{id}`
(user identified by the `X-User-Id` header.)

## Notes / next steps
- Identity is an anonymous per-browser id. For real accounts, add Supabase Auth and verify the JWT in `main.py`.
- Share links let anyone with the link view and edit. Add a `collaborators` table for stricter access.
- Prompts live in `backend/ai.py`; tune `SYSTEM`, schemas and pace rules there.
