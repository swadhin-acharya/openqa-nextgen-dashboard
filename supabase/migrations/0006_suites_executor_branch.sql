-- Phase 4 of the Executions/Reports/branch-scoping plan: suites, per-project
-- main branch config, and the two new dashboard_data columns that let
-- ingestion record suite/executor/branch metadata and full per-execution
-- test detail without touching the vendored processor's own output shape.

create table public.suites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

alter table public.suites enable row level security;

create policy "org members can read suites" on public.suites
  for select using (public.is_project_member(project_id, auth.uid()));

-- Any member can pre-create a suite in the portal; ingestion (service-role,
-- bypasses RLS) auto-creates one too if it sees a new suite name.
create policy "org members can create suites" on public.suites
  for insert with check (public.is_project_member(project_id, auth.uid()));

-- Branch-scoped main dashboard: executions on this branch (or with no
-- branch set at all, for backward compatibility with data ingested before
-- this column existed) merge into the vendored aggregate history; anything
-- else still gets recorded (see executions_meta/execution_tests below) but
-- stays out of the shared Overview numbers. Editable per-project later from
-- a settings surface that doesn't exist yet - this column just needs a
-- sane default now.
alter table public.projects add column if not exists main_branch text not null default 'main';

-- executions_meta: executionId -> { suiteId, branch, executedByEmail, executedAt }.
-- execution_tests: executionId -> TestSummary[] (processor/models.ts, reused
-- verbatim) - full per-execution test detail, not just the latest run's,
-- which the vendored history.ts never retained (see Phase 4's plan notes).
-- Both are trimmed to the same executionIds as the vendored `executions`
-- history on every ingest, so they don't grow unbounded.
alter table public.dashboard_data add column if not exists executions_meta jsonb not null default '{}'::jsonb;
alter table public.dashboard_data add column if not exists execution_tests jsonb not null default '{}'::jsonb;
