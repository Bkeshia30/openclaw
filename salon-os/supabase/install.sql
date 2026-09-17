-- ============================================================================
--  SALON OS — COMPLETE INSTALL
--
--  Paste this whole file into the Supabase SQL Editor and press Run. Once.
--
--  BEFORE YOU RUN IT: sign in at your site's /login page one time, so your
--  user exists. This script finds you automatically after that.
--
--  The ONLY thing you may want to change is the salon name on the next line.
-- ============================================================================


-- ---------------------------------------------------------------- 0001_spine.sql
-- 0001 — the spine: tenants, profiles, contacts, events.
-- Every surface of the product reads and writes these four tables.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "btree_gist";   -- required by 0003 for the no-double-booking constraint

create table if not exists tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  timezone          text not null default 'America/New_York',   -- IANA name, never a fixed offset
  currency          char(3) not null default 'usd',
  stripe_account_id text,
  quiet_hours_start time not null default '21:00',
  quiet_hours_end   time not null default '09:00',
  created_at        timestamptz not null default now()
);

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner','manager','staff')),
  full_name  text,
  created_at timestamptz not null default now()
);
create index if not exists profiles_tenant_idx on profiles (tenant_id);

-- A lead and a customer are the SAME ROW at different lifecycle stages.
-- The funnel creates it, ads source it, booking converts it, CRM remembers it.
create table if not exists contacts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  first_name    text,
  last_name     text,
  email         citext,
  phone         text,                       -- E.164 only: +15551234567
  lifecycle     text not null default 'lead'
                check (lifecycle in ('lead','qualified','customer','lapsed','blocked')),
  source        text,
  utm           jsonb not null default '{}',
  tags          text[] not null default '{}',
  consent_sms   boolean not null default false,
  consent_email boolean not null default false,
  consent_at    timestamptz,
  opted_out_at  timestamptz,                -- set by a STOP reply; automations must respect it
  ltv_cents     bigint not null default 0,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
-- Partial unique: two contacts may both have a null email, but not the same email.
create unique index if not exists contacts_tenant_email_key on contacts (tenant_id, email) where email is not null;
-- Email is unique per tenant: it is a strong identity claim.
-- Phone deliberately is NOT unique. A mother and daughter booking from the same
-- number are two clients, and a unique index here would reject the second one at
-- the booking form. The cost of that choice is possible duplicate contacts for
-- phone-only records, which is an operator "merge" action, not a hard failure.
create index if not exists contacts_tenant_phone_idx on contacts (tenant_id, phone) where phone is not null;
create index if not exists contacts_tenant_lifecycle_idx on contacts (tenant_id, lifecycle);
create index if not exists contacts_tenant_created_idx on contacts (tenant_id, created_at desc, id desc);

-- Append-only. Feeds three features from one table:
-- the contact timeline, the automation triggers, and analytics.
create table if not exists events (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  type         text not null,
  contact_id   uuid references contacts(id) on delete set null,
  subject_type text,
  subject_id   uuid,
  payload      jsonb not null default '{}',
  dedupe_key   text unique,                 -- makes emit() safely retryable
  occurred_at  timestamptz not null default now()
);
create index if not exists events_tenant_type_idx on events (tenant_id, type, occurred_at desc);
create index if not exists events_contact_idx on events (contact_id, occurred_at desc);

-- ---------------------------------------------------------------- 0002_booking.sql
-- 0002 — booking: services, staff, availability, appointments.

create table if not exists services (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  name                  text not null,
  description           text,
  duration_minutes      int not null check (duration_minutes between 5 and 1440),
  buffer_before_minutes int not null default 0  check (buffer_before_minutes between 0 and 480),
  buffer_after_minutes  int not null default 15 check (buffer_after_minutes  between 0 and 480),
  price_cents           bigint not null check (price_cents >= 0),
  deposit_cents         bigint not null default 0 check (deposit_cents >= 0),
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  constraint deposit_not_over_price check (deposit_cents <= price_cents)
);
create index if not exists services_tenant_active_idx on services (tenant_id, active);

create table if not exists staff (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete set null,   -- null = staff who never log in
  display_name text not null,
  active       boolean not null default true
);
create index if not exists staff_tenant_idx on staff (tenant_id, active);

create table if not exists staff_services (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references staff(id)    on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Recurring weekly hours. Times are WALL CLOCK in the tenant's timezone.
create table if not exists availability_rules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references staff(id) on delete cascade,
  weekday    int not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  constraint rule_times_ordered check (end_time > start_time)
);
create index if not exists availability_rules_staff_idx on availability_rules (staff_id, weekday);

-- One-off overrides: holidays, vacation, a late start, an extra Sunday.
create table if not exists availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references staff(id) on delete cascade,
  on_date    date not null,
  is_closed  boolean not null default true,
  start_time time,
  end_time   time,
  reason     text,
  constraint exception_shape check (
    (is_closed and start_time is null and end_time is null)
    or (not is_closed and start_time is not null and end_time is not null and end_time > start_time)
  )
);
create unique index if not exists availability_exceptions_staff_date_key on availability_exceptions (staff_id, on_date);

