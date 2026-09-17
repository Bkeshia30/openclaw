# 01 — The 30-Day Build: Salon OS

> **Daily shape:** 15 min concept → 2–3 hrs build → 30 min BREAK IT → 10 min log.
> Skipping BREAK IT is how you end up with an app that demos well and fails with real customers.
>
> **Every day ends the same way:** commit, deploy, and write three lines in `LOG.md` —
> what shipped, what broke, what's next. Thirty entries is your proof of work and your memory.

---

## Day 0 — Accounts (30 min, do this the night before)

Open these now; two have lead times measured in weeks.

- [ ] GitHub repo `salon-os` (private)
- [ ] Supabase project — note the URL, anon key, service role key
- [ ] Vercel account, linked to the repo
- [ ] Stripe account in **test mode** (business verification can wait)
- [ ] Twilio account + buy one number
- [ ] **Start A2P 10DLC brand + campaign registration** ← days to weeks. Needed Day 13.
- [ ] Resend account + start domain verification (DNS propagation is slow)
- [ ] **Meta Developer account; convert your Instagram to a Business account and link a
      Facebook Page** ← needed Day 28, and the linking is fiddly
- [ ] Anthropic API key
- [ ] Buy the domain

Put every key in `.env.local` and confirm `.env*` is in `.gitignore` **before** your first commit.
A leaked service role key is a full database breach — it bypasses every RLS policy you are
about to write.

---

# WEEK 1 — THE SPINE
*End state: you log in, your contacts are real, their timeline is real, and no one else can see them.*

---

### Day 1 — Outcome map. No code.

**Outcome:** One page that says what you're building and for whom, and a list of every object in the business.

**Concept:** Outcome before system, system before components. You are not building six tools;
you are building one path a stranger walks from "saw your ad" to "booked again."

**Build** — write `docs/outcomes.md` by hand:
1. **One sentence.** "Salon OS runs my booking, money, follow-up and marketing from one contact list, so I stop losing clients in the gaps between apps."
2. **The journey**, as one line: `ad → funnel page → form → contact created → booking → deposit → reminders → service → review → rebook`
3. **The four users**: Customer · You (owner) · Staff · The AI agent. For each: the 5 jobs they do.
4. **The object list** — the nouns. Compare against `00-architecture.md §5` when you're done; the gaps you missed are the interesting part.
5. **The money equation, with your real numbers**: `traffic × conversion × avg ticket × frequency × retention`. Write today's actuals, even if they're guesses. Circle the weakest multiplier. That's what Week 4 is for.

**Prompt:**
```
ROLE: Business systems analyst.
CONTEXT: [paste your journey + object list]
TASK: Critique this, do not expand it.
  1. Which objects are missing that this journey implies?
  2. Which two objects am I treating as separate that are actually the same table?
  3. Where does the journey silently drop a person?
  4. Which ONE step, if it broke, would cost me the most money?
CONSTRAINTS: No code. No new features. Under 400 words.
```

**Done when:** `docs/outcomes.md` is committed and you can recite the journey without reading it.

---

### Day 2 — Repo, skeleton, and a live URL

**Outcome:** A deployed URL. Ugly. Real.

**Concept:** Deploy on Day 2 so deploying is boring by Day 30. Teams that leave deployment to
the end discover on the last day that nothing works in production.

**Build:**
- `npx create-next-app@latest salon-os --typescript --tailwind --app`
- Supabase client: a browser client and a server client, in `lib/db/`
- `.env.local` + `.env.example` (example has keys with empty values, committed; real one never)
- One page that reads `select now()` from the database and prints it
- Push. Connect Vercel. Add env vars in Vercel. Deploy.
- Write `docs/adr/0001-stack.md`: what you chose and *why*, in five lines

**Prompt:**
```
ROLE: Senior full-stack engineer.
OBJECTIVE: Scaffold a Next.js App Router + TypeScript + Tailwind + Supabase project.
REQUIREMENTS:
  - Separate browser and server Supabase clients; service role key used ONLY in server code
  - Typed env loading that fails loudly at boot if a var is missing
  - One page proving the DB connection works
CONSTRAINTS: No auth yet. No extra dependencies. Do not put any secret in a NEXT_PUBLIC_ var.
SUCCESS: `npm run build` passes and the page renders a live timestamp from Postgres.
OUTPUT: Files created, commands to run, and any env var I must set in Vercel.
```

**Break it:** `grep -r "SERVICE_ROLE" app/ --include=*.tsx` must return nothing. Confirm no secret appears in the browser bundle (view source, search for your key).

**Done when:** the Vercel URL loads and shows a timestamp from your database.

---

### Day 3 — Schema v1: the spine

**Outcome:** `tenants`, `profiles`, `contacts`, `events` exist as a migration in git.

**Concept:** Tables, primary keys, foreign keys, indexes, migrations. A migration is a
forward-only, ordered, committed change — the reason you can rebuild from scratch.

**Build:** Write `supabase/migrations/0001_spine.sql` from `schema.sql` §SPINE. Understand every
line before you run it. Then seed one tenant (yours) and ten fake contacts.

Four questions you must be able to answer out loud:
1. Why is `contacts.email` `citext` and not `text`?
2. Why is `ltv_cents` a `bigint` and not a `numeric` or a float?
3. Why is `contacts.phone` unique **per tenant** rather than globally?
4. Why does `events` have no `updated_at`?

**Prompt:**
```
ROLE: Postgres data modeler.
OBJECTIVE: Review my spine migration before I run it.
CONTEXT: Multi-tenant salon platform. [paste migration]
TASK: For each table — flag missing indexes, wrong types, missing constraints,
      and anything that will be painful to change once there is production data.
      Then explain the citext / bigint-cents / partial-unique-index choices in plain English.
CONSTRAINTS: Do not add features or tables. Postgres 15. Explain, don't just rewrite.
OUTPUT: A table of issues with severity, then the corrected SQL.
```

**Done when:** the migration runs clean, seeds load, and you answered all four questions without looking.

---

### Day 4 — Auth + Row Level Security

**Outcome:** You can log in, and the database itself refuses cross-tenant reads.

**Concept:** **Authentication** = who are you. **Authorization** = what may you touch. RLS moves
authorization into the database, so a bug in your app code can't leak data. This is the most
valuable security day of the month.

**Build:**
- Supabase Auth: email magic link. Sign-up creates a `profile` row bound to a tenant.
- `auth_tenant_id()` function (`schema.sql` §RLS)
- On **every** table: `enable row level security`, `force row level security`, one `tenant_isolation` policy with both `using` and `with check`
- A `/login` page and a protected `/calendar` route
- **Create a second tenant and a second login.** You need it tomorrow and every day after.

