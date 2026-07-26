-- Hard-delete is only ever allowed for tokens that have already been
-- revoked (see the "Delete" action in TokensPage.tsx). An active token must
-- go through revoke first, so revoked_at always answers "when was this
-- credential deactivated" - this policy just lets a user clean up rows for
-- credentials that are already dead. Mirrors the ownership check already
-- used by the update ("revoke") policy in 0009_rbac_and_profile_name.sql.
create policy "self or project owner can delete a revoked token"
  on public.personal_access_tokens for delete
  using (
    revoked_at is not null
    and (user_id = auth.uid() or public.is_project_owner(project_id, auth.uid()))
  );
