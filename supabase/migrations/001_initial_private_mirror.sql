-- Mission Control Online V1
-- Private read-only dashboard mirror for Raz.
-- Run this in the Supabase SQL editor for the mission-control-online project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  constraint profiles_owner_email_check check (email = 'razifdjamaludin@gmail.com')
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  trigger text not null check (trigger in ('scheduled', 'manual', 'dry_run')),
  source_host text,
  summary jsonb not null default '{}'::jsonb,
  error text
);

create table if not exists public.sync_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'expired')),
  started_at timestamptz,
  completed_at timestamptz,
  handled_by text,
  error text
);

create table if not exists public.canonical_projects (
  id text primary key,
  name text not null,
  owner text,
  team jsonb not null default '[]'::jsonb,
  status text,
  priority text,
  current_phase text,
  next_step text,
  source_updated_at timestamptz,
  synced_at timestamptz not null
);

create table if not exists public.canonical_team_members (
  id text primary key,
  name text not null,
  role text,
  model text,
  agent_group text,
  parent_agent text,
  synced_at timestamptz not null
);

create table if not exists public.cron_job_snapshots (
  id text primary key,
  name text,
  schedule text,
  status text,
  enabled boolean,
  last_run_at timestamptz,
  next_run_at timestamptz,
  duration_ms integer,
  error text,
  synced_at timestamptz not null
);

create table if not exists public.agent_token_usage_daily (
  id text primary key,
  agent text not null,
  date date not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  total_tokens integer not null default 0,
  turns integer not null default 0,
  synced_at timestamptz not null,
  unique (agent, date)
);

create table if not exists public.source_health_snapshots (
  id text primary key,
  label text not null,
  source_type text,
  exists boolean,
  readable boolean,
  modified_at timestamptz,
  age_hours numeric,
  status text,
  error text,
  synced_at timestamptz not null
);

create table if not exists public.workspace_signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  branch text,
  head text,
  working_tree text,
  commits_24h integer,
  commits_7d integer,
  latest_commit_at timestamptz,
  recent_commits jsonb not null default '[]'::jsonb,
  file_churn jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists sync_requests_status_requested_at_idx on public.sync_requests (status, requested_at);
create index if not exists sync_runs_started_at_idx on public.sync_runs (started_at desc);
create index if not exists agent_token_usage_daily_date_agent_idx on public.agent_token_usage_daily (date desc, agent);
create index if not exists canonical_projects_synced_at_idx on public.canonical_projects (synced_at desc);
create index if not exists canonical_team_members_synced_at_idx on public.canonical_team_members (synced_at desc);
create index if not exists cron_job_snapshots_synced_at_idx on public.cron_job_snapshots (synced_at desc);
create index if not exists source_health_snapshots_synced_at_idx on public.source_health_snapshots (synced_at desc);
create index if not exists workspace_signal_snapshots_synced_at_idx on public.workspace_signal_snapshots (synced_at desc);

-- ---------------------------------------------------------------------------
-- Owner helper
-- ---------------------------------------------------------------------------

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and email = 'razifdjamaludin@gmail.com'
      and role = 'owner'
  );
$$;

-- Automatically create the owner profile for the allowed email only.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'razifdjamaludin@gmail.com' then
    insert into public.profiles (id, email, display_name, role)
    values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'display_name', 'Raz'), 'owner')
    on conflict (id) do update set email = excluded.email;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_requests enable row level security;
alter table public.canonical_projects enable row level security;
alter table public.canonical_team_members enable row level security;
alter table public.cron_job_snapshots enable row level security;
alter table public.agent_token_usage_daily enable row level security;
alter table public.source_health_snapshots enable row level security;
alter table public.workspace_signal_snapshots enable row level security;

-- Reset policies for repeatable local application during setup.
drop policy if exists "owner can read own profile" on public.profiles;
drop policy if exists "owner can read sync runs" on public.sync_runs;
drop policy if exists "owner can read sync requests" on public.sync_requests;
drop policy if exists "owner can request sync" on public.sync_requests;
drop policy if exists "owner can read canonical projects" on public.canonical_projects;
drop policy if exists "owner can read canonical team" on public.canonical_team_members;
drop policy if exists "owner can read cron snapshots" on public.cron_job_snapshots;
drop policy if exists "owner can read token usage" on public.agent_token_usage_daily;
drop policy if exists "owner can read source health" on public.source_health_snapshots;
drop policy if exists "owner can read workspace signals" on public.workspace_signal_snapshots;

create policy "owner can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() and public.is_owner());

create policy "owner can read sync runs"
  on public.sync_runs for select
  to authenticated
  using (public.is_owner());

create policy "owner can read sync requests"
  on public.sync_requests for select
  to authenticated
  using (public.is_owner());

create policy "owner can request sync"
  on public.sync_requests for insert
  to authenticated
  with check (public.is_owner() and requested_by = auth.uid());

create policy "owner can read canonical projects"
  on public.canonical_projects for select
  to authenticated
  using (public.is_owner());

create policy "owner can read canonical team"
  on public.canonical_team_members for select
  to authenticated
  using (public.is_owner());

create policy "owner can read cron snapshots"
  on public.cron_job_snapshots for select
  to authenticated
  using (public.is_owner());

create policy "owner can read token usage"
  on public.agent_token_usage_daily for select
  to authenticated
  using (public.is_owner());

create policy "owner can read source health"
  on public.source_health_snapshots for select
  to authenticated
  using (public.is_owner());

create policy "owner can read workspace signals"
  on public.workspace_signal_snapshots for select
  to authenticated
  using (public.is_owner());
