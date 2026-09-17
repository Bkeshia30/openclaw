-- 0002 — booking: services, staff, availability, appointments.

create table services (
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
create index services_tenant_active_idx on services (tenant_id, active);

create table staff (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete set null,   -- null = staff who never log in
  display_name text not null,
  active       boolean not null default true
);
create index staff_tenant_idx on staff (tenant_id, active);

create table staff_services (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references staff(id)    on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Recurring weekly hours. Times are WALL CLOCK in the tenant's timezone.
create table availability_rules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references staff(id) on delete cascade,
  weekday    int not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  constraint rule_times_ordered check (end_time > start_time)
);
create index availability_rules_staff_idx on availability_rules (staff_id, weekday);

-- One-off overrides: holidays, vacation, a late start, an extra Sunday.
create table availability_exceptions (
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
create unique index availability_exceptions_staff_date_key on availability_exceptions (staff_id, on_date);

create table appointments (
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
alter table appointments
  add constraint appointments_no_double_booking
  exclude using gist (
    staff_id     with =,
    blocked_slot with &&
  ) where (status in ('pending','confirmed'));

create index appointments_tenant_start_idx  on appointments (tenant_id, starts_at);
create index appointments_contact_idx       on appointments (contact_id, starts_at desc);
create index appointments_tenant_status_idx on appointments (tenant_id, status, starts_at);
