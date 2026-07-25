-- Phase 10: live execution visualization. A member's in-progress CI run
-- polls this table with partial counts every ~15-30s (see api/ingest.ts's
-- `inProgress` flag) so the frontend can show a "running now" banner via
-- Supabase Realtime. Deliberately a separate table from dashboard_data -
-- partial/in-progress counts must never be able to contaminate the
-- historical record, so there is no code path that merges this table's
-- rows into dashboard_data at all; the final (non-inProgress) ingest for
-- the same execution_id writes history the normal way and then deletes the
-- live row here.
create table public.live_executions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  execution_id text not null,
  suite_id uuid references public.suites(id) on delete set null,
  branch text,
  executed_by_user_id uuid references public.profiles(id) on delete set null,
  executed_by_name text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  total integer not null default 0,
  passed integer not null default 0,
  failed integer not null default 0,
  broken integer not null default 0,
  skipped integer not null default 0,
  unique (project_id, execution_id)
);

alter table public.live_executions enable row level security;

-- Read-only for org members, same as dashboard_data. There is deliberately
-- no client-facing insert/update/delete policy - only api/ingest.ts's
-- service-role client (bypasses RLS) ever writes here, exactly like
-- dashboard_data/executions_meta.
create policy "org members can read live executions" on public.live_executions
  for select using (public.is_project_member(project_id, auth.uid()));

-- Required for the frontend's Supabase Realtime subscription to receive
-- INSERT/UPDATE/DELETE change events on this table at all - a project's
-- realtime publication is empty by default.
alter publication supabase_realtime add table public.live_executions;
