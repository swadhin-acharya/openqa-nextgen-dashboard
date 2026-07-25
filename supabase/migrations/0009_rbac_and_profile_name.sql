-- Phase 9: role enforcement (Owner/Member/Viewer) + a display name for
-- every account, since "executor" should show a name, not just an email.

-- ---------------------------------------------------------------------
-- 1. Widen org_members.role to include 'viewer'.
-- ---------------------------------------------------------------------
alter table public.org_members drop constraint project_members_role_check;
alter table public.org_members add constraint org_members_role_check
  check (role in ('owner', 'member', 'viewer'));

-- ---------------------------------------------------------------------
-- 2. profiles.name - captured at signup (see supabase.auth.signUp's
--    options.data.name in SignupPage.tsx), falls back to the email's
--    local part for accounts created before this existed.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists name text;
update public.profiles set name = split_part(email, '@', 1) where name is null;
alter table public.profiles alter column name set not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Role-gated token management. Only owner/member (not viewer) can
--    generate tokens; a token can be revoked by its own user or by any
--    owner of the project's org (no UPDATE policy existed on
--    personal_access_tokens before this - revocation didn't exist yet).
-- ---------------------------------------------------------------------
create or replace function public.is_project_owner(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where p.id = p_project_id and om.user_id = p_user_id and om.role = 'owner'
  );
$$;

create or replace function public.can_manage_tokens(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects p
    join public.org_members om on om.org_id = p.org_id
    where p.id = p_project_id and om.user_id = p_user_id and om.role in ('owner', 'member')
  );
$$;

drop policy "members create their own tokens for their projects" on public.personal_access_tokens;
create policy "owner/member create their own tokens" on public.personal_access_tokens
  for insert with check (user_id = auth.uid() and public.can_manage_tokens(project_id, auth.uid()));

create policy "self or project owner can revoke a token" on public.personal_access_tokens
  for update using (user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()))
  with check (user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()));
