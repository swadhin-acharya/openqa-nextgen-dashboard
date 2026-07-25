-- Phase 1 of the Standalone Execution Report feature: every completed
-- (non-live) ingest generates one self-contained HTML report and stores it
-- here. The report is generated exactly once, from the same canonical
-- execution data the dashboard itself reads (see api/_lib/reportGenerator.ts) -
-- never recomputed independently, per the feature's core "one source of
-- truth" requirement.
--
-- Private bucket - there is deliberately NO client-facing storage select
-- policy. All reads go through api/report.ts, which checks project
-- membership itself before serving the file via the service-role client.
-- This matches the security requirement that report access must respect
-- org/project authorization, not rely on a guessable/public storage path.
insert into storage.buckets (id, name, public)
values ('execution-reports', 'execution-reports', false)
on conflict (id) do nothing;

create table public.report_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  execution_id text not null,
  file_name text not null,
  size_bytes integer not null,
  checksum text not null,
  storage_path text not null,
  -- GENERATION_FAILED is set when generation throws - a report failure must
  -- never fail the execution ingest itself (see processExecutionForProject.ts).
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'GENERATION_FAILED')),
  generated_at timestamptz not null default now(),
  -- Populated once online retention (Phase 3) ships; null means "kept
  -- indefinitely" for now.
  expires_at timestamptz,
  unique (project_id, execution_id)
);

alter table public.report_artifacts enable row level security;

create policy "org members can read report metadata" on public.report_artifacts
  for select using (public.is_project_member(project_id, auth.uid()));
