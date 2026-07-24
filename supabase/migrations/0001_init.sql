-- OpenQA NextGen Dashboard — walking-skeleton demo schema.
-- Applies on top of Supabase's built-in `auth.users` table.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One row per (project, member). A project has many members; each member
-- belongs to exactly one row per project they're on.
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Personal Access Tokens: one member can hold many, each scoped to one
-- project. The raw token is never stored - only its hash and a display prefix.
create table public.personal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'default',
  token_prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index pat_hash_lookup on public.personal_access_tokens (token_hash)
  where revoked_at is null;

-- Canonical dashboard data for a project - jsonb columns mirror
-- processor/dashboard-data.ts's DashboardData interface field-for-field, one
-- row per project. failure_contributions mirrors the processor's internal
-- .failures-contributions.json bookkeeping (see processor/history.ts).
create table public.dashboard_data (
  project_id uuid primary key references public.projects(id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  executions jsonb not null default '[]'::jsonb,
  trends jsonb not null default '[]'::jsonb,
  features jsonb not null default '[]'::jsonb,
  tests jsonb not null default '[]'::jsonb,
  failures jsonb not null default '[]'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  environment jsonb not null default '{}'::jsonb,
  failure_contributions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.personal_access_tokens enable row level security;
alter table public.dashboard_data enable row level security;

-- projects: members can read; any authenticated user can create one for
-- themselves (they then self-insert as the 'owner' member - see below).
create policy "members can read their projects" on public.projects
  for select using (exists (
    select 1 from public.project_members pm
    where pm.project_id = projects.id and pm.user_id = auth.uid()
  ));

create policy "authenticated users can create a project" on public.projects
  for insert with check (owner_id = auth.uid());

-- project_members: members can see who else is on their projects; a user
-- may only ever insert a row for themselves (project creation flow).
create policy "members can read project membership" on public.project_members
  for select using (exists (
    select 1 from public.project_members pm2
    where pm2.project_id = project_members.project_id and pm2.user_id = auth.uid()
  ));

create policy "self-insert as member" on public.project_members
  for insert with check (user_id = auth.uid());

-- personal_access_tokens: a member can list/manage only their own tokens.
-- The raw token value is never persisted, so there is nothing sensitive to
-- protect beyond the hash (which is useless without the raw value anyway).
create policy "members read their own tokens" on public.personal_access_tokens
  for select using (user_id = auth.uid());

create policy "members create their own tokens for their projects"
  on public.personal_access_tokens for insert with check (
    user_id = auth.uid() and exists (
      select 1 from public.project_members pm
      where pm.project_id = project_id and pm.user_id = auth.uid()
    )
  );

-- dashboard_data: members can read their project's data. Deliberately NO
-- insert/update/delete policy for the authenticated/anon roles - with RLS
-- enabled and no matching policy, Postgres default-denies those operations.
-- The ingestion endpoint (api/ingest.ts) writes using the Supabase
-- service-role key, which bypasses RLS by design; the PAT hash lookup in
-- that endpoint is itself the authorization check for that write path, since
-- a PAT-authenticated request carries no Supabase user JWT at all.
create policy "members read their project's dashboard data"
  on public.dashboard_data for select using (exists (
    select 1 from public.project_members pm
    where pm.project_id = dashboard_data.project_id and pm.user_id = auth.uid()
  ));
