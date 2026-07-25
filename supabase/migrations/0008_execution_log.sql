-- Phase 8's History page needs the full, unbounded execution log -
-- dashboard_data.executions/executions_meta are both capped (historyLimit/
-- META_RETENTION_LIMIT, see api/_lib/processExecutionForProject.ts) so
-- older entries get trimmed away as new ones arrive. This table is a
-- simple append-only ledger, never trimmed, written alongside (not instead
-- of) the capped aggregate on every ingest regardless of branch - unlike
-- the Overview aggregate, History is meant to show everything, forever.
create table public.execution_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  execution_id text not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, execution_id)
);

alter table public.execution_log enable row level security;

create policy "org members can read execution log" on public.execution_log
  for select using (public.is_project_member(project_id, auth.uid()));