**Prompt:**
```
ROLE: Supabase security engineer.
OBJECTIVE: Lock down every table with row-level security.
REQUIREMENTS:
  - Deny by default; RLS enabled AND forced on every tenant-scoped table
  - Policies use BOTH `using` (read) and `with check` (write) — a using-only policy
    lets a user INSERT rows into another tenant
  - auth_tenant_id() is SECURITY DEFINER with an explicit search_path
CONSTRAINTS: The anon key must never read `contacts`. Public pages go through server
             routes that scope tenant from the URL slug.
TESTS: As tenant B, attempt: select a contact of tenant A; insert a contact with
       tenant_id = A; update A's contact; delete A's contact. All four must fail.
FAILURE: Do not claim completion until you show me the output of all four failing.
OUTPUT: Migration SQL + the exact test queries and their results.
```

**Break it:** Run the four attacks yourself, as tenant B, in the SQL editor with tenant B's JWT. Then try again with the **anon** key against the REST endpoint. Anything that returns a row is a breach.

**Done when:** all four attacks fail, and you ran them yourself rather than trusting the AI's claim.

---

### Day 5 — Contacts + the timeline

**Outcome:** A real CRM screen, backed by the event spine.

**Concept:** CRUD, server components vs. client components, pagination. And the key structural
move: the timeline is not a feature you build, it's a **query over `events`**.

**Build:**
- `lib/events/emit.ts` — one function every part of the app calls. Takes a `dedupe_key` so retries are safe.
- `/contacts` — search, filter by lifecycle, paginate (cursor, not offset)
- `/contacts/[id]` — details, editable, plus a timeline rendered from `events`
- Notes: adding a note also emits `note.added`
- Emit `contact.created` on create

**Prompt:**
```
ROLE: Senior full-stack engineer.
OBJECTIVE: Build the contacts list and detail screens over the existing schema.
REQUIREMENTS:
  - emit(tenantId, type, {contactId, subjectType, subjectId, payload, dedupeKey})
    as the ONLY way anything writes to `events`
  - Contact detail shows a merged timeline from events + notes, newest first
  - Cursor pagination on created_at + id (not offset — it skips rows as data changes)
  - Server components for reads; client components only where there is interaction
CONSTRAINTS: All queries go through lib/db/. No inline SQL in components.
             Never pass tenant_id from the client — derive it from the session.
SUCCESS: 10k seeded contacts still load the list in under 300ms.
TESTS: emit() called twice with the same dedupe_key writes exactly one row.
OUTPUT: Files changed, and the query plan for the contacts list.
```

**Break it:** A contact with no email. An emoji name. A 10,000-character note. Change the URL to another tenant's contact id — you must get 404, not 403 (a 403 confirms the row exists; 404 tells an attacker nothing).

**Done when:** you added a note on your phone and the timeline updated.

---

### Day 6 — BREAK IT: the tenancy suite

**Outcome:** An automated test suite that proves isolation, running in CI.

**Concept:** The security mindset. Stop asking "does it work?" Start asking "how do I make it
lie?" This suite runs every single day for the rest of the build — it's the one that catches
the RLS policy you forget on the table you add on Day 22.

**Build:** `tests/tenancy/` — for **every** table, as tenant B against tenant A's rows: SELECT, INSERT with a forged `tenant_id`, UPDATE, DELETE. All must fail. Plus: anon key against every REST endpoint. Plus: a test that **fails if any table has RLS disabled**, so new tables can't slip through.

**Prompt:**
```
ROLE: Application security engineer running a black-box test.
OBJECTIVE: Prove or disprove tenant isolation. Do NOT fix anything yet.
CONTEXT: Supabase + Next.js, RLS-based multi-tenancy. [paste policies + route list]
TASK:
  1. Enumerate every way tenant B could read or write tenant A's data
  2. Write executable tests for each
  3. Include a meta-test that queries pg_tables and FAILS if any tenant-scoped
     table has relrowsecurity = false
  4. Rank findings by severity with evidence
CONSTRAINTS: Read-only on app code. Report first, fix second.
OUTPUT: Findings table (severity, vector, evidence, fix) + the test files.
```

Then, separately: `Fix finding #1 only. Do not touch unrelated files. Re-run the suite.`

**Done when:** the suite is green, it runs in GitHub Actions on every push, and you watched it go red by deliberately disabling one policy.

---

### Day 7 — Review, refactor, half day off

**Outcome:** A codebase you'd hand to someone else.

**Build:** Delete dead code. Move duplicated queries into `lib/db/`. Write `docs/decisions.md`. Then:

**Prompt:**
```
ROLE: Staff engineer reviewing a junior's first week.
OBJECTIVE: Find structural problems before they compound.
CONTEXT: [repo tree + key files]
TASK: Identify the 5 highest-cost problems — the ones that get 10x more expensive
      in three weeks. For each: evidence, why it compounds, the fix, effort estimate.
CONSTRAINTS: Change nothing. Ignore style and formatting. Structure only.
OUTPUT: Ranked list. Then tell me which ONE to fix today and which four can wait.
```

Fix the one. **Then stop for the day.** A 30-day build with no rest days is a 12-day build.

---

# WEEK 2 — BOOKING + MONEY
*End state: a stranger books a real appointment, pays a real deposit, and gets real reminders. This week can make money on its own.*

---

### Day 8 — Services and staff

**Outcome:** Your actual service menu is in the database.

**Build:** `services`, `staff`, `staff_services` migrations + admin CRUD screens. Enter your **real** services with real prices, real durations, and — the part people forget — **real buffer times**. A 4-hour install with no cleanup buffer will double-book you in the real world even with a perfect algorithm.

**Prompt:**
```
ROLE: Senior full-stack engineer.
OBJECTIVE: Services + staff admin, including the staff↔service assignment matrix.
REQUIREMENTS: prices in integer cents, displayed as currency; soft-delete via `active`
  (never hard-delete a service that has appointments); duration and buffers separate fields
CONSTRAINTS: Owner and manager roles may edit; staff may only read. Enforce in RLS, not just UI.
TESTS: negative price rejected; deposit > price rejected; deactivating a service with
       future appointments warns instead of silently breaking them
OUTPUT: Migration + screens + tests.
```

**Break it:** Price `-50`. Duration `0`. Duration `99999`. Deposit larger than price. Deactivate a booked service. Every one should be refused with a useful message.

---

### Day 9 — Availability and the slot generator

**Outcome:** Given a service, a staff member and a date, the server returns bookable slots.

