# The AI Founder Operating System

**A 30-day build for one product: Salon OS — booking, CRM, payments, funnels, ads and content
scheduling on a single spine.**

| File | What it's for |
|---|---|
| `00-architecture.md` | The system design, the stack, the object map, the five expensive decisions. **Read first.** |
| `01-curriculum-30-days.md` | Day 0 → Day 30, with the exact prompt for each day. |
| `02-prompt-library.md` | The seven reusable prompts. Use these forever, on every project. |
| `schema.sql` | The reference database. Read it like a map of the business. |

---

## The core mental model

```
IDEA → OUTCOME → SYSTEM → COMPONENTS → AGENTS → TOOLS → EXECUTION
                                                              ↓
              SCALE ← AUTOMATION ← VERIFICATION ←─────────────┘
```

A beginner asks *"what prompt do I give the AI?"*

A founder asks *"what outcome do I want, what system produces it, and which parts can machines do?"*

Everything in this folder is the second question, applied to one real business.

---

## The build loop (every feature, every day, forever)

```
DEFINE → RESEARCH → DESIGN → DECOMPOSE → BUILD → TEST → BREAK IT
                                                            ↓
        IMPROVE ← AUTOMATE ← MEASURE ← DEPLOY ← VERIFY ←────┘
```

**BREAK IT is the step that separates builders from demo-makers.** Anyone can get an agent to
produce something that looks finished. The question that matters isn't *"does this work?"* —
you'll always be told yes. It's *"how do I make this lie?"*

Every day in the curriculum has a BREAK IT section. Do not skip it. It is the actual curriculum;
the building is just what generates material for it.

---

## The 30 days at a glance

| Week | Days | You end the week able to... |
|---|---|---|
| **1 — Spine** | 1–7 | Log in. See your contacts and their real timeline. Prove no one else can read them. |
| **2 — Booking + Money** | 8–14 | Send a link. A stranger books, pays a deposit, gets reminders. **This week can earn.** |
| **3 — CRM + Automation** | 15–21 | Stop touching it. Leads, deposits, no-shows, reviews and rebookings handle themselves. |
| **4 — Growth** | 22–28 | Point traffic at it. Funnel pages, tracked ad creative, a self-filling content calendar. |
| **Finish** | 29–30 | Hand it a real customer, on a real domain, hardened and monitored. |

**Daily shape:** 15 min concept → 2–3 hrs build → 30 min BREAK IT → 10 min log.
**Total:** ~80–100 focused hours. Miss a day, don't compress two into one — the BREAK IT step is
the first thing that gets cut and it's the one that matters.

---

## The six things you asked for, and where they live

| What you asked for | Where it's built | What it's actually built on |
|---|---|---|
| Salon booking | Days 8–14 | `appointments` + a Postgres exclusion constraint |
| Payments | Day 12 | Stripe webhooks as the source of truth, with an idempotency ledger |
| CRM | Days 15–17, 20 | `contacts` + `events` — the same rows the funnel and booking write |
| Funnel maker | Days 22–24 | A block schema, not a drag-and-drop builder |
| Ad maker | Days 25–26 | A creative factory + UTM attribution back to real revenue |
| Content scheduler | Days 27–28 | A post queue that degrades to `manual_required` when APIs won't cooperate |
| *(the part you didn't ask for)* | Days 18–19 | **The automation engine** — the thing that makes the other six one business instead of six tools |

---

## Three things that will decide whether this works

**1. Order is not negotiable.** Booking and payments come first because they are the only part
that makes money. Funnels and ads *amplify* — and amplifying a booking flow that loses people
just loses them faster. Build the thing that converts, then send it traffic.

**2. Two clocks start on Day 1.** A2P 10DLC registration (to send SMS legally) takes days to
weeks and you need it on Day 13. The Meta developer account and Instagram Business link are
needed on Day 28. Start both on Day 0. Noticing that the two-week lead time belongs on the
lightest day is exactly the operator instinct this whole thing is training.

**3. You own what the agent writes.** Not "the AI introduced a security hole" — you shipped a
security hole. That's why Day 4 is RLS, Day 6 is an attack suite that runs every day after, and
Day 29 is a full security review. Learn enough to *inspect* the work. You don't have to hammer
every nail; you have to know whether the house is standing.

---

## What this is training you to be

Not a better prompter. The prompts in `02-prompt-library.md` are worth something, but they're
the smallest part.

The skill is **decomposition + verification**: taking "build me an AI booking business" and
turning it into forty things that can each be built and *proven* in one sitting, then refusing
to believe any of them are done until you've watched them fail and then watched them pass.

AI is genuinely excellent at research, code, copy, analysis, testing and documentation. It is
not good at judgment, priorities, taste, risk tolerance, or knowing what should happen next.
Those stay yours. The strongest people using these tools aren't the ones who know the most
syntax — they're the ones who know what needs to happen next and can tell whether it happened.

**Replace "I'm not a coder" with "I'm the architect, and AI is my engineering workforce."**
Then learn enough to fire a bad employee — which means learning enough to notice one.

---

## Day 31 and beyond: the factory

The point of doing this once, properly, is that the second one is not a rebuild.

```
                    AI BUSINESS FACTORY
                           │
      ┌────────────────────┼────────────────────┐
      ↓                    ↓                    ↓
   RESEARCH              BUILD                LAUNCH
   market agent       the spine (reused)     content agent
   competitor agent   the block renderer     ad factory
   customer agent     the automation engine  attribution
```

What carries to the next business, unchanged:

- The spine: `tenant → contact → event`
- The automation engine (durable trigger → condition → action)
- The messaging layer, with consent and quiet hours already correct
- The payments layer, with idempotent webhooks already correct
- The block renderer and funnel capture
- The tenancy test suite
- **All seven prompts in `02-prompt-library.md`**

What changes: the domain objects. Real estate swaps `appointment` for `showing` and `service`
for `property`. E-commerce swaps it for `order` and `product`. The spine, the engine, the money
layer and the discipline are identical.

**That's the actual asset.** Not the salon app — the factory that produced it.

---

## The question you ask forever

Not *"what should I work on today?"*

> **"What is the bottleneck?"**

Day 24 builds the screen that answers it. Prompt #7 in the library turns the answer into
experiments. Everything else is just execution.