create table if not exists appointments (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete restrict,
  staff_id            uuid not null references staff(id)    on delete restrict,
  service_id          uuid not null references services(id) on delete restrict,

  -- starts/ends is what the customer sees. blocked_* includes buffers and is what
  -- actually reserves the stylist's time.
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  blocked_starts_at timestamptz not null,
  blocked_ends_at   timestamptz not null,
  blocked_slot      tstzrange generated always as
                      (tstzrange(blocked_starts_at, blocked_ends_at, '[)')) stored,

  status              text not null default 'pending'
                      check (status in ('pending','confirmed','completed','cancelled','no_show')),
  price_cents         bigint not null check (price_cents >= 0),
  deposit_due_cents   bigint not null default 0 check (deposit_due_cents >= 0),
  amount_paid_cents   bigint not null default 0 check (amount_paid_cents >= 0),
  customer_note       text,
  internal_note       text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz not null default now(),

  constraint appt_times_ordered   check (ends_at > starts_at),
  constraint appt_buffers_contain check (blocked_starts_at <= starts_at and blocked_ends_at >= ends_at)
);

-- ###################################################################
-- THE MOST IMPORTANT LINE IN THIS SCHEMA.
--
-- Two customers tap "Book" on the last 2pm slot in the same second.
-- Both requests run "is 2pm free?" -> both get yes -> both INSERT.
-- No amount of careful application code fixes that, because neither
-- request can see the other. Only the database sees both writes.
--
-- This constraint makes the second INSERT fail at the storage layer with
-- SQLSTATE 23P01. Catching that and saying "just taken, pick another"
-- IS the entire concurrency strategy. No locks, no queues, no retries.
--
-- The WHERE clause is why cancelling frees the slot: a cancelled row
-- stops participating in the constraint entirely.
-- ###################################################################
do $ddl$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_no_double_booking') then
    alter table appointments add constraint appointments_no_double_booking
  exclude using gist (
    staff_id     with =,
    blocked_slot with &&
  ) where (status in ('pending','confirmed'));
  end if;
end $ddl$;

create index if not exists appointments_tenant_start_idx  on appointments (tenant_id, starts_at);
create index if not exists appointments_contact_idx       on appointments (contact_id, starts_at desc);
create index if not exists appointments_tenant_status_idx on appointments (tenant_id, status, starts_at);

-- ---------------------------------------------------------------- 0003_rls.sql
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
    execute format('drop policy if exists tenant_isolation on %I', t);
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
drop policy if exists tenant_self on tenants;
create policy tenant_self on tenants
  as permissive for all to authenticated
  using      (id = auth_tenant_id())
  with check (id = auth_tenant_id());
grant select, update on tenants to authenticated;

alter table profiles enable row level security;
alter table profiles force  row level security;
drop policy if exists profile_same_tenant on profiles;
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

-- ---------------------------------------------------------------- 0004_book_appointment.sql
-- 0004 — the booking transaction.
--
-- This lives in the database rather than in TypeScript for three reasons:
--   1. Atomicity. Contact upsert + appointment insert + event emit either all
--      happen or none do. A failed booking cannot leave an orphan contact behind.
--   2. The price, duration and buffers are READ FROM THE DATABASE. A caller who
--      posts {"price_cents": 1} is ignored, because the caller's price is never
--      consulted at all.
--   3. The exclusion constraint on `appointments` does the conflict detection, so
--      there is no check-then-insert window for two customers to race through.