**Concept:** **Timezones.** Store UTC, compute in the tenant's IANA timezone, render locally.
The salon opens at 9am *local*, which is a different UTC instant in June than in January.
Get this wrong and every appointment shifts by an hour twice a year.

**Build:** `availability_rules` (weekly) + `availability_exceptions` (one-offs). Then
`lib/booking/slots.ts`: rules → minus exceptions → minus existing appointments (**including
buffers**) → minus lead time (`no bookings within 2 hours`) → snap to a 15-min grid.

**Prompt:**
```
ROLE: Senior engineer specializing in scheduling systems.
OBJECTIVE: Pure function generateSlots({tenantTz, serviceId, staffId, date, now}) → Slot[]
REQUIREMENTS: weekly rules; date exceptions (closed or modified hours) override rules;
  subtract existing appointments INCLUDING buffer_before/buffer_after; respect minimum
  lead time; snap to 15-minute increments; a slot is only valid if the FULL blocked
  duration fits inside available hours
CONSTRAINTS: Pure and deterministic — `now` is injected, never Date.now() inside.
  All arithmetic in the tenant's IANA timezone. No floating "hours" math.
TESTS (must all pass):
  - DST spring-forward day: no phantom 2:00–3:00am slots
  - DST fall-back day: no duplicated slot
  - a 4-hour service does not fit in a 3-hour window
  - buffers block the neighbouring slot, not just the appointment itself
  - a fully-booked day returns []
  - a date exception with modified hours beats the weekly rule
FAILURE: Do not report success until every test above is written and passing.
OUTPUT: The function, the test file, and test run output.
```

**Break it:** Run it for March 8 and November 1. Book a service longer than the workday. Set an exception on a day with no rule.

---

### Day 10 — The booking engine (the hardest and most important day)

**Outcome:** Appointments are created safely, and double-booking is **structurally impossible**.

**Concept:** **Race conditions.** Two customers tap Book on the last 2pm slot in the same
second. Both requests check "is 2pm free?" Both get yes. Both insert. You are now double-booked
and one of them is going to be very unhappy in your chair. No amount of careful application
code fixes this — only the database can, because only the database sees both writes.

**Build:**
- The `appointments` table **with the `EXCLUDE USING gist` constraint** from `schema.sql`
- A server action: revalidate the slot, recompute the price **from the database** (never from the client), insert, catch Postgres error `23P01` → return "just taken, pick another"
- Emit `appointment.created`
- Cancel + reschedule (reschedule = cancel + create in one transaction)

**Prompt:**
```
ROLE: Senior backend engineer. Correctness matters more than speed here.
OBJECTIVE: Appointment creation that CANNOT double-book, under concurrency.
ARCHITECTURE: Postgres + btree_gist. An EXCLUDE constraint on (staff_id =, blocked_slot &&)
  WHERE status IN ('pending','confirmed') is the enforcement mechanism. Application
  checks are a UX nicety, not the guarantee.
REQUIREMENTS:
  - Server-side re-validation of the slot at write time
  - price_cents and deposit_cents read from the services table, NEVER from the request body
  - Catch SQLSTATE 23P01 and return a friendly conflict, not a 500
  - Emit appointment.created with a dedupe key
  - Cancelling frees the slot (constraint is partial on status — explain why that matters)
CONSTRAINTS: No advisory locks, no SELECT ... FOR UPDATE, no "check then insert".
  Do not serialize all bookings behind a global lock.
TESTS:
  - fire 20 concurrent inserts for the SAME slot → exactly 1 succeeds, 19 get the
    friendly conflict. Prove it with actual concurrent execution, not a loop.
  - booking into a buffer window is rejected
  - cancelling then rebooking the same slot succeeds
  - a client posting price_cents: 1 is charged the real price
FAILURE CONDITIONS: Do not claim done until the 20-way concurrency test output is shown.
OUTPUT: Migration, server action, test file, and raw test output.
```

**Break it:** Run the concurrency test. Then **delete the EXCLUDE constraint and run it again** — watch multiple rows get in. That failure is the most instructive thing you'll see this month. Put it back.

**Done when:** you have seen it fail without the constraint and pass with it.

---

### Day 11 — The public booking page

**Outcome:** A link you can text to someone who books without asking you anything.

**Concept:** Frontend as conversion, not decoration. Every extra tap costs bookings.

**Build:** `/book/[tenant]` — service → staff (or "anyone") → date → slot → name/phone/email → confirm. **Mobile first**; most of your clients are on a phone. Loading states, a clear error when a slot is taken mid-flow, and a confirmation screen with an "add to calendar" `.ics` file.

**Prompt:**
```
ROLE: Senior frontend engineer with conversion-rate expertise.
OBJECTIVE: Public booking flow at /book/[tenant].
REQUIREMENTS: 5 steps, back button works at every step, state survives refresh,
  slots fetched server-side, graceful "just taken" recovery that re-renders fresh slots,
  .ics download on confirmation, accessible (keyboard + screen reader), mobile-first
CONSTRAINTS: No auth required to book. Anon key must not touch `contacts` — all writes
  go through server actions. Do not leak staff personal info or other clients' names.
  No client-side price calculation anywhere.
SUCCESS: bookable one-handed on a phone in under 60 seconds.
TESTS: refresh mid-flow; slot taken between load and submit; invalid phone;
       duplicate email (existing contact must be REUSED, not duplicated)
OUTPUT: Files + a list of every state the user can be in.
```

**Break it:** Book on your phone, on real mobile data, while your own reminder SMS arrives. Have a friend book at the exact same second you do.

---

### Day 12 — Stripe deposits

**Outcome:** Money moves. No-shows start costing the customer instead of you.

**Concept:** **The webhook is the truth.** The browser landing on `/success` proves nothing —
the user can close the tab, lose signal, or type the URL directly. Only Stripe's server-to-server
webhook confirms payment. And it will arrive **more than once**, so handling must be idempotent.

**Build:**
- Payment Intent created server-side; amount from `services.deposit_cents`
- `/api/webhooks/stripe`: **verify the signature first**, insert into `webhook_events` (unique
  id) — on conflict, return 200 and stop — then process, then mark processed
- On `payment_intent.succeeded`: create `payments` row, set appointment `confirmed`, emit
  `payment.succeeded`
- Refund path honoring your written cancellation policy

