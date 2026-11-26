-- Light & Loam: tables for saved plans, pilot feedback and simple usage events.
-- Run once in the Supabase SQL editor. Row-level security keeps each person's plans private.

create table if not exists public.plans (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;
create policy "own plans: read" on public.plans for select using (auth.uid() = user_id);
create policy "own plans: insert" on public.plans for insert with check (auth.uid() = user_id);
create policy "own plans: update" on public.plans for update using (auth.uid() = user_id);
create policy "own plans: delete" on public.plans for delete using (auth.uid() = user_id);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  page text,
  step text,
  message text not null check (char_length(message) between 1 and 4000),
  contact text
);
alter table public.feedback enable row level security;
-- Anyone using the app can send feedback; nobody can read it through the app.
create policy "send feedback" on public.feedback for insert with check (true);

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  visitor text not null,          -- random id kept in the browser, not tied to a person
  name text not null,             -- e.g. step_reached, plan_saved, build_plan_opened
  detail text
);
alter table public.events enable row level security;
create policy "log events" on public.events for insert with check (true);
