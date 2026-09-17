-- 0001 — the spine: tenants, profiles, contacts, events.
-- Every surface of the product reads and writes these four tables.

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "btree_gist";   -- required by 0003 for the no-double-booking constraint

create table tenants (
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

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references tenants(id) on delete cascade,
  role       text not null default 'staff' check (role in ('owner','manager','staff')),
  full_name  text,
  created_at timestamptz not null default now()
);
create index profiles_tenant_idx on profiles (tenant_id);

-- A lead and a customer are the SAME ROW at different lifecycle stages.
-- The funnel creates it, ads source it, booking converts it, CRM remembers it.
create table contacts (
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
create unique index contacts_tenant_email_key on contacts (tenant_id, email) where email is not null;
-- Email is unique per tenant: it is a strong identity claim.
-- Phone deliberately is NOT unique. A mother and daughter booking from the same
-- number are two clients, and a unique index here would reject the second one at
-- the booking form. The cost of that choice is possible duplicate contacts for
-- phone-only records, which is an operator "merge" action, not a hard failure.
create index contacts_tenant_phone_idx on contacts (tenant_id, phone) where phone is not null;
create index contacts_tenant_lifecycle_idx on contacts (tenant_id, lifecycle);
create index contacts_tenant_created_idx on contacts (tenant_id, created_at desc, id desc);

-- Append-only. Feeds three features from one table:
-- the contact timeline, the automation triggers, and analytics.
create table events (
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
create index events_tenant_type_idx on events (tenant_id, type, occurred_at desc);
create index events_contact_idx on events (contact_id, occurred_at desc);