**Prompt:**
```
ROLE: Payments engineer.
OBJECTIVE: Deposit collection on booking, with webhooks as the source of truth.
ARCHITECTURE: Stripe Payment Intents. Next.js route handler for webhooks.
REQUIREMENTS:
  - Amount ALWAYS from the DB. A request body containing amount_cents is ignored.
  - Signature verification before ANY parsing (use the raw body, not the parsed JSON)
  - Idempotency ledger: insert event id first; unique violation → 200 + no-op
  - Appointment confirmed ONLY by the webhook, never by the browser redirect
  - Handle: succeeded, payment_failed, charge.refunded, charge.dispute.created
  - Store amounts in cents; record Stripe fees separately
CONSTRAINTS: No secret key outside server code. Never log full payloads (PII + card metadata).
  Webhook must return within 5 seconds — queue slow work, don't do it inline.
TESTS: replay the same webhook 3x → one payment row, one confirmed appointment;
  succeeded arriving BEFORE the browser returns; a declined card; a refund;
  a forged signature → 400; an unknown event type → 200 and ignored
FAILURE: Do not claim done until replay and forged-signature tests pass.
OUTPUT: Route handler, migration, tests, and the stripe-cli commands to reproduce each.
```

**Break it:** `stripe trigger payment_intent.succeeded` three times. Card `4000000000000002` (decline). Card `4000002500003155` (requires 3DS). POST to your webhook with a garbage signature. Refund a deposit and confirm the appointment state is right.

**Done when:** replaying the same event three times produces exactly one payment row.

---

### Day 13 — Notifications and reminders

**Outcome:** Confirmations and reminders send themselves.

**Concept:** **Scheduled work.** A reminder isn't "send later" in memory — a deploy kills that.
It's a row in the database that a worker picks up.

**Build:**
- `message_templates` seeded: `booking.confirmation`, `reminder.24h`, `reminder.2h`, `booking.cancelled`
- Queue `messages` rows with `scheduled_for`, `status='queued'`, and a `dedupe_key` like `appt:<id>:reminder24`
- `pg_cron` every 5 min → worker sends everything due, marks sent, records provider id
- **Quiet hours**: never auto-send 9pm–9am tenant-local; roll forward
- **STOP handling**: Twilio inbound webhook sets `contacts.opted_out_at`
- Email via Resend + calendar `.ics` attached

**Prompt:**
```
ROLE: Backend engineer building a durable notification system.
OBJECTIVE: Queue-based SMS/email with scheduled reminders.
REQUIREMENTS:
  - Reminders are ROWS with scheduled_for, not in-process timers
  - dedupe_key unique per (appointment, template) — a retried worker cannot double-send
  - Worker claims rows atomically (UPDATE ... WHERE status='queued' RETURNING)
    so two overlapping runs never send the same message twice
  - Respect contacts.opted_out_at and consent_sms/consent_email — skip and log the reason
  - Quiet hours from the tenant row; roll forward, never drop
  - Cancelling an appointment cancels its pending reminders
  - Exponential backoff on provider failure, dead-letter after 3 attempts
CONSTRAINTS: Never send to a contact without consent. STOP/UNSTOP handled on the
  inbound webhook. A reminder for a past appointment is dropped, not sent late.
TESTS: run the worker twice concurrently → each message sends once; cancel an
  appointment → reminders cancelled; opted-out contact → skipped with reason;
  10pm-scheduled reminder → rolls to 9am; provider 500 → retried then dead-lettered
OUTPUT: Migration, worker, cron config, tests, and test output.
```

**Break it:** Run the worker twice at once. Cancel an appointment after the reminder is queued. Reply STOP to your own number, then trigger a reminder. Book something for 8am tomorrow and check when the 24h reminder is scheduled for.

> **If A2P 10DLC isn't approved yet:** build the whole pipeline, send email for real, and log SMS to the console. The queue doesn't care which provider is on the other end. Do not let a registration delay stop the architecture.

---

### Day 14 — BREAK IT + ship Week 2

**Outcome:** You trust the booking system with a real client.

**The adversarial checklist:**
- [ ] 20 concurrent bookings, same slot → exactly one wins
- [ ] Book across a DST boundary; verify the reminder fires at the right wall-clock time
- [ ] Book, pay, refund, rebook the same slot
- [ ] Webhook replayed 5x
- [ ] Book with a duplicate email → one contact row, two appointments
- [ ] Cancel 30 min before → policy enforced
- [ ] `price_cents: 1` in the request body → charged full price
- [ ] Another tenant's `service_id` in the request body → rejected
- [ ] Phone `+1555`, `abc`, and a 40-digit number → all rejected
- [ ] The full tenancy suite from Day 6 → still green

**Prompt:**
```
ROLE: QA engineer who is paid to find the bug that reaches production.
OBJECTIVE: Break the booking + payment system. Do not fix anything.
CONTEXT: [paste booking action, slot generator, webhook handler]
TASK: Find every input, race, timing and state-machine path that produces a wrong
      outcome. Focus on: money charged incorrectly, slots double-sold, and
      appointments stuck in an impossible state.
      For each: reproduction steps, impact in dollars or trust, severity.
CONSTRAINTS: Report only. Assume a hostile user who reads your API in devtools.
OUTPUT: Findings ranked by (likelihood × cost). Then name the single worst one.
```

Fix findings one at a time, re-running the suite between each. **Then book yourself a real appointment on your real phone, pay a real $1 deposit in live mode, and refund it.**

**Milestone:** the link you send a client is now a working business.

---

# WEEK 3 — CRM + THE AUTOMATION ENGINE
*End state: the business follows up without you. This is the week your app becomes a machine.*

---

### Day 15 — The event spine, wired everywhere

**Outcome:** Every meaningful action emits an event, and the timeline shows the whole story.

**Concept:** Event-driven design. Instead of booking code calling SMS code calling CRM code
(a tangle that breaks when you add the seventh feature), booking code emits `appointment.created`
and **anything** can subscribe. Adding a new behavior stops meaning editing old code.

**Build:**
- Audit every write path; anything without an `emit()` gets one
- Standard event names: `contact.created` `form.submitted` `page.viewed` `ad.clicked`
  `appointment.created|confirmed|cancelled|completed|no_show` `payment.succeeded|refunded`
  `message.sent|replied` `review.requested|received` `post.published`
- Backfill events from existing rows so old contacts have timelines
- Upgrade the contact timeline to render every type with a proper icon and sentence

**Prompt:**
```
ROLE: Backend architect.
OBJECTIVE: Audit every write path and guarantee the event spine is complete.
CONTEXT: [paste lib/ and app/api/ tree + the events schema]
TASK: 1. List every code path that mutates state.
      2. For each, say which event it should emit and whether it currently does.
      3. Give me a backfill script for historical rows (idempotent via dedupe_key).
      4. Propose a typed EventType union so a typo becomes a compile error.
CONSTRAINTS: Events are append-only. Never update or delete one. A failed emit must
  not roll back the business action — log it and move on.
OUTPUT: Gap table, the typed union, the backfill script.
```

