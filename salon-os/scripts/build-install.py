import re, io

import re

header = """-- ============================================================================
--  SALON OS — COMPLETE INSTALL
--
--  Paste this whole file into the Supabase SQL Editor and press Run. Once.
--
--  BEFORE YOU RUN IT: sign in at your site's /login page one time, so your
--  user exists. This script finds you automatically after that.
--
--  The ONLY thing you may want to change is the salon name on the next line.
-- ============================================================================

\\set ON_ERROR_STOP on

"""

parts = []
def idempotent(sql):
    """A migration runs once. This installer may be run twice by a human who
    ran it too early, so every statement here has to tolerate a second pass."""
    sql = re.sub(r"(?m)^create table (?!if not exists)", "create table if not exists ", sql)
    sql = re.sub(r"(?m)^create index (?!if not exists)", "create index if not exists ", sql)
    sql = re.sub(r"(?m)^create unique index (?!if not exists)", "create unique index if not exists ", sql)
    # An ALTER ... ADD CONSTRAINT has no IF NOT EXISTS form, so guard it.
    sql = re.sub(
        r"(?ms)^alter table appointments\n  add constraint appointments_no_double_booking\n(.*?);",
        lambda m: (
            "do $ddl$\nbegin\n"
            "  if not exists (select 1 from pg_constraint where conname = 'appointments_no_double_booking') then\n"
            "    alter table appointments add constraint appointments_no_double_booking\n"
            + m.group(1) + ";\n"
            "  end if;\nend $ddl$;"
        ),
        sql)
    # Re-creating a policy that exists is an error; drop it first.
    sql = sql.replace(
        "    execute format($p$\n      create policy tenant_isolation on %I",
        "    execute format('drop policy if exists tenant_isolation on %I', t);\n"
        "    execute format($p$\n      create policy tenant_isolation on %I")
    sql = sql.replace("create policy tenant_self on tenants",
                      "drop policy if exists tenant_self on tenants;\ncreate policy tenant_self on tenants")
    sql = sql.replace("create policy profile_same_tenant on profiles",
                      "drop policy if exists profile_same_tenant on profiles;\ncreate policy profile_same_tenant on profiles")
    return sql

for f in ["0001_spine.sql", "0002_booking.sql", "0003_rls.sql", "0004_book_appointment.sql"]:
    body = idempotent(open("supabase/migrations/" + f).read())
    parts.append("-- ---------------------------------------------------------------- " + f + "\n" + body.strip() + "\n")

setup = """
-- ---------------------------------------------------------------- your salon

do $$
declare
  -- ############ CHANGE THIS ONE LINE (optional) ############
  salon_name text := 'My Salon';
  salon_tz   text := 'America/New_York';   -- your timezone, IANA format
  -- ########################################################

  salon_slug  text;
  v_user_id   uuid;
  v_email     text;
  v_tenant_id uuid;
  v_staff_id  uuid;
  v_count     int;
begin
  -- Find you. If you have signed in once, there is exactly one user.
  select count(*) into v_count from auth.users;
  if v_count = 0 then
    raise exception
      'No user yet. Open your site, sign in at /login, then run this file again.';
  elsif v_count > 1 then
    select id, email into v_user_id, v_email from auth.users order by created_at limit 1;
    raise notice 'Several users found; using the oldest (%).', v_email;
  else
    select id, email into v_user_id, v_email from auth.users;
  end if;

  -- Booking-page address, derived from the salon name: "Kesh's Studio" -> "keshs-studio"
  salon_slug := trim(both '-' from regexp_replace(lower(salon_name), '[^a-z0-9]+', '-', 'g'));
  if salon_slug = '' then salon_slug := 'salon'; end if;

  insert into tenants (name, slug, timezone)
  values (salon_name, salon_slug, salon_tz)
  on conflict (slug) do update set name = excluded.name, timezone = excluded.timezone
  returning id into v_tenant_id;

  insert into profiles (id, tenant_id, role, full_name)
  values (v_user_id, v_tenant_id, 'owner', split_part(v_email, '@', 1))
  on conflict (id) do update set tenant_id = excluded.tenant_id, role = 'owner';

  select id into v_staff_id from staff where tenant_id = v_tenant_id and profile_id = v_user_id;
  if v_staff_id is null then
    insert into staff (tenant_id, profile_id, display_name)
    values (v_tenant_id, v_user_id, split_part(v_email, '@', 1))
    returning id into v_staff_id;
  end if;

  -- Starter hours: Tuesday to Saturday, 9 to 6. Change them on the Hours page.
  if not exists (select 1 from availability_rules where staff_id = v_staff_id) then
    insert into availability_rules (tenant_id, staff_id, weekday, start_time, end_time)
    select v_tenant_id, v_staff_id, d, '09:00', '18:00' from unnest(array[2,3,4,5,6]) as d;
  end if;

  -- Starter services so the booking page is not empty. Edit or delete them on
  -- the Services page — these are a starting point, not a guess at your prices.
  if not exists (select 1 from services where tenant_id = v_tenant_id) then
    insert into services (tenant_id, name, duration_minutes, buffer_after_minutes, price_cents, deposit_cents)
    values
      (v_tenant_id, 'Loc Retwist',    120, 15, 12000, 3000),
      (v_tenant_id, 'Retwist + Style',180, 15, 16500, 4000),
      (v_tenant_id, 'Starter Locs',   240, 30, 25000, 7500),
      (v_tenant_id, 'Knotless Braids',300, 30, 28000, 8000);
  end if;

  -- Link every service to you, or none of them show up on the booking page.
  insert into staff_services (tenant_id, staff_id, service_id)
  select v_tenant_id, v_staff_id, s.id from services s
   where s.tenant_id = v_tenant_id
     and not exists (
       select 1 from staff_services x where x.staff_id = v_staff_id and x.service_id = s.id
     );

  raise notice '=====================================================';
  raise notice ' Done. Your booking page is at  /book/%', salon_slug;
  raise notice ' Signed-in owner: %', v_email;
  raise notice '=====================================================';
end $$;
"""

open("supabase/install.sql", "w").write(header + "\n".join(parts) + setup)
print("install.sql written")
