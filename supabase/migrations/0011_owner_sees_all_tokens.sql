-- "Owner can revoke anyone's token" (Phase 9) needs the owner to be able to
-- *see* other members' tokens first - the original SELECT policy
-- (0001_init.sql) was self-only (user_id = auth.uid()), which would leave
-- an owner with no way to discover what to revoke. Members/viewers still
-- only ever see their own; only owners see the whole project's tokens.
drop policy "members read their own tokens" on public.personal_access_tokens;
create policy "members see own tokens, owners see all" on public.personal_access_tokens
  for select using (user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()));