**Break it:** Delete a contact — do its events survive (`on delete set null`)? Emit 10,000 events and check the timeline query plan. Emit the same `dedupe_key` twice.

---

### Day 16 — Pipeline, deals, and the one screen you open every morning

**Outcome:** A daily operator view that answers "who do I contact today?"

**Build:** `pipelines`, `pipeline_stages`, `deals`. A board view with drag between stages. And
the screen that actually matters: **Today** — deals with `next_action_at <= now`, appointments
today, unpaid deposits, and unanswered inbound messages, in one list.

**Prompt:**
```
ROLE: Product engineer.
OBJECTIVE: A "Today" operator dashboard that answers ONE question: what needs me now?
REQUIREMENTS: overdue next-actions, today's appointments, unpaid deposits on upcoming
  appointments, unreplied inbound messages from the last 48h — merged, sorted by urgency,
  each with a one-tap action
CONSTRAINTS: One page. No tabs. Must be useful on a phone between clients.
  If the list is empty it says "you're clear" — it does not show empty charts.
SUCCESS: I open this and know my next action in under 5 seconds.
OUTPUT: The page, the queries, and your reasoning on the urgency sort order.
```

**Concept — the founder's daily question:** not "what should I work on?" but **"what is the
bottleneck?"** This screen is that question, rendered.

---

### Day 17 — The messaging layer (two-way)

**Outcome:** SMS replies land on the contact's timeline and you can reply from the app.

**Build:**
- Twilio inbound webhook → find contact by E.164 phone → create inbound `message` → emit `message.replied`
- **STOP / START / HELP** handled before anything else (this is a legal requirement, not a feature)
- Reply UI on the contact detail page
- Email replies via Resend inbound or a reply-to alias
- Unknown number → create a new contact with `source='sms:inbound'`

**Prompt:**
```
ROLE: Backend engineer building two-way messaging.
OBJECTIVE: Inbound SMS + email routed to contacts, with compliance handled first.
REQUIREMENTS:
  - Verify the Twilio signature before processing
  - STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT → set opted_out_at, confirm, and process
    NOTHING else. START/UNSTOP → clear it. HELP → send help text.
  - Match contacts by normalized E.164; unknown numbers create a contact
  - Emit message.replied; surface on the timeline
CONSTRAINTS: Compliance checks run before any business logic or automation trigger.
  An opted-out contact can still receive transactional confirmations they requested,
  but NEVER marketing. Encode that distinction in the template, not in a comment.
TESTS: forged signature → 401; "stop" lowercase with whitespace → opted out;
  reply from an unknown number → new contact; the same webhook delivered twice → one message
OUTPUT: Handler, tests, and the transactional-vs-marketing decision table.
```

**Break it:** Text `  StOp  ` with spaces. Text from a number with no contact. Have Twilio retry a delivery.

---

### Day 18 — The automation engine

**Outcome:** `TRIGGER → CONDITION → ACTION` runs durably, including multi-day waits.

**Concept:** **Durable execution.** `setTimeout(24 hours)` dies on your next deploy. A `waiting`
run row with `resume_at` survives deploys, crashes, and restarts. This distinction is the whole
difference between a demo and infrastructure.

**Build:**
- `automations` + `automation_runs`
- Worker A (every minute): new `events` → matching enabled automations → create a run
  (`unique (automation_id, event_id)` means one event can never fire one automation twice)
- Worker B (every minute): `status='waiting' and resume_at <= now()` → resume at `step_index`
- Action types: `send_sms` · `send_email` · `wait` · `add_tag` · `set_lifecycle` · `create_deal` ·
  `move_stage` · `notify_owner` · `ai_decide`
- **Governors** (non-negotiable): max runs per contact per day; a run can't trigger an
  automation that re-triggers it; opted-out contacts are skipped with a logged reason;
  `requires_approval` actions queue for you instead of firing
- A run log UI: every run, every step, why it was skipped

**Prompt:**
```
ROLE: Distributed systems engineer.
OBJECTIVE: A durable trigger→condition→action automation engine on Postgres.
ARCHITECTURE: events table as the trigger source. automation_runs as durable state.
  Two cron workers: dispatcher (event → run) and resumer (waiting → continue).
REQUIREMENTS:
  - Steps execute in order; state persists between them in context jsonb
  - A `wait` step sets status='waiting' + resume_at and RETURNS. It does not sleep.
  - At-least-once execution, so every action must be individually idempotent
    (messages already have a dedupe_key — use it)
  - unique(automation_id, event_id) prevents duplicate runs from a redelivered event
  - Workers claim rows atomically so two instances never run the same step
  - Loop protection: cap runs per contact per day; detect automation A → event → automation A
  - Skip (with a recorded reason) when: contact opted out, contact deleted,
    appointment already cancelled, or the triggering condition is no longer true
CONSTRAINTS: No external queue service. No in-memory timers. Postgres only.
  A failing action fails ONE run, never the worker.
TESTS: a 3-step automation with a 24h wait resumes correctly after a simulated restart;
  the same event delivered twice creates one run; a contact who opts out mid-wait is
  skipped at the next step, not at trigger time; a deliberately looping automation is
  stopped by the governor; two workers racing the same run → one executes
FAILURE: Do not claim done until the restart-survival and racing-workers tests pass.
OUTPUT: Migration, both workers, the action registry, tests, test output.
```

**Break it:** Restart mid-wait. Build a loop on purpose and watch the governor stop it. Delete a contact mid-run. Run two workers concurrently.

**Done when:** an automation with a 24-hour wait survives a deploy. That property is the product.

---

### Day 19 — Your first five automations

**Outcome:** The business follows up without you.

Build these as **data rows**, not code. If adding the sixth automation requires a deploy, you built it wrong yesterday.

| # | Trigger | Flow |
|---|---|---|
| 1 | `form.submitted` | tag lead → SMS in 2 min with booking link → wait 24h → if no appointment, send a social-proof follow-up → wait 48h → last touch → set `lifecycle='lapsed'` |
| 2 | `appointment.created` where `deposit unpaid` | wait 1h → SMS payment link → wait 12h → second nudge → wait 12h → auto-cancel, free the slot, notify you |
| 3 | `appointment.created` | schedule 24h + 2h reminders (replaces Day 13's hardcoded path — now it's configurable) |
| 4 | `appointment.no_show` | wait 2h → empathetic SMS + rebooking link → tag `no_show` → if it's their second, require full prepayment next time |
| 5 | `appointment.completed` | wait 3h → thank-you + review link → wait 5 weeks → rebooking nudge referencing their actual service |

