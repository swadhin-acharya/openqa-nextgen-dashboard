-- 0001_init.sql's "members can read project membership" policy queried
-- project_members from within a policy ON project_members itself, which
-- Postgres detects as infinite recursion (42P17) at query time - it's not a
-- static analysis issue, so it wasn't caught until we hit the live API.
--
-- Standard fix: a SECURITY DEFINER helper function. Its internal query runs
-- as the function owner and bypasses RLS on project_members (no FORCE ROW
-- LEVEL SECURITY was set on that table), breaking the self-referential loop.
-- Used everywhere a policy needs to check "is auth.uid() a member of this
-- project" so there's one place this logic lives, not four copies.
create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = p_user_id
  );
$$;

drop policy "members can read their projects" on public.projects;
create policy "members can read their projects" on public.projects
  for select using (public.is_project_member(projects.id, auth.uid()));

drop policy "members can read project membership" on public.project_members;
create policy "members can read project membership" on public.project_members
  for select using (public.is_project_member(project_members.project_id, auth.uid()));

drop policy "members create their own tokens for their projects" on public.personal_access_tokens;
create policy "members create their own tokens for their projects"
  on public.personal_access_tokens for insert with check (
    user_id = auth.uid() and public.is_project_member(project_id, auth.uid())
  );

drop policy "members read their project's dashboard data" on public.dashboard_data;
create policy "members read their project's dashboard data"
  on public.dashboard_data for select using (public.is_project_member(dashboard_data.project_id, auth.uid()));
