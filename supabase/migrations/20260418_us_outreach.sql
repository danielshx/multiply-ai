-- =============================================================================
-- /us-outreach — US cold-call dashboard for Paid Online Writing Jobs
-- Independent of the Swarm pipeline (own table, own HR workflow, own routes).
-- =============================================================================

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

-- Enable Realtime for live dashboard updates.
alter publication supabase_realtime add table public.us_outreach_calls;
