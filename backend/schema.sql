-- Run in Supabase SQL editor
create table if not exists public.trips (
  id uuid primary key,
  user_id text not null,
  title text not null,
  request jsonb not null,
  itinerary jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists trips_user_idx on public.trips (user_id, updated_at desc);