create or replace function book_appointment(
  p_tenant_slug  text,
  p_service_id   uuid,
  p_staff_id     uuid,
  p_starts_at    timestamptz,
  p_first_name   text,
  p_last_name    text,
  p_email        citext,
  p_phone        text,
  p_note         text default null,
  p_consent_sms   boolean default false,
  p_consent_email boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant     tenants%rowtype;
  v_service    services%rowtype;
  v_contact_id uuid;
  v_ends       timestamptz;
  v_blocked_start timestamptz;
  v_blocked_end   timestamptz;
  v_appt_id    uuid;
begin
  if p_email is null and p_phone is null then
    raise exception 'a contact must have an email or a phone' using errcode = '22023';
  end if;

  select * into v_tenant from tenants where slug = p_tenant_slug;
  if not found then
    raise exception 'unknown tenant' using errcode = '22023';
  end if;

  -- Scoped by tenant: passing another tenant's service id finds nothing.
  select * into v_service
    from services
   where id = p_service_id and tenant_id = v_tenant.id and active;
  if not found then
    raise exception 'unknown or inactive service' using errcode = '22023';
  end if;

  if not exists (
    select 1 from staff s
      join staff_services ss on ss.staff_id = s.id
     where s.id = p_staff_id and s.tenant_id = v_tenant.id and s.active
       and ss.service_id = v_service.id
  ) then
    raise exception 'that stylist does not offer this service' using errcode = '22023';
  end if;

  if p_starts_at <= now() then
    raise exception 'cannot book a time in the past' using errcode = '22023';
  end if;

  -- Derived here, never accepted from the caller.
  v_ends          := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_blocked_start := p_starts_at - make_interval(mins => v_service.buffer_before_minutes);
  v_blocked_end   := v_ends      + make_interval(mins => v_service.buffer_after_minutes);

  -- Identity resolution, in priority order:
  --   1. same email  -> definitely the same person, reuse
  --   2. no email given, same phone -> probably the same person, reuse the most recent
  --   3. otherwise   -> a new person, even if the phone matches someone else
  -- Giving email priority is what lets a daughter book from her mother's phone
  -- and get her own record instead of being merged into her mother's history.
  loop
    if p_email is not null then
      select id into v_contact_id
        from contacts where tenant_id = v_tenant.id and email = p_email limit 1;
    else
      select id into v_contact_id
        from contacts where tenant_id = v_tenant.id and phone = p_phone
        order by coalesce(last_seen_at, created_at) desc limit 1;
    end if;

    if v_contact_id is not null then
      -- Fill in blanks only. Never overwrite what the salon already knows about
      -- someone because of what was typed into a public form.
      update contacts
         set last_seen_at   = now(),
             first_name     = coalesce(first_name, p_first_name),
             last_name      = coalesce(last_name,  p_last_name),
             phone          = coalesce(phone,      p_phone),
             consent_sms    = consent_sms   or p_consent_sms,
             consent_email  = consent_email or p_consent_email,
             consent_at     = coalesce(consent_at,
                                case when p_consent_sms or p_consent_email then now() end)
       where id = v_contact_id;
      exit;
    end if;

    begin
      insert into contacts (tenant_id, first_name, last_name, email, phone,
                            consent_sms, consent_email, consent_at, last_seen_at, source)
      values (v_tenant.id, p_first_name, p_last_name, p_email, p_phone,
              p_consent_sms, p_consent_email,
              case when p_consent_sms or p_consent_email then now() end, now(), 'booking')
      returning id into v_contact_id;
      exit;
    exception when unique_violation then
      -- Someone inserted this same person between our SELECT and our INSERT.
      -- Loop around and read their row instead of failing the booking.
      v_contact_id := null;
    end;
  end loop;

  -- If the slot is gone, this raises SQLSTATE 23P01 and the whole function rolls
  -- back — including the contact upsert above. The application maps 23P01 to
  -- "that time was just taken". That is the entire concurrency strategy.
  insert into appointments (
    tenant_id, contact_id, staff_id, service_id,
    starts_at, ends_at, blocked_starts_at, blocked_ends_at,
    status, price_cents, deposit_due_cents, customer_note
  ) values (
    v_tenant.id, v_contact_id, p_staff_id, v_service.id,
    p_starts_at, v_ends, v_blocked_start, v_blocked_end,
    'pending', v_service.price_cents, v_service.deposit_cents, p_note
  )
  returning id into v_appt_id;

  insert into events (tenant_id, type, contact_id, subject_type, subject_id, payload, dedupe_key)
  values (v_tenant.id, 'appointment.created', v_contact_id, 'appointment', v_appt_id,
          jsonb_build_object(
            'service_id', v_service.id, 'staff_id', p_staff_id,
            'starts_at', p_starts_at, 'price_cents', v_service.price_cents,
            'deposit_due_cents', v_service.deposit_cents),
          'appointment.created:' || v_appt_id::text);

  return v_appt_id;
end;
$$;

revoke all on function book_appointment(text, uuid, uuid, timestamptz, text, text, citext, text, text, boolean, boolean) from public;
grant execute on function book_appointment(text, uuid, uuid, timestamptz, text, text, citext, text, text, boolean, boolean) to anon, authenticated;

-- Cancelling frees the slot: the exclusion constraint is partial on status, so a
-- cancelled row stops participating in it entirely.
create or replace function cancel_appointment(p_appointment_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker            -- runs as the caller, so RLS still applies
set search_path = public, pg_temp
as $$
declare v_appt appointments%rowtype;
begin
  update appointments
     set status = 'cancelled', cancelled_at = now(), cancellation_reason = p_reason
   where id = p_appointment_id and status in ('pending','confirmed')
  returning * into v_appt;

  if not found then
    raise exception 'appointment not found or not cancellable' using errcode = '22023';
  end if;

  insert into events (tenant_id, type, contact_id, subject_type, subject_id, payload, dedupe_key)
  values (v_appt.tenant_id, 'appointment.cancelled', v_appt.contact_id, 'appointment', v_appt.id,
          jsonb_build_object('reason', p_reason),
          'appointment.cancelled:' || v_appt.id::text);
end;
$$;

-- ---------------------------------------------------------------- 0005_harden_function_grants.sql
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
