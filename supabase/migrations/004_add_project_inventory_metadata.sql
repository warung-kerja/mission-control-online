alter table public.canonical_projects add column if not exists source_root text;
alter table public.canonical_projects add column if not exists folder_path text;
alter table public.canonical_projects add column if not exists folder_status text;
alter table public.canonical_projects add column if not exists registry_status text;
alter table public.canonical_projects add column if not exists project_kind text;
alter table public.canonical_projects add column if not exists parent_project_id text;
alter table public.canonical_projects add column if not exists visibility text;
