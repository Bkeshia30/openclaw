-- =====================================================================
-- SALON OS — reference schema
-- One spine (tenant → contact → event), six surfaces on top.
--
-- This is a READING artifact and a STARTING POINT, not a paste-and-go.
-- You will build it up across Days 3, 8, 9, 10, 12, 15, 17, 22, 25, 27.
-- Every real change ships as a numbered migration in supabase/migrations/.
-- =====================================================================

create extension if not exists "pgcrypto";    -- gen_random_uuid()
create extension if not exists "citext";      -- case-insensitive email
create extension if not exists "btree_gist";  -- REQUIRED for the no-double-booking constraint

-- =====================================================================
-- SPINE
-- =====================================================================

create table tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  timezone          text not null default 'America/New_York',  -- IANA name, never an offset
  currency          char(3) not null default 'usd',
  stripe_account_id text,
  quiet_hours_start time not null default '21:00',             -- no automated SMS after this
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
create index on profiles (tenant_id);

-- THE table. A lead and a customer are the same row at different lifecycle stages.
-- Funnel creates it. Ads source it. Booking converts it. CRM remembers it. Scheduler re-engages it.
create table contacts (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  first_name     text,
  last_name      text,
  email          citext,
  phone          text,                       -- E.164 only: +15551234567
  lifecycle      text not null default 'lead'
                 check (lifecycle in ('lead','qualified','customer','lapsed','blocked')),
  source         text,                       -- 'funnel:summer-locs' | 'ad:meta:23851' | 'walk-in' | 'referral'
  utm            jsonb not null default '{}',
  tags           text[] not null default '{}',
  consent_sms    boolean not null default false,
  consent_email  boolean not null default false,
  consent_at     timestamptz,
  opted_out_at   timestamptz,                -- set by STOP reply; automations MUST respect this
  ltv_cents      bigint not null default 0,  -- rolled up from payments
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now()
);
create unique index contacts_tenant_email_key on contacts (tenant_id, email) where email is not null;
create unique index contacts_tenant_phone_key on contacts (tenant_id, phone) where phone is not null;
create index on contacts (tenant_id, lifecycle);

-- Append-only. Never UPDATE, never DELETE. Feeds: the timeline, automations, and analytics.
create table events (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  type         text not null,               -- 'appointment.created', 'payment.succeeded', ...
  contact_id   uuid references contacts(id) on delete set null,
  subject_type text,                        -- 'appointment' | 'payment' | 'form_submission' | ...
  subject_id   uuid,
  payload      jsonb not null default '{}',
  dedupe_key   text unique,                 -- makes emit() safely retryable
  occurred_at  timestamptz not null default now()
);
create index on events (tenant_id, type, occurred_at desc);
create index on events (contact_id, occurred_at desc);

-- =====================================================================
-- BOOKING
-- =====================================================================

create table services (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  name                   text not null,
  description            text,
  duration_minutes       int  not null check (duration_minutes between 5 and 1440),
  buffer_before_minutes  int  not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes   int  not null default 15 check (buffer_after_minutes >= 0),
  price_cents            bigint not null check (price_cents >= 0),
  deposit_cents          bigint not null default 0 check (deposit_cents >= 0),
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  constraint deposit_not_over_price check (deposit_cents <= price_cents)
);
create index on services (tenant_id, active);

create table staff (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete set null,  -- null = staff who don't log in
  display_name text not null,
  active       boolean not null default true
);

