-- 0005 — tighten function grants flagged by the Supabase security advisor.
--
-- Supabase's default privileges grant EXECUTE on new functions to anon and
-- authenticated, so revoking from PUBLIC alone (as 0003 and 0004 did) left both
-- roles able to call these over the REST API. Revoke them explicitly.

create or replace function assert_rls_everywhere()
returns table (table_name text, problem text)
language sql
stable
set search_path = public, pg_catalog, pg_temp
as $$
  select c.relname::text,
         case when not c.relrowsecurity then 'RLS not enabled'
              when not c.relforcerowsecurity then 'RLS not forced'
              else 'no policy defined' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and (not c.relrowsecurity
         or not c.relforcerowsecurity
         or not exists (select 1 from pg_policy p where p.polrelid = c.oid))
$$;
revoke all on function assert_rls_everywhere() from public, anon, authenticated;

-- auth_tenant_id() MUST stay executable by `authenticated`.
--
-- An RLS policy expression runs with the privileges of the QUERYING role, not
-- the policy's. Revoking this from `authenticated` does not harden anything —
-- it makes every policy raise "permission denied for function auth_tenant_id",
-- so the signed-in owner can read nothing at all and every page 500s.
-- Caught by tests/tenancy/isolation.test.ts.
--
-- anon is a different matter: no policy targets `to anon`, and 0003 revoked
-- anon's access to every table, so anon has no reason to resolve a tenant.
revoke execute on function auth_tenant_id() from public, anon;
grant execute on function auth_tenant_id() to authenticated;

-- book_appointment is reached ONLY through the /book server action, which runs
-- with the service role and validates its input with zod first. Leaving it
-- callable by anon would let anyone POST straight to
-- /rest/v1/rpc/book_appointment and skip that validation entirely.
revoke execute on function book_appointment(
  text, uuid, uuid, timestamptz, text, text, citext, text, text, boolean, boolean
) from public, anon, authenticated;

grant execute on function book_appointment(
  text, uuid, uuid, timestamptz, text, text, citext, text, text, boolean, boolean
) to service_role;
