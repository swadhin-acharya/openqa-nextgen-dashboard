-- Per-project logo upload (Phase 1 of the Executions/RBAC/visual-polish plan).

alter table public.projects add column if not exists logo_url text;

-- No update policy exists on projects yet - needed so a member can set
-- logo_url after uploading. Deliberately permissive (any member, not just
-- owner) for now; Phase 4 (RBAC) can narrow this once roles are enforced
-- elsewhere too, rather than half-enforcing roles here first.
create policy "members can update their project" on public.projects
  for update using (public.is_project_member(id, auth.uid()))
  with check (public.is_project_member(id, auth.uid()));

insert into storage.buckets (id, name, public)
values ('project-logos', 'project-logos', true)
on conflict (id) do nothing;

-- Public bucket reads are served directly by Supabase's public object
-- endpoint (bypasses this policy) - this exists for completeness/any
-- authenticated-context reads, not what <img> tags actually hit.
create policy "public read project logos" on storage.objects
  for select using (bucket_id = 'project-logos');

-- Objects are stored as "<project_id>/logo.<ext>" - storage.foldername()
-- returns the path segments before the filename, so element 1 is the
-- project id. Reuses is_project_member() (see 0002_fix_rls_recursion.sql)
-- rather than duplicating the membership check.
create policy "members can upload their project logo" on storage.objects
  for insert with check (
    bucket_id = 'project-logos'
    and public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "members can replace their project logo" on storage.objects
  for update using (
    bucket_id = 'project-logos'
    and public.is_project_member((storage.foldername(name))[1]::uuid, auth.uid())
  );
