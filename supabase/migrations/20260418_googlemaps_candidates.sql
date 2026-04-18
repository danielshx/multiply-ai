-- =============================================================================
-- Research Agent — Google Maps candidates
-- Populated by the HappyRobot "Research: Google Maps" workflow (v7) via
--   POST /api/research/agent/callback
--
-- One row per place inside places_json. Run-level fields (topic, agent,
-- search_query, total_found) are denormalized onto every row for easy
-- filtering and grouping.
--
-- Workflow payload shape:
--   { topic, agent, search_query, total_found, places_json: [
--       { name, phone, category, address, website, rating,
--         review_count, hours, description, place_id } ] }
-- =============================================================================

create table if not exists public.googlemaps_candidates (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- run-level
  agent_name      text,
  topic           text,
  search_query    text,
  total_found     int,

  -- per-place
  place_name      text,
  phone_number    text,
  company_type    text,
  address         text,
  website         text,
  rating          numeric,
  review_count    int,
  hours           text,
  description     text,
  google_place_id text,

  raw             jsonb not null default '{}'::jsonb
);

create index if not exists googlemaps_candidates_created_at_idx
  on public.googlemaps_candidates (created_at desc);
create index if not exists googlemaps_candidates_agent_name_idx
  on public.googlemaps_candidates (agent_name);
create index if not exists googlemaps_candidates_topic_idx
  on public.googlemaps_candidates (topic);
create index if not exists googlemaps_candidates_search_query_idx
  on public.googlemaps_candidates (search_query);

do $$
begin
  alter publication supabase_realtime add table public.googlemaps_candidates;
exception
  when duplicate_object then null;
end$$;
