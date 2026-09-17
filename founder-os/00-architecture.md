# 00 — Architecture: One Platform, Six Surfaces

> Read this before Day 1. Every day of the curriculum references the objects defined here.

---

## 1. The reframe

You asked for six things:

```
salon booking · CRM · payments · funnel maker · ad maker · content scheduler
```

Built as six projects, you get six databases, six logins, six contact lists, and a full-time
job copying data between them. That is the single most common way solo builders stall out.

Built correctly, it is **one system with one spine**:

```
                        ┌──────────────────────────────┐
                        │        THE SPINE             │
                        │  tenant → contact → event    │
                        └──────────────┬───────────────┘
                                       │
   ┌──────────┬──────────┬─────────────┼─────────────┬──────────┬──────────┐
   ↓          ↓          ↓             ↓             ↓          ↓          ↓
 FUNNEL     ADS      BOOKING       PAYMENTS        CRM      SCHEDULER  AUTOMATION
 captures  drives    converts      monetizes     remembers    fills      connects
 contact   traffic   contact       contact       contact     calendar    all of it
```

Every surface reads and writes the **same `contacts` row**. Every surface emits to the
**same `events` table**. The automation engine listens to `events` and acts. That is the
difference between "six apps" and "a business machine."

**The test of whether you built it right:** a person clicks your Instagram ad, lands on your
funnel page, fills the form, books a Thursday appointment, pays a deposit, gets two SMS
reminders, shows up, gets asked for a review three hours later, and gets a rebooking nudge in
five weeks — and that is **one contact row with one timeline**, not six systems guessing at
each other.

---

## 2. Scope truth (read this, don't skip it)

| Claim | Reality |
|---|---|
| "30 days to a SaaS I can sell" | No. 30 days at 2–4 focused hours/day gets you a **working v1 that runs your own salon**. Sellable multi-tenant SaaS with support, billing, onboarding and SLAs is ~90 days. |
| "Build all six in parallel" | No. Booking + payments is the only part that makes money on day one. Funnel/ads/social **amplify a thing that already converts**. Amplifying a broken booking flow just makes you lose leads faster. |
| "Drag-and-drop page builder" | Do not. A real drag-drop builder is a 6-week project by itself. You are building a **block-schema renderer** (Day 22). Same output, 3% of the work. |
| "Auto-publish my ads to Meta" | Not in v1. Meta Marketing API needs app review and a business verification. You build the **creative factory + tracked links**, and paste into Ads Manager. Revisit at real ad spend. |
| "Auto-post to Instagram" | Possible, but gated: requires an Instagram **Business/Creator** account linked to a Facebook Page, plus app review for `instagram_content_publish`. Build the queue with a `manual_required` fallback so the product works while review is pending. |

**Two external clocks start on Day 1, not when you need them:**

1. **A2P 10DLC registration** (required to send SMS to US numbers from a business). Brand +
   campaign registration through Twilio takes days to weeks and can be rejected. Start Day 1,
   you need it Day 13.
2. **Meta Developer account + Instagram Business account link.** Start Day 1, you need it Day 28.

Founder thinking is noticing that the thing with a two-week lead time should be started on the
day with the least work, not the day you discover you need it.

---

## 3. Stack

Chosen for one reason: the fewest moving parts that can still do all six jobs.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | One framework for public funnel pages, the booking page, and the admin dashboard. Server components keep secrets server-side. |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) | Postgres is the whole point — exclusion constraints, JSONB, row-level security. Auth and storage included. |
| Payments | Stripe (Payment Intents; Connect only if you resell) | Deposits, balances, refunds, and a webhook model that is the source of truth. |
| SMS | Twilio | Reminders, no-show recovery, two-way replies. |
| Email | Resend | Confirmations, receipts, nurture. |
| Scheduled jobs | Supabase `pg_cron` + an Edge Function worker | Reminders, automation `wait` steps, post publishing. |
| Hosting | Vercel | Deploy on Day 2, not Day 29. |
| AI calls | Anthropic API, server-side only | Ad copy, captions, lead qualification. Never from the browser. |

**Rough monthly cost at your own-salon scale:** Supabase $0–25, Vercel $0–20, Resend $0–20,
Twilio ~$2/mo + ~$0.008/SMS + one-time A2P fees (~$15–50), domain ~$12/yr, Stripe 2.9%+30¢ per
charge, Anthropic API a few dollars. **Budget $50–80/month.** If a decision would push this
past ~$150/month before you have paying customers, it is the wrong decision for now.

---

## 4. Repository shape