create table staff_services (
  staff_id   uuid not null references staff(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Recurring weekly hours
create table availability_rules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  staff_id   uuid not null references staff(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time   time not null,
  constraint rule_times_ordered check (end_time > start_time)
);

-- One-off overrides: holidays, vacation, a late start, an extra Sunday
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
create unique index on availability_exceptions (staff_id, on_date);

create table appointments (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete restrict,
  staff_id            uuid not null references staff(id) on delete restrict,
  service_id          uuid not null references services(id) on delete restrict,

  -- blocked_* include buffers; starts/ends are what the customer sees
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  blocked_starts_at   timestamptz not null,
  blocked_ends_at     timestamptz not null,
  blocked_slot        tstzrange generated always as
                        (tstzrange(blocked_starts_at, blocked_ends_at, '[)')) stored,

  status              text not null default 'pending'
                      check (status in ('pending','confirmed','completed','cancelled','no_show')),
  price_cents         bigint not null check (price_cents >= 0),
  deposit_due_cents   bigint not null default 0,
  amount_paid_cents   bigint not null default 0,
  customer_note       text,
  internal_note       text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  created_at          timestamptz not null default now(),

  constraint appt_times_ordered  check (ends_at > starts_at),
  constraint appt_buffers_contain check (blocked_starts_at <= starts_at and blocked_ends_at >= ends_at)
);

-- ############ THE MOST IMPORTANT LINE IN THIS FILE ############
-- Application-level "is the slot free?" checks LOSE THE RACE when two customers
-- tap Book in the same second. This constraint does not. Postgres refuses the
-- second INSERT at the storage layer. Catch error code 23P01 and return
-- "that time was just taken" — that is your whole concurrency strategy.
alter table appointments
  add constraint appointments_no_double_booking
  exclude using gist (
    staff_id     with =,
    blocked_slot with &&
  ) where (status in ('pending','confirmed'));
-- ##############################################################

create index on appointments (tenant_id, starts_at);
create index on appointments (contact_id, starts_at desc);
create index on appointments (tenant_id, status, starts_at);

-- =====================================================================
-- PAYMENTS
-- =====================================================================

create table payments (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  contact_id         uuid references contacts(id) on delete set null,
  appointment_id     uuid references appointments(id) on delete set null,
  provider           text not null default 'stripe',
  provider_intent_id text not null,
  kind               text not null check (kind in ('deposit','balance','full','product','refund')),
  amount_cents       bigint not null,          -- negative for refunds
  fee_cents          bigint not null default 0,
  currency           char(3) not null default 'usd',
  status             text not null default 'pending'
                     check (status in ('pending','requires_action','succeeded','failed','refunded')),
  failure_reason     text,
  raw                jsonb not null default '{}',
  created_at         timestamptz not null default now()
);
create unique index on payments (provider, provider_intent_id, kind);
create index on payments (tenant_id, created_at desc);

-- The idempotency ledger. Stripe WILL deliver the same event more than once.
-- Insert here first; a unique violation means "already handled, return 200, do nothing."
create table webhook_events (
  id                text primary key,        -- provider event id, e.g. evt_1Abc...
  provider          text not null,
  type              text not null,
  payload           jsonb not null,
  status            text not null default 'received'
                    check (status in ('received','processed','failed')),
  error             text,
  received_at       timestamptz not null default now(),
  processed_at      timestamptz
);

-- =====================================================================
-- CRM
-- =====================================================================

create table pipelines (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name      text not null
);

create table pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name        text not null,
  position    int  not null,
  unique (pipeline_id, position)
);

create table deals (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  stage_id    uuid not null references pipeline_stages(id) on delete restrict,
  title       text not null,
  value_cents bigint not null default 0,
  status      text not null default 'open' check (status in ('open','won','lost')),
  lost_reason text,
  owner_id    uuid references profiles(id) on delete set null,
  next_action     text,
  next_action_at  timestamptz,               -- powers the "what do I do today" screen
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index on deals (tenant_id, status, next_action_at);

create table notes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  author_id  uuid references profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table message_templates (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key       text not null,                  -- 'booking.confirmation', 'reminder.24h', ...
  channel   text not null check (channel in ('sms','email')),
  subject   text,
  body      text not null,                  -- {{first_name}}, {{service_name}}, {{starts_at}}
  unique (tenant_id, key, channel)
);

create table messages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  channel             text not null check (channel in ('sms','email')),
  direction           text not null check (direction in ('inbound','outbound')),
  template_key        text,
  subject             text,
  body                text not null,
  status              text not null default 'queued'
                      check (status in ('queued','sent','delivered','failed','bounced','received')),
  provider_message_id text,
  error               text,
  scheduled_for       timestamptz,
  sent_at             timestamptz,
  automation_run_id   uuid,
  dedupe_key          text unique,          -- stops the same reminder going out twice
  created_at          timestamptz not null default now()
);
create index on messages (tenant_id, status, scheduled_for);
create index on messages (contact_id, created_at desc);

-- =====================================================================
-- FUNNEL
-- =====================================================================

create table funnels (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  slug       text not null,
  goal       text,                          -- 'book_consultation' | 'collect_lead'
  status     text not null default 'draft' check (status in ('draft','live','archived')),
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

-- blocks is an ARRAY OF TYPED BLOCKS, not freeform HTML. See Day 22.
-- draft_blocks is what you edit; published_blocks is what the public sees.
create table funnel_pages (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  funnel_id        uuid not null references funnels(id) on delete cascade,
  slug             text not null,
  position         int  not null default 0,
  title            text not null,
  seo              jsonb not null default '{}',
  draft_blocks     jsonb not null default '[]',
  published_blocks jsonb,
  published_at     timestamptz,
  unique (funnel_id, slug)
);

create table forms (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  funnel_page_id uuid references funnel_pages(id) on delete cascade,
  name           text not null,
  fields         jsonb not null default '[]',   -- [{key,label,type,required}]
  on_submit      jsonb not null default '{}'    -- {create_contact:true, tags:[], redirect:'/book'}
);

create table form_submissions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  form_id    uuid not null references forms(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  payload    jsonb not null default '{}',
  utm        jsonb not null default '{}',
  ip_hash    text,                              -- hashed, never raw IP
  created_at timestamptz not null default now()
);

create table page_views (
  id             bigint generated always as identity primary key,
  tenant_id      uuid not null references tenants(id) on delete cascade,
  funnel_page_id uuid not null references funnel_pages(id) on delete cascade,
  session_id     text not null,
  utm            jsonb not null default '{}',
  referrer       text,
  created_at     timestamptz not null default now()
);
create index on page_views (tenant_id, funnel_page_id, created_at desc);

-- =====================================================================
-- ADS
-- =====================================================================

create table ad_campaigns (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  funnel_id    uuid references funnels(id) on delete set null,
  name         text not null,
  platform     text not null check (platform in ('meta','tiktok','google','other')),
  objective    text,
  budget_cents bigint not null default 0,
  status       text not null default 'draft'
               check (status in ('draft','live','paused','ended')),
  external_id  text,                            -- Ads Manager id, pasted in by hand in v1
  utm_campaign text not null,                   -- how spend gets joined back to revenue
  created_at   timestamptz not null default now()
);

create table ad_creatives (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  campaign_id  uuid not null references ad_campaigns(id) on delete cascade,
  angle        text,                            -- 'time-saving' | 'social-proof' | 'price-anchor'
  headline     text not null,
  primary_text text not null,
  cta          text not null,
  media_url    text,
  generated_by text not null default 'ai' check (generated_by in ('ai','human')),
  status       text not null default 'draft'
               check (status in ('draft','approved','live','paused','rejected')),
  approved_by  uuid references profiles(id) on delete set null,
  approved_at  timestamptz,                     -- NOTHING goes live unapproved
  utm_content  text not null,                   -- per-creative attribution key
  created_at   timestamptz not null default now()
);

create table ad_metrics (
  id            bigint generated always as identity primary key,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  creative_id   uuid not null references ad_creatives(id) on delete cascade,
  on_date       date not null,
  impressions   bigint not null default 0,
  clicks        bigint not null default 0,
  spend_cents   bigint not null default 0,
  unique (creative_id, on_date)
);
-- leads / bookings / revenue are NOT stored here. They are derived by joining
-- events → contacts.utm → utm_content. One source of truth for money. See Day 26.

-- =====================================================================
-- SOCIAL SCHEDULER
-- =====================================================================

create table social_accounts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  platform            text not null check (platform in ('instagram','facebook','tiktok','x','linkedin')),
  external_account_id text not null,
  handle              text,
  token_ref           text not null,        -- pointer into Supabase Vault. NEVER the raw token.
  token_expires_at    timestamptz,
  scopes              text[] not null default '{}',
  status              text not null default 'connected'
                      check (status in ('connected','expired','revoked')),
  unique (tenant_id, platform, external_account_id)
);

create table posts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  caption     text not null,
  media       jsonb not null default '[]',
  hashtags    text[] not null default '{}',
  source      text not null default 'ai' check (source in ('ai','manual')),
  pillar      text,                          -- 'education' | 'proof' | 'offer' | 'personality'
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- One post fans out to many platforms; each target succeeds or fails independently.
create table post_targets (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  post_id           uuid not null references posts(id) on delete cascade,
  social_account_id uuid not null references social_accounts(id) on delete cascade,
  scheduled_for     timestamptz not null,
  status            text not null default 'queued'
                    check (status in ('queued','publishing','published','failed','manual_required')),
  external_post_id  text,
  attempts          int  not null default 0,
  error             text,
  published_at      timestamptz
);
create index on post_targets (tenant_id, status, scheduled_for);

-- =====================================================================
-- AUTOMATION
-- =====================================================================

create table automations (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  name             text not null,
  trigger_type     text not null,               -- an events.type value
  trigger_filter   jsonb not null default '{}',
  conditions       jsonb not null default '[]',
  actions          jsonb not null default '[]', -- [{type:'send_sms',...},{type:'wait',hours:24},...]
  enabled          boolean not null default false,
  requires_approval boolean not null default false,
  max_runs_per_contact_per_day int not null default 3,  -- the anti-spam / anti-loop governor
  created_at       timestamptz not null default now()
);

-- Durable execution. 'waiting' + resume_at is what makes "wait 24h, then follow up" survive
-- a deploy, a crash, or a restart. Without this table your automations are just setTimeout.
create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  automation_id uuid not null references automations(id) on delete cascade,
  event_id      bigint references events(id) on delete set null,
  contact_id    uuid references contacts(id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','running','waiting','succeeded','failed','skipped','cancelled')),
  step_index    int  not null default 0,
  resume_at     timestamptz,
  context       jsonb not null default '{}',
  skip_reason   text,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  unique (automation_id, event_id)          -- one event never fires one automation twice
);
create index on automation_runs (status, resume_at) where status = 'waiting';

-- =====================================================================
-- ROW LEVEL SECURITY — Day 4
-- Deny by default on EVERY table. No exceptions, including the ones you add later.
-- =====================================================================

create or replace function auth_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- Apply to every tenant-scoped table:
--   alter table <t> enable row level security;
--   alter table <t> force row level security;    -- applies to table owners too
--   create policy tenant_isolation on <t>
--     using (tenant_id = auth_tenant_id())
--     with check (tenant_id = auth_tenant_id());
--
-- Public surfaces (the booking page, funnel pages) do NOT get a loose policy.
-- They go through server-side routes using the service role, which scope the
-- tenant from the URL slug. The anon key must never be able to read contacts.
--
-- Day 6 is spent trying to break exactly this, from a second account.