**Prompt:**
```
ROLE: Lifecycle marketing strategist who also writes SMS copy.
CONTEXT: Independent salon. Services: [your list]. Average ticket: [$X]. Typical
  rebooking interval: [N weeks]. Brand voice: [3 adjectives].
OBJECTIVE: Write the message copy for these 5 automations. [paste the table]
REQUIREMENTS: SMS under 160 chars where possible; first name only; one clear action
  per message; the no-show message assumes life happened, not that they're a bad person
CONSTRAINTS: No fake scarcity. No guilt. No emoji walls. Every marketing message
  carries an opt-out. Never promise availability the system hasn't verified.
OUTPUT: For each message — the copy, the merge variables, and the ONE thing it's
  trying to get the person to do.
```

**Break it:** Enable all five with one test contact. Does anyone get five messages in ten minutes? That's your governor test, and the answer must be no.

---

### Day 20 — Retention, LTV, and the rebooking engine

**Outcome:** The system knows who's slipping away and acts before they're gone.

**Concept:** Retention is the cheapest multiplier in `traffic × conversion × ticket × frequency × retention`. Winning back a past client costs a text; a new client costs ad spend.

**Build:**
- LTV rollup from `payments` → `contacts.ltv_cents` (a trigger or nightly job)
- A "lapsed" definition that fits your business: `no appointment in 1.5× their normal interval`
- A nightly job emitting `contact.lapsed`
- A **segments** view: new · active · at-risk · lapsed · VIP (top 10% LTV)
- Automation 6: `contact.lapsed` → personalized win-back referencing their last service

**Prompt:**
```
ROLE: Retention analyst.
OBJECTIVE: A SQL view of contact segments and a lapse-detection job.
REQUIREMENTS: per-contact — visit count, first/last visit, avg days between visits,
  LTV, predicted next visit. Segment = new | active | at_risk | lapsed | vip.
  at_risk = past predicted next visit. lapsed = past 1.5x their own average interval,
  computed PER CONTACT — a 3-week client and a 10-week client are not the same.
CONSTRAINTS: One view, not a table (no sync bugs). Must stay fast at 10k contacts —
  show me the query plan. A contact with one visit uses the tenant's service default.
OUTPUT: The view, the cron job, the plan, and a plain-English read of what the
  segment sizes would tell me about my business.
```

---

### Day 21 — BREAK IT + ship Week 3

**The adversarial checklist:**
- [ ] A contact triggering 4 automations at once doesn't get 12 messages
- [ ] Opt-out mid-sequence stops every marketing message immediately
- [ ] A 24h wait survives a deploy
- [ ] Cancelled appointment cancels its queued reminders
- [ ] Automation on a deleted contact fails gracefully
- [ ] Nothing auto-sends during quiet hours
- [ ] Two workers racing → no duplicate sends
- [ ] Day 6 tenancy suite still green (you added tables this week — did they get RLS?)
- [ ] The run log tells you *why* every skipped run was skipped

**Milestone:** you can go a week without opening the app and clients still get looked after.

---

# WEEK 4 — THE GROWTH LAYER
*End state: traffic in, attribution out, and a content calendar that fills itself.*

> These three surfaces only pay off because Weeks 2–3 exist. A funnel pointing at a
> broken booking flow is a faster way to lose leads. Order matters.

---

### Day 22 — Funnel maker, part 1: the block renderer

**Outcome:** You compose a landing page from typed blocks and it renders fast and public.

**Concept:** **Do not build drag-and-drop.** A real visual builder is a six-week project with
z-index bugs. A **block schema** gets you 95% of the value in one day:

```json
[
  {"type":"hero","headline":"Loc retwists that last 6 weeks","sub":"Book in 60 seconds","cta":{"label":"See times","href":"#book"},"image":"..."},
  {"type":"proof","items":[{"quote":"...","name":"Tasha","photo":"..."}]},
  {"type":"services","serviceIds":["..."]},
  {"type":"faq","items":[{"q":"...","a":"..."}]},
  {"type":"form","formId":"..."},
  {"type":"booking_embed","tenantSlug":"..."}
]
```

**Build:** A typed union of ~8 block types, a React renderer, a block editor (add/remove/reorder/edit fields — **no dragging**), draft vs. published, a live preview, and `/f/[funnel]/[page]` rendering `published_blocks` statically.

**Prompt:**
```
ROLE: Senior frontend engineer.
OBJECTIVE: A block-schema page renderer and editor. NOT a drag-and-drop builder.
REQUIREMENTS: discriminated union of block types with zod validation; one React
  component per type; unknown block types render nothing rather than crashing the page;
  draft_blocks editable, published_blocks served; publish copies draft→published
CONSTRAINTS: Public pages are server-rendered and cached — a funnel page must load in
  under 1.5s on 4G. NEVER render user HTML (XSS). Adding a 9th block type must touch
  exactly 3 files. No drag-and-drop library.
TESTS: unknown block type doesn't break the page; a script tag in a headline renders
  as text; unpublished funnel returns 404; published page has correct OG tags
OUTPUT: Types, renderer, editor, public route, and the 3-file recipe for a new block.
```

**Break it:** Put `<script>alert(1)</script>` in a headline. Publish, then edit the draft — does the public page change? (It must not.) Load on throttled 4G.

---

### Day 23 — Funnel maker, part 2: capture → contact → automation

**Outcome:** A form submission becomes a contact, an event, and an automation — automatically.

**Build:**
- Form submit → server action → `form_submissions` + upsert `contacts` (**match on email/phone; never create a duplicate**) + emit `form.submitted`
- UTM capture on first touch, stored on the contact, **persisted across pages** (cookie or query passthrough)
- `page_views` with a session id
- Honeypot + rate limit (bots will find your form within days)
- Thank-you redirect straight into the booking flow

**Prompt:**
```
ROLE: Senior full-stack engineer.
OBJECTIVE: Form capture that creates/updates contacts and fires the event spine.
REQUIREMENTS: upsert by email then phone (never duplicate a known contact); capture
  utm_source/medium/campaign/content/term + referrer + landing page on FIRST touch and
  don't overwrite it later; explicit consent checkbox writing consent_sms/email + consent_at;
  emit form.submitted
CONSTRAINTS: Rate limit per IP. Honeypot field. Validate server-side with zod — never
  trust the client. Hash IPs before storing. tenant_id derived from the funnel slug,
  NEVER from the request body.
TESTS: same email twice → one contact, two submissions; bot filling the honeypot →
  silently dropped; 100 submits from one IP → throttled; a forged tenant_id in the
  body → ignored; missing consent → contact created but consent flags false
OUTPUT: Server action, validation, rate limiter, tests.
```

