-- Introduces the Organization -> Project hierarchy for enterprise use:
-- dashboard.domain.com/<org-slug>/<project-slug>. Today's flat "project"
-- (dashboard.domain.com/<slug>) becomes an "organization"; a NEW, inner
-- "projects" table is what personal_access_tokens/dashboard_data actually
-- hang off now. Existing data ("resideo") is migrated, not dropped: it
-- becomes an org with one project inside it (same slug), keeping its
-- already-ingested PAT and dashboard_data rows intact.

-- ---------------------------------------------------------------------
-- 1. Rename the old flat "project" into "organization".
-- ---------------------------------------------------------------------
alter table public.projects rename to organizations;
alter table public.organizations add column if not exists created_by uuid references auth.users(id);
update public.organizations set created_by = owner_id where created_by is null;
comment on column public.organizations.owner_id is
  'Historical/provenance only - authorization uses org_members.role, not this column.';

alter table public.project_members rename to org_members;
alter table public.org_members rename column project_id to org_id;

-- ---------------------------------------------------------------------
-- 2. New inner "projects" table (org_id -> organizations, slug unique per org).
-- ---------------------------------------------------------------------
drop function if exists public.create_project(text, text);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

-- ---------------------------------------------------------------------
-- 3. Data migration: one default project per existing org, re-point
--    personal_access_tokens/dashboard_data at it instead of the org.
-- ---------------------------------------------------------------------
alter table public.personal_access_tokens drop constraint personal_access_tokens_project_id_fkey;
alter table public.dashboard_data drop constraint dashboard_data_project_id_fkey;

create temporary table _org_default_project_map as
with inserted as (
  insert into public.projects (org_id, slug, name)
  select id, slug, name from public.organizations
  returning org_id, id as project_id
)
select org_id, project_id from inserted;

update public.personal_access_tokens pat
set project_id = m.project_id
from _org_default_project_map m
where pat.project_id = m.org_id;

update public.dashboard_data dd
set project_id = m.project_id
from _org_default_project_map m
where dd.project_id = m.org_id;

drop table _org_default_project_map;

alter table public.personal_access_tokens
  add constraint personal_access_tokens_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;
alter table public.dashboard_data
  add constraint dashboard_data_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;

-- ---------------------------------------------------------------------
-- 4. Membership helper functions. is_org_member is new; is_project_member
--    is *redefined* (same name, same call sites in existing policies on
--    personal_access_tokens/dashboard_data - those don't need editing)
--    to resolve membership through the project's parent org instead of a
--    direct project_members row, since membership is org-level only now.
-- ---------------------------------------------------------------------
create or replace function public.is_org_member(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = p_user_id
  );
$$;

create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where p.id = p_project_id and om.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- 5. profiles: is_admin flag, one row per auth.users row, auto-populated
--    on signup. There is no admin yet after this migration runs - bootstrap
--    the current account by hand afterwards (see task notes), the same way
--    every other one-off/manual step this session has been done via psql.
--    (Created here, ahead of the policy fixes below, since one of them
--    checks profiles.is_admin.)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy "users read their own profile" on public.profiles
  for select using (id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. Fix up policies that now live on renamed tables or need to check
--    org membership instead of the old direct project membership.
-- ---------------------------------------------------------------------
drop policy "members can read their projects" on public.organizations;
create policy "members can read their organizations" on public.organizations
  for select using (public.is_org_member(id, auth.uid()));

drop policy "authenticated users can create a project" on public.organizations;
-- Organization creation now goes through create_organization() (admin-gated,
-- SECURITY DEFINER - bypasses RLS for its own insert). This raw-insert
-- policy is defense-in-depth for direct table access, not the normal path.
create policy "admins can create organizations" on public.organizations
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy "members can update their project" on public.organizations;
create policy "members can update their organization" on public.organizations
  for update using (public.is_org_member(id, auth.uid()))
  with check (public.is_org_member(id, auth.uid()));

drop policy "members can read project membership" on public.org_members;
create policy "members can read org membership" on public.org_members
  for select using (public.is_org_member(org_id, auth.uid()));

drop policy "self-insert as member" on public.org_members;
create policy "self-insert as org member" on public.org_members
  for insert with check (user_id = auth.uid());

-- personal_access_tokens/dashboard_data policies already call
-- is_project_member(project_id, auth.uid()) - unchanged text, new behavior
-- via the redefinition above, so nothing to drop/recreate there.

-- project-logos storage bucket was keyed by the old flat project id, which
-- is now the organization id (logo_url lives on organizations).
drop policy "members can upload their project logo" on storage.objects;
drop policy "members can replace their project logo" on storage.objects;
create policy "members can upload their org logo" on storage.objects
  for insert with check (
    bucket_id = 'project-logos'
    and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
create policy "members can replace their org logo" on storage.objects
  for update using (
    bucket_id = 'project-logos'
    and public.is_org_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- ---------------------------------------------------------------------
-- 6b. RLS for the new inner projects table.
-- ---------------------------------------------------------------------
alter table public.projects enable row level security;

create policy "org members can read projects" on public.projects
  for select using (public.is_org_member(org_id, auth.uid()));

-- Defense-in-depth alongside the create_project() RPC, same reasoning as
-- the organizations insert policy above.
create policy "org owners can create projects" on public.projects
  for insert with check (
    exists (
      select 1 from public.org_members
      where org_id = projects.org_id and user_id = auth.uid() and role = 'owner'
    )
  );

-- ---------------------------------------------------------------------
-- 7. Org/project creation RPCs.
-- ---------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_slug text, p_owner_email text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org public.organizations;
  owner_user_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Only admins can create organizations' using errcode = '42501';
  end if;

  select id into owner_user_id from public.profiles where email = p_owner_email;
  if owner_user_id is null then
    raise exception 'No account found for email %', p_owner_email using errcode = 'P0002';
  end if;

  insert into public.organizations (name, slug, owner_id, created_by)
  values (p_name, p_slug, owner_user_id, auth.uid())
  returning * into new_org;

  insert into public.org_members (org_id, user_id, role)
  values (new_org.id, owner_user_id, 'owner');

  return new_org;
end;
$$;

grant execute on function public.create_organization(text, text, text) to authenticated;

create or replace function public.create_project(p_org_id uuid, p_name text, p_slug text)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project public.projects;
begin
  if not exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the organization owner can create projects' using errcode = '42501';
  end if;

  insert into public.projects (org_id, name, slug)
  values (p_org_id, p_name, p_slug)
  returning * into new_project;

  return new_project;
end;
$$;

grant execute on function public.create_project(uuid, text, text) to authenticated;
