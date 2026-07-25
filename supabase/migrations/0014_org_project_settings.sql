-- Closes a real gap: there was no UI to edit an org's or project's name/
-- slug/logo after creation - and the new inner `projects` table
-- (introduced in 0005_org_project_hierarchy.sql) never got an UPDATE
-- policy at all, so not even direct SQL could change a project's name/
-- slug/main_branch, let alone a UI. Also narrows organizations' UPDATE
-- policy from "any member" to "owner only" - it was left permissive back
-- in 0004_project_logos.sql before RBAC roles existed, with a comment
-- saying Phase 4 could narrow it later; that follow-up never happened
-- until now.

alter table public.projects add column if not exists logo_url text;

create or replace function public.is_org_owner(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = p_user_id and role = 'owner'
  );
$$;

-- Projects: no UPDATE policy existed at all until now. Reuses
-- is_project_owner() (0009_rbac_and_profile_name.sql).
create policy "org owners can update their project" on public.projects
  for update using (public.is_project_owner(id, auth.uid()))
  with check (public.is_project_owner(id, auth.uid()));

-- Organizations: narrow from "any member" to "owner only".
drop policy "members can update their organization" on public.organizations;
create policy "owners can update their organization" on public.organizations
  for update using (public.is_org_owner(id, auth.uid()))
  with check (public.is_org_owner(id, auth.uid()));

-- Org logo storage: narrow to owner, but also allow the org's *creator*
-- (organizations.created_by) - an admin creating an org on someone else's
-- behalf (NewOrgPage.tsx) isn't necessarily a member of that org at all
-- and needs to be able to attach a logo at creation time, before any
-- owner-only check would pass.
drop policy "members can upload their org logo" on storage.objects;
drop policy "members can replace their org logo" on storage.objects;
create policy "owners or creator can upload org logo" on storage.objects
  for insert with check (
    bucket_id = 'project-logos'
    and (
      public.is_org_owner((storage.foldername(name))[1]::uuid, auth.uid())
      or exists (
        select 1 from public.organizations
        where id = (storage.foldername(name))[1]::uuid and created_by = auth.uid()
      )
    )
  );
create policy "owners or creator can replace org logo" on storage.objects
  for update using (
    bucket_id = 'project-logos'
    and (
      public.is_org_owner((storage.foldername(name))[1]::uuid, auth.uid())
      or exists (
        select 1 from public.organizations
        where id = (storage.foldername(name))[1]::uuid and created_by = auth.uid()
      )
    )
  );

-- Project logo storage: same bucket, paths keyed by project id instead of
-- org id - no collision risk since uuids are unique across both tables.
create policy "project owners can upload project logo" on storage.objects
  for insert with check (
    bucket_id = 'project-logos'
    and public.is_project_owner((storage.foldername(name))[1]::uuid, auth.uid())
  );
create policy "project owners can replace project logo" on storage.objects
  for update using (
    bucket_id = 'project-logos'
    and public.is_project_owner((storage.foldername(name))[1]::uuid, auth.uid())
  );