```
salon-os/
├── app/
│   ├── (public)/
│   │   ├── book/[tenant]/          # customer booking flow
│   │   └── f/[funnel]/[page]/      # funnel pages (block renderer)
│   ├── (app)/
│   │   ├── calendar/               # operator: today's appointments
│   │   ├── contacts/               # CRM: list + detail + timeline
│   │   ├── pipeline/               # CRM: deals board
│   │   ├── services/               # booking config
│   │   ├── availability/           # booking config
│   │   ├── payments/               # money in, refunds, payouts
│   │   ├── funnels/                # funnel builder + analytics
│   │   ├── ads/                    # creative factory + attribution
│   │   ├── content/                # social calendar + approval queue
│   │   └── automations/            # trigger/condition/action + run log
│   └── api/
│       ├── webhooks/stripe/
│       ├── webhooks/twilio/
│       └── cron/                   # reminder + automation + publish workers
├── lib/
│   ├── db/                         # typed queries, ONE place
│   ├── booking/                    # slot generation, conflict rules
│   ├── events/                     # emit() — the spine
│   ├── automation/                 # engine: trigger → condition → action
│   ├── ai/                         # prompt builders, server-side only
│   └── integrations/               # stripe, twilio, resend, meta, instagram
├── supabase/
│   ├── migrations/                 # every schema change, in order, in git
│   └── functions/                  # edge functions
└── tests/
    ├── tenancy/                    # can tenant A see tenant B? (run every day)
    ├── booking/                    # double-book, DST, buffers
    └── payments/                   # webhook replay, refund, decline
```

**Rule:** every schema change is a migration file in git. Never click-edit a table in a
dashboard. The day you can't rebuild your database from `supabase/migrations/` is the day you
have no database.

---

## 5. The object map

These are the nouns of your business. Everything else is a screen over these.

### Spine (shared by all six surfaces)
| Object | What it is |
|---|---|
| `tenant` | The business. One row for you today; the column that makes selling it possible later. |
| `profile` | A human who can log in, bound to a tenant with a role. |
| `contact` | **The most important table.** A person. Lead and customer are the same row at different lifecycle stages. Funnel creates it, ads source it, booking converts it, CRM remembers it. |
| `event` | Append-only log of everything that happened. The timeline, the automation trigger, and the analytics source — all one table. |

### Booking
`service` · `staff` · `staff_service` · `availability_rule` · `availability_exception` · `appointment`

### Payments
`payment` · `webhook_event` (the idempotency ledger)

### CRM
`pipeline` · `pipeline_stage` · `deal` · `note` · `message` · `message_template`

### Funnel
`funnel` · `funnel_page` · `form` · `form_submission` · `page_view`

### Ads
`ad_campaign` · `ad_creative` · `ad_metric`

### Social
`social_account` · `post` · `post_target`

### Automation
`automation` · `automation_run`

---

## 6. The event spine (the idea that makes it a machine)

Every meaningful action writes one row to `events`:

```
form.submitted      appointment.created     payment.succeeded
contact.created     appointment.confirmed   payment.refunded
ad.clicked          appointment.cancelled   message.replied
page.viewed         appointment.no_show     review.requested
                    appointment.completed   post.published
```

Three things consume that one table:

1. **The contact timeline** — the CRM screen is just `select * from events where contact_id = ?`
2. **The automation engine** — an automation is a subscription to an event type
3. **Analytics** — funnel conversion, ad attribution and LTV are all queries over `events`

Build one table well and you get three features. This is what "systems thinking" actually
cashes out to in code.

---

## 7. Five decisions that are expensive to change later

Make these now, on purpose.

1. **`tenant_id` on every table from Day 1, with RLS deny-by-default** — even though you are
   one salon. Adding it later means rewriting every query and every policy. It costs you one
   column today and buys you the option to sell the product.
2. **Money in integer cents, never floats.** `price_cents bigint`. `19.99` in a float will
   eventually charge someone `19.989999999999998`.
3. **All timestamps `timestamptz`, stored UTC, rendered in the tenant's timezone.** Store the
   tenant timezone as an IANA name (`America/New_York`), never an offset — offsets break twice
   a year at DST.
4. **Double-booking is prevented by a database constraint, not by application code.** An
   app-level "is this slot free?" check loses the race when two people tap Book at the same
   moment. Postgres `EXCLUDE USING gist` does not. This is the single most important line in
   your schema.
5. **Webhooks are the source of truth for money, and they are idempotent.** The browser
   redirecting to `/success` does not mean you were paid. Stripe's webhook does. Stripe will
   send the same event twice; a `webhook_events` table with a unique constraint on the provider
   event id makes the second delivery a no-op instead of a double refund.

---

## 8. What exists at the end of each week

| | You can... |
|---|---|
| **Week 1** | Log in. See your contacts. Their timeline is real. Tenant B cannot see your data, and you have a test that proves it. |
| **Week 2** | Send someone a link, they book a real appointment, pay a real deposit, and get a real confirmation + reminders. **This week alone can make money.** |
| **Week 3** | Stop touching it. Leads get nurtured, deposits get chased, no-shows get recovered, reviews get requested, lapsed clients get rebooked — without you. |
| **Week 4** | Point traffic at it. Funnel pages, tracked ad creative, a filled content calendar, and one screen that tells you where the funnel leaks. |
| **Days 29–30** | Hand it a real customer, on a real domain, with backups, monitoring and a security pass behind it. |
