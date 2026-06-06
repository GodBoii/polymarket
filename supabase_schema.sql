create table if not exists public.agent_runs (
  id uuid primary key,
  fixture_id bigint not null,
  mode text not null default 'manual',
  status text not null default 'running',
  fixture jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.agent_runs add column if not exists mode text not null default 'manual';

create table if not exists public.agent_events (
  id bigserial primary key,
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  event_type text not null,
  stage text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_runs enable row level security;
alter table public.agent_events enable row level security;

drop policy if exists "authenticated users can read runs" on public.agent_runs;
create policy "authenticated users can read runs"
on public.agent_runs for select
to authenticated
using (true);

drop policy if exists "authenticated users can read events" on public.agent_events;
create policy "authenticated users can read events"
on public.agent_events for select
to authenticated
using (true);

create index if not exists agent_runs_created_at_idx on public.agent_runs(created_at desc);
create index if not exists agent_events_run_id_created_at_idx on public.agent_events(run_id, created_at asc);
