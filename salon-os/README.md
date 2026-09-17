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

## What works today

| Area | State |
|---|---|
| Multi-tenant schema with RLS on every table | ✅ tested |
| Magic-link auth + session refresh | ✅ |
| Owner calendar: today, upcoming, confirm / done / no-show / cancel | ✅ |
| Services admin — price, duration, deposit, cleanup buffer | ✅ |
| Hours admin — weekly hours + blocked days | ✅ |
| Clients list + detail with an event-driven timeline | ✅ |
| Public booking page with DST-correct slots and no double-booking | ✅ 27 tests |
| Deposits taken by card (Stripe) | ⬜ Day 12 — **bookings are unpaid holds until this exists** |
| SMS/email reminders | ⬜ Day 13 |
| Automations, funnels, ads, scheduler | ⬜ Days 15–28 |

**38 tests, all passing**, including a 20-way concurrency race and a full tenant-isolation suite.

---

## Deploy it (about 45 minutes, mostly waiting on signups)

### 1. Supabase project

1. Sign up at supabase.com and create a project. Save the database password somewhere.
2. Wait for it to finish provisioning (~2 min).
3. **SQL Editor** → paste each file from `supabase/migrations/` **in filename order**
   (`0001`, `0002`, `0003`, `0004`), running each one before the next.
   Do **not** run `tests/setup/0000_local_shim.sql` — Supabase already provides what it fakes.
4. **Project Settings → API** → copy three values:
   - Project URL
   - `anon` `public` key
   - `service_role` key ← treat this like a house key; it bypasses every security rule

### 2. Vercel

1. Sign up at vercel.com with GitHub and import this repository.
2. **Set Root Directory to `salon-os`** — the app lives in a subfolder, and Vercel will
   fail confusingly if you skip this.
3. Add three environment variables:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service_role key |

4. Deploy. Copy the URL it gives you (something like `salon-os-xyz.vercel.app`).
5. Add a fourth variable `NEXT_PUBLIC_SITE_URL` set to that URL, then redeploy.
   Sign-in links point at this value, so a wrong one emails you a link to localhost.

### 3. Point Supabase at your live site

In Supabase → **Authentication → URL Configuration**:

- **Site URL**: your Vercel URL
- **Redirect URLs**: add `https://your-vercel-url/auth/callback`

Miss this and your sign-in link will land on an error page.

### 4. Create your salon

1. Go to `https://your-vercel-url/login` and sign in with your email. Check spam.
   (Supabase's built-in email sender is rate-limited to a few messages an hour — fine for
   you, not for customers. Wire up a real email provider before you send client mail.)
2. Once you are in, open `supabase/setup.sql`, change the five values at the top, and run it
   in the Supabase SQL editor. It creates your salon, makes you the owner, and gives you
   starter hours.
3. Back on the site: **Services** → add what you actually offer. **Hours** → set when you work.
4. Your booking page is now live at `https://your-vercel-url/book/yourslug`.

### 5. Try to break it before your clients do

Book yourself through the public page on your phone. Then check it appears on your Calendar.
Then block tomorrow on the Hours page and confirm tomorrow disappears from the booking page.

### Before you send this to real clients

- **No deposits are collected yet.** A booking holds your time but costs the client nothing,
  so no-shows are free for them. Stripe is Day 12 — do it before you promote this widely.
- **No reminders are sent yet.** You will need to text people yourself until Day 13.
- **Start A2P 10DLC registration now** (in Twilio) if you want automated texts later.
  It takes days to weeks to approve, so starting today costs you nothing and saves you a wait.

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