**Break it:** Submit the same email three times. Fill the honeypot. Submit 200 times in a minute. Add `tenant_id` to the POST body pointing at another tenant.

---

### Day 24 — The funnel analytics screen (your bottleneck finder)

**Outcome:** One screen that tells you where you're losing money.

**Concept:** This is Day 1's money equation made real:

```
page views → form submits → bookings → deposits paid → showed up → revenue → rebooked
   1,000         80            24            19            16        $2,400      6
              (8.0%)        (30%)         (79%)          (84%)               (37%)
```

**The rule:** fix the worst-converting step. Do not add a feature until you know which number is worst. This screen is what stops you building the wrong thing for the next six months.

**Build:** A SQL view over `page_views` + `form_submissions` + `events` + `payments`, sliceable by funnel, by `utm_campaign`, and by date range. Show absolute numbers **and** rates. Flag the worst step.

**Prompt:**
```
ROLE: Analytics engineer.
OBJECTIVE: A funnel conversion view from views → revenue, sliceable by campaign and date.
REQUIREMENTS: every stage as count AND conversion-from-previous; attribution joins
  events → contacts.utm; handle contacts with no UTM ('direct'); revenue from `payments`
  (succeeded minus refunds), never from appointment price
CONSTRAINTS: One source of truth for money — the payments table. If two screens can
  disagree about revenue, you built it wrong. Must be correct with partial data
  (a contact who booked but hasn't paid must not vanish from the funnel).
OUTPUT: The view, the page, and — reading my seeded data — which stage is weakest
  and what you'd test first. Give me the reasoning, not just the number.
```

**Break it:** A contact who booked twice from one submission. A refunded payment. A contact with no UTM. Does revenue on this screen match Stripe's dashboard to the cent?

---

### Day 25 — Ad maker, part 1: the creative factory

**Outcome:** Ten tested-quality ad variants across distinct angles, generated from your real data, gated behind your approval.

**Concept:** AI is good at **volume and variation**; you are good at **judgment**. The system's
job is to produce 10 options with structure, not 1 option with confidence. And nothing your
customers see goes out unapproved — `approved_at` is a required gate, not a nice-to-have.

**Build:**
- Brand config: voice, non-negotiables, banned claims, offer, audience
- Server-side generation producing **structured** output (headline / primary text / CTA / angle / target avatar), not a blob of prose
- Angles that differ meaningfully: outcome · time-saving · social proof · price-anchor · objection-handling · identity
- An approval queue — draft → approved → live; `utm_content` auto-assigned per creative
- Feed it **real** inputs: your actual services, actual review text, actual before/after photos

**Prompt:**
```
ROLE: Direct-response copywriter with paid-social experience.
OBJECTIVE: 10 ad variants for [service], across 6 distinct angles.
CONTEXT: Audience: [who]. Their problem: [what]. Current alternative: [what they do now].
  Why it fails them: [why]. Offer: [offer]. Proof: [real reviews/photos]. Voice: [3 words].
REQUIREMENTS: each variant = angle + headline (<40 chars) + primary text (<125 chars)
  + CTA + the ONE objection it handles. Angles must be genuinely different strategies,
  not reworded sentences.
CONSTRAINTS: No guaranteed results. No health/medical claims. No fake urgency or fake
  scarcity. No before/after implying a guaranteed outcome. Nothing I can't substantiate.
  Meta ad policy compliant.
OUTPUT: JSON matching this schema: [paste ad_creatives columns].
  Then rank your own 10 by expected CTR and explain the top 3 — I want your reasoning,
  because I'm going to disagree with some of it.
```

**Break it:** Ask for a service you don't offer — does it invent one? Check every claim against what you can actually deliver. **You are legally responsible for what your AI writes in your ad.**

---

### Day 26 — Ad maker, part 2: attribution back to revenue

**Outcome:** You can answer "which ad made me money?" — the only ad question that matters.

**Concept:** The chain is `utm_content` → contact → appointment → payment. Held end to end, you
get true ROAS. Broken anywhere, you're guessing. Most small businesses guess.

**Build:**
- Per-creative tracked link: `/f/[funnel]/[page]?utm_source=meta&utm_campaign=X&utm_content=<creative_id>`
- Daily spend entry (manual in v1 — a 30-second daily habit, not an API integration)
- The ROAS view: per creative — spend, clicks, leads, bookings, revenue, CPL, CAC, ROAS
- A one-screen export for pasting into Ads Manager: copy, targeting notes, link

**Prompt:**
```
ROLE: Marketing analytics engineer.
OBJECTIVE: Per-creative ROAS joining ad spend to booked revenue.
ARCHITECTURE: ad_metrics holds spend/impressions/clicks (manual entry). Leads, bookings
  and revenue are DERIVED by joining events → contacts.utm->>'utm_content' → creative id.
REQUIREMENTS: per creative — spend, clicks, leads, bookings, revenue, CPL, CAC, ROAS.
  Attribution window configurable (default 30 days from first touch).
CONSTRAINTS: Do NOT store derived revenue in ad_metrics — it will drift from payments.
  Handle: a contact who clicked two different creatives (first-touch wins, and say so
  in the UI); a booking with no UTM; a refund reducing revenue.
OUTPUT: The view, the page, and a note on which attribution assumptions will be wrong
  and by roughly how much. I want to know the error bars, not a confident fake number.
```

**Honest note:** do not build the Meta Marketing API integration. App review, business
verification and token management is a week of work that saves you 30 seconds a day. Revisit
above ~$3k/month in spend.

---

### Day 27 — Content scheduler, part 1: calendar + AI drafting

**Outcome:** A month of posts, drafted from your real business data, waiting for your approval.

**Concept:** Generic AI captions are visibly generic and they underperform. Posts grounded in
**your actual data** — this week's openings, a real 5-star review, the service you want to sell
more of — don't read as AI slop because they aren't.

