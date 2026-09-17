# Salon OS

Booking, CRM, payments, funnels, ads and content scheduling on **one spine**:
`tenant → contact → event`.

Built alongside the 30-day curriculum in [`../founder-os/`](../founder-os/). This directory is
Days 1–10 of that plan, working and tested.

---

## What works today

| Area | State |
|---|---|
| Multi-tenant schema with RLS on every table | ✅ tested |
| Magic-link auth | ✅ |
| Contacts list + detail with an event-driven timeline | ✅ |
| Availability rules, date exceptions, DST-correct slot generation | ✅ 14 tests |
| Booking with **structurally impossible** double-booking | ✅ 13 tests |
| Public booking page | ✅ |
| Payments, messaging, automations, funnels, ads, scheduler | ⬜ Days 12–28 |

**38 tests, all passing**, including a 20-way concurrency race and a full tenant-isolation suite.

---

## Setup

**1. Install and configure**

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase keys
```

`.env.local` is gitignored. Confirm that before your first commit — a leaked
`SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy in this repo and is a full breach.

**2. Apply the migrations to your Supabase project**

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Or paste `supabase/migrations/*.sql` into the SQL editor **in filename order**.
Do not apply `tests/setup/0000_local_shim.sql` — Supabase already provides everything in it.

**3. Create your tenant and your login**

```sql
insert into tenants (name, slug, timezone)
values ('Your Salon', 'yoursalon', 'America/New_York');

-- After signing in once at /login so auth.users has your row:
insert into profiles (id, tenant_id, role, full_name)
select u.id, t.id, 'owner', 'Your Name'
from auth.users u, tenants t
where u.email = 'you@example.com' and t.slug = 'yoursalon';
```

**4. Run it**

```bash
npm run dev        # http://localhost:3000
```

Your public booking page is at `/book/yoursalon`.

---

## Tests

The suite runs against a **real Postgres**, because the guarantees being tested are
Postgres guarantees. A mock cannot tell you whether an exclusion constraint works.

```bash
# one-time local Postgres
sudo apt-get install -y postgresql-16
sudo -u postgres /usr/lib/postgresql/16/bin/initdb -D /tmp/pgdata
sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata -o '-p 55432' start
sudo -u postgres createdb -p 55432 salon_test

npm test
```

| Suite | Proves |
|---|---|
| `tests/booking/slots.test.ts` | Slot generation, buffers, split shifts, lead time, and both DST transitions |
| `tests/booking/concurrency.test.ts` | 20 simultaneous requests for one slot → exactly one wins; input is never trusted |
| `tests/booking/constraint-is-load-bearing.test.ts` | Removes the constraint, shows the same code double-booking, puts it back |
| `tests/tenancy/isolation.test.ts` | Tenant B cannot read, forge, update or delete tenant A's data |

`assert_rls_everywhere()` fails the suite if any table is added without RLS — which is
what stops a table added in week four from quietly shipping unprotected.

---

## The three ideas worth understanding

**1. Double-booking is prevented by the database, not the code.**

```sql
exclude using gist (staff_id with =, blocked_slot with &&)
  where (status in ('pending','confirmed'))
```

Two customers tap Book on the last 2pm slot in the same second. Both run "is 2pm free?",
both get yes, both insert. Neither request can see the other — only Postgres sees both
writes. The second insert fails with SQLSTATE `23P01`, the app says "just taken", and
that is the whole concurrency strategy. No locks, no queues, no retries.

`tests/booking/constraint-is-load-bearing.test.ts` deletes that line and proves the same
"careful-looking" code double-books without it.

**2. The caller cannot express a price.**

`book_appointment()` takes no price, no duration and no end time. It reads all three from
`services`. There is nothing to validate because there is nothing to tamper with.

**3. One event table feeds three features.**

The contact timeline, the automation triggers (Day 18) and the analytics (Day 24) are all
queries over `events`. Build one table well, get three features.

---

## Two things this build got wrong first

Both were caught by tests, and both are left documented because the reasoning matters more
than the fix.

**Phone numbers are not unique.** The first schema had a unique index on
`(tenant_id, phone)`. A mother and daughter booking from the same number are two clients,
and the second one hit a constraint violation at the booking form. Email is unique — it is a
strong identity claim. Phone is indexed but not unique, and identity resolution prefers an
email match so a daughter booking from her mother's phone gets her own record instead of
being merged into her mother's history.

**Tests with absolute dates expire.** The concurrency suite hardcoded `2025-06-03` and
started failing in 2026 with "cannot book a time in the past" — a fixture that rots is a
test that lies about when it broke. Dates are now computed relative to `now`, and the pure
slot generator takes `now` as an argument so DST cases stay reproducible forever.

---

## Migration rules

1. Every schema change is a numbered file in `supabase/migrations/`, committed. Never
   click-edit a table in the dashboard.
2. Once a migration has been applied anywhere real, it is **immutable** — fix it forward
   with a new file. (Migrations 0001 and 0004 were edited in place here only because
   nothing had been deployed yet.)
3. Every new table gets RLS in the same migration that creates it. `assert_rls_everywhere()`
   will catch you, but catching it in review is cheaper.

---

## Next: Day 11

`../founder-os/01-curriculum-30-days.md` picks up at the booking page polish, then Stripe
deposits (Day 12) and the reminder queue (Day 13). Week 2 is the part that can make money.
