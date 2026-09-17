-- 0003 — Row Level Security. Deny by default on every tenant-scoped table.
--
-- Why this lives in the database and not in your app code: a bug in a query,
-- a forgotten .eq('tenant_id', ...), or a route you forgot to guard becomes a
-- data breach. With RLS, those same bugs return zero rows instead.

-- Resolves the caller's tenant from their profile row.
-- SECURITY DEFINER so it can read `profiles` regardless of the caller's own policies,
-- with an explicit search_path so it can't be hijacked by a shadowed table.
create or replace function auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from profiles where id = auth.uid()
$$;

revoke all on function auth_tenant_id() from public;
grant execute on function auth_tenant_id() to authenticated;

-- Applies the same deny-by-default policy to every tenant-scoped table.
-- Using a loop instead of 11 copy-pasted blocks means a new table can't get a
-- subtly different policy by accident.
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','events','services','staff','staff_services',
    'availability_rules','availability_exceptions','appointments'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- FORCE also applies RLS to the table's owner. Without it, anything connecting
    -- as the owning role silently sees everything.
    execute format('alter table %I force row level security', t);
    execute format($p$
      create policy tenant_isolation on %I
        as permissive for all
        to authenticated
        using      (tenant_id = auth_tenant_id())
        with check (tenant_id = auth_tenant_id())
    $p$, t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- `tenants` and `profiles` are scoped by their own id, not a tenant_id column.
alter table tenants enable row level security;
alter table tenants force  row level security;
create policy tenant_self on tenants
  as permissive for all to authenticated
  using      (id = auth_tenant_id())
  with check (id = auth_tenant_id());
grant select, update on tenants to authenticated;

alter table profiles enable row level security;
alter table profiles force  row level security;
create policy profile_same_tenant on profiles
  as permissive for all to authenticated
  using      (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());
grant select, insert, update on profiles to authenticated;

-- The anon key must never read business data. Public surfaces (the booking page,
-- funnel pages) go through server routes that scope the tenant from the URL slug.
revoke all on all tables in schema public from anon;

-- Guard: fails loudly if a future migration adds a table without RLS.
-- Day 6's test suite calls this, so a table added on Day 22 can't slip through.
create or replace function assert_rls_everywhere()
returns table (table_name text, problem text)
language sql
stable
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
