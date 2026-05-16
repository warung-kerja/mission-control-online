alter table public.cron_job_snapshots add column if not exists agent text;
alter table public.cron_job_snapshots add column if not exists model text;
alter table public.cron_job_snapshots add column if not exists model_source text;