**Build:**
- `posts` + `post_targets` + a month calendar view
- Content pillars: education · proof · offer · personality (with a target mix so you don't post four offers in a row)
- AI drafting that **reads your database**: available slots this week, recent 5-star reviews, your least-booked service, seasonal context
- An approval queue — nothing publishes without `approved_at`
- Media upload to Supabase Storage

**Prompt:**
```
ROLE: Social media strategist for service businesses.
OBJECTIVE: Draft 12 posts (3 weeks, 4/week) for my salon.
CONTEXT (from my database — do not invent any of this):
  Services + prices: [...]  Real 5-star review quotes: [...]
  Openings this week: [...]  Least-booked service: [...]  Voice: [3 words]
REQUIREMENTS: pillar mix 4 education / 3 proof / 3 offer / 2 personality. Each post =
  caption + hashtags + the media I need to shoot + the ONE action it asks for.
  Education posts teach something real and specific enough to be useful on its own.
CONSTRAINTS: Never invent a service, price, review, or availability. If you need a fact
  I didn't give you, write [NEED: ___] instead of guessing. No engagement bait.
  Max 5 hashtags. Don't open every caption the same way.
OUTPUT: JSON matching the posts schema. Flag every [NEED] in a list at the end.
```

**Break it:** Check every factual claim. Any invented price, review or service is a trust failure, and the `[NEED]` convention is what stops it.

---

### Day 28 — Content scheduler, part 2: publishing

**Outcome:** Approved posts publish on schedule — or tell you clearly when they can't.

**Concept:** **Degrade gracefully.** Platform APIs are gated, tokens expire, reviews get denied.
A scheduler that only works with full API access is a scheduler that doesn't work. A
`manual_required` state means the product is useful on day one and better later.

**Build:**
- OAuth connect for Instagram (Business account + linked Facebook Page required)
- Tokens in **Supabase Vault**, referenced by `token_ref` — never a plaintext column
- Publish worker on cron: claim due targets → publish → record `external_post_id` → emit `post.published`
- **Fallback:** no API access, expired token, or unsupported media → status `manual_required` +
  a push/email to you with the caption and media ready to paste
- Token refresh before expiry, with an alert when a connection breaks
- Retry with backoff; 3 failures → `failed` + notify

**Prompt:**
```
ROLE: Integrations engineer.
OBJECTIVE: Scheduled publishing with a first-class manual fallback.
ARCHITECTURE: post_targets rows claimed by a cron worker.
REQUIREMENTS:
  - OAuth token storage in Supabase Vault; the DB holds only a reference
  - Worker claims atomically; each target succeeds/fails INDEPENDENTLY of its siblings
  - Any unavailable capability → status 'manual_required' + notify me with a
    copy-paste-ready payload. This is a normal outcome, not an error.
  - Proactive token refresh; a revoked token sets the account to 'revoked' and alerts me
  - Exponential backoff; 3 attempts then 'failed'
CONSTRAINTS: Never log or return a token. Never publish an unapproved post —
  enforce approved_at in the WORKER, not just the UI. Assume the API is down 1% of the time.
TESTS: expired token → account marked expired, post marked manual_required, I get told;
  partial fanout (IG ok, FB fails) → one published, one failed, post not lost;
  worker runs twice → no duplicate publish; unapproved post → never sent
OUTPUT: OAuth flow, worker, notification path, tests.
```

**Break it:** Revoke the token in Meta's settings and run the worker. Schedule a post for 3 minutes out and watch it. Run the worker twice at once.

---

# THE FINISH

---

### Day 29 — Harden

**Outcome:** You'd be comfortable if a stranger found your URL.

- [ ] **Security review** of the whole app (prompt below)
- [ ] Rate limits on every public endpoint: booking, forms, webhooks, login
- [ ] **Secrets audit**: `git log -p | grep -iE "sk_live|service_role|api[_-]?key"` — if a key was ever committed, rotate it, because history is forever
- [ ] Backups: confirm Supabase PITR is on. **Do a restore drill** — an untested backup is not a backup
- [ ] Error monitoring (Sentry) + alerts on failed payments, failed messages, failed automation runs
- [ ] Cost caps on AI calls: per-tenant daily token budget, or one loop empties your account overnight
- [ ] PII: what do you store, why, and how does someone ask you to delete it? Write it down. A
      contact deletion path that also handles their events and messages.
- [ ] Legal pages: privacy policy, terms, cancellation policy, SMS consent language
- [ ] Load test: 100 concurrent bookings

**Prompt:**
```
ROLE: Application security engineer performing a pre-launch review.
CONTEXT: [full repo tree, all API routes, all RLS policies, all server actions]
TASK: Find every vulnerability. Prioritize: broken access control, tenant isolation
  failures, injection, secrets exposure, missing rate limits, insecure direct object
  references, webhook forgery, and anything that lets a user pay less than they owe.
  For each: severity, exploit path, proof, fix.
CONSTRAINTS: Report only — no edits. Assume an attacker with devtools, my public
  page source, and unlimited patience. Assume they have read my API responses.
OUTPUT: Findings ranked by severity with reproduction steps. Then: the 3 you would
  fix before launch and the rest as a backlog.
```

Fix critical and high **today**. Log the rest.

---

### Day 30 — Launch

**Outcome:** A real customer completes the entire journey on your real domain.

1. Custom domain + SSL. Stripe to **live mode** (re-test the webhook — live mode has a different signing secret).
2. Real services, real prices, real availability, real templates. No lorem ipsum anywhere.
3. **The full walk**: put your own money through it. Visit your funnel page from your phone on
   cell data → submit the form → book → pay a real deposit → receive both reminders → mark
   complete → get the review request. Every step, for real.
4. Publish one funnel page. Put the link in your Instagram bio. Send it to five past clients.
5. **Book one real client through it today.**
6. Write `LOG.md` day 30: what you built, what surprised you, what's still fragile.

**Prompt:**
```
ROLE: Technical founder doing a launch readiness review.
CONTEXT: [repo + the checklist above, annotated with what's done]
TASK: 1. What will break first under real usage, and why?
      2. What's the highest-risk single point of failure?
      3. If I get 50 bookings this week, what falls over?
      4. What am I not monitoring that I'll wish I'd monitored?
CONSTRAINTS: Be specific and concrete. No generic advice. Name files and endpoints.
OUTPUT: Ranked risks + the one thing to fix before I send traffic.
```

---

# DAY 31+ — THE OPERATING RHYTHM

The build ends. The system doesn't.

**Daily (10 min):** open Today. Clear it. Ask *"what is the bottleneck?"* — check the Day 24
funnel screen and find the worst-converting step.

**Weekly (1 hr):** review the numbers — bookings, revenue, no-show rate, rebooking rate,
CPL, ROAS, automation run failures. Pick **one** bottleneck. Ship **one** improvement for it.
Nothing else.

**Monthly (1 day):** review automation run logs for what's misfiring. Prune content that
underperforms. Run the security prompt again. Read `LOG.md` — you'll be surprised what you
forgot.

**The discipline that matters:** never build a feature before you can name the number it
moves. "Would be cool" is how a 30-day system becomes a 30-month unfinished project.
