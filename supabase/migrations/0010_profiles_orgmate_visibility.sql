-- OrgMembersPage needs to show every member's name/email, not just the
-- caller's own (the existing "users read their own profile" policy from
-- 0005 only allows id = auth.uid()). Scoped to people who actually share an
-- org with the caller - not a blanket "any authenticated user can read any
-- profile" policy - so a user who isn't a member anywhere still can't be
-- looked up this way (that's why api/members.ts's "add by email" goes
-- through the service-role client instead, not this policy).
create policy "members can read profiles of their org-mates" on public.profiles
  for select using (
    exists (
      select 1 from public.org_members om1
      join public.org_members om2 on om1.org_id = om2.org_id
      where om1.user_id = auth.uid() and om2.user_id = profiles.id
    )
  );
