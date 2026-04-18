-- =============================================================================
-- /us-outreach — live transcript persistence + Realtime broadcast
-- =============================================================================

create table if not exists public.us_outreach_messages (
  id           uuid primary key default gen_random_uuid(),
  call_id      uuid references public.us_outreach_calls(id) on delete cascade,
  ts           timestamptz default now(),
  role         text,                -- 'agent' | 'user' | 'system' | 'tool'
  content      text,
  hr_msg_id    text                 -- de-dupe key from HR
);

create index if not exists us_outreach_messages_call_ts_idx
  on public.us_outreach_messages (call_id, ts);

create unique index if not exists us_outreach_messages_hr_msg_id_uniq
  on public.us_outreach_messages (hr_msg_id) where hr_msg_id is not null;

alter publication supabase_realtime add table public.us_outreach_messages;
