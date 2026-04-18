-- =============================================================================
-- One-shot setup for /us-outreach. Paste this entire file into the Supabase
-- SQL editor and run. Idempotent — safe to re-run.
-- =============================================================================

-- 1. calls table -----------------------------------------------------------

create table if not exists public.us_outreach_calls (
  id              uuid primary key default gen_random_uuid(),
  contact_name    text,
  phone_number    text not null,
  status          text not null default 'triggered',
  disposition     text,
  hr_run_id       text,
  hr_session_id   text,
  transcript_url  text,
  recording_url   text,
  sms_sent_at     timestamptz,
  sms_sid         text,
  closed_at       timestamptz,
  duration_sec    int,
  reason          text,
  raw_outcome     jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists us_outreach_calls_created_at_idx
  on public.us_outreach_calls (created_at desc);
create index if not exists us_outreach_calls_disposition_idx
  on public.us_outreach_calls (disposition);

-- 2. messages table (live transcript) --------------------------------------

create table if not exists public.us_outreach_messages (
  id           uuid primary key default gen_random_uuid(),
  call_id      uuid references public.us_outreach_calls(id) on delete cascade,
  ts           timestamptz default now(),
  role         text,
  content      text,
  hr_msg_id    text
);

create index if not exists us_outreach_messages_call_ts_idx
  on public.us_outreach_messages (call_id, ts);

create unique index if not exists us_outreach_messages_hr_msg_id_uniq
  on public.us_outreach_messages (hr_msg_id) where hr_msg_id is not null;

-- 3. Realtime publication --------------------------------------------------
--    Wrapped in DO blocks to ignore "table is already member" errors so the
--    file stays idempotent.

do $$
begin
  alter publication supabase_realtime add table public.us_outreach_calls;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.us_outreach_messages;
exception when duplicate_object then null;
end $$;
