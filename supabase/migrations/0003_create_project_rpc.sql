-- NewProjectPage.tsx did two sequential client-side inserts (projects, then
-- project_members). This surfaced a real bug: `INSERT ... RETURNING` (which
-- `.select().single()` triggers) also re-checks the table's SELECT policy on
-- the newly inserted row, and "members can read their projects" requires a
-- matching project_members row - which didn't exist yet at that point in the
-- sequence. Confirmed directly against the live DB: the same insert succeeds
-- when nothing is returned, and fails with "new row violates row-level
-- security policy" the moment RETURNING is added, even though the INSERT's
-- own WITH CHECK (owner_id = auth.uid()) evaluates true on its own.
--
-- Fix: one SECURITY DEFINER function doing both inserts atomically. Its
-- internal inserts run as the function owner and bypass RLS (no FORCE ROW
-- LEVEL SECURITY set), and a function's return value is a plain value, not
-- a table read, so it's never subject to the caller's SELECT policy at all -
-- this sidesteps the RETURNING/SELECT-policy interaction entirely, and as a
-- bonus makes project creation atomic instead of two independent requests.
create or replace function public.create_project(p_name text, p_slug text)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project public.projects;
begin
  insert into public.projects (name, slug, owner_id)
  values (p_name, p_slug, auth.uid())
  returning * into new_project;

  insert into public.project_members (project_id, user_id, role)
  values (new_project.id, auth.uid(), 'owner');

  return new_project;
end;
$$;

grant execute on function public.create_project(text, text) to authenticated;
