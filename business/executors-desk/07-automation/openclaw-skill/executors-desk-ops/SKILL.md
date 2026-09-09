---
name: executors-desk-ops
description: Run the marketing and support operations for The Executor's Desk digital product business (Pinterest pins, weekly SEO article drafts, weekly KPI report, Etsy listing checks, support inbox triage). Use when a cron job or the owner asks to "post today's pin", "draft this week's article", "send the weekly report", "check the Etsy listing", or "triage help@ inbox".
metadata:
  {
    "openclaw":
      {
        "emoji": "🗂️",
        "requires": { "bins": ["node", "python3"] },
        "env": ["EXEC_DESK_ROOT", "PIN_SHEET_CSV", "SITE_URL", "ETSY_LISTING_URL", "OWNER_CHANNEL"]
      },
  }
---

# Executor's Desk ops

Operates the funnel described in `business/executors-desk/` (set `EXEC_DESK_ROOT` to that path). Voice rules in `08-brand/voice-guide.md` apply to every word you write. Never publish anything grief-adjacent or legal without the owner's approval except pre-approved pin titles.

## Jobs

### 1. Daily pin (`pin-daily` cron)
1. Read `05-traffic/pins-queue.csv` (create from `05-traffic/pinterest-plan.md` with `scripts/seed_pins.py` if missing).
2. Take the first row without `posted_at`. Write a two-sentence description in the voice guide: fact, why, then "Free 72-hour checklist at theexecutorsdesk.com/72."
3. Render the image: `node scripts/render_pin.mjs --title "<title>" --out /tmp/pin.png` (1000×1500, uses the brand CSS).
4. Post via the Pinterest API (`scripts/post_pin.py`, needs `PINTEREST_TOKEN`) with the destination URL and UTM `utm_source=pinterest&utm_medium=pin&utm_campaign=pin-<id>`.
5. Write `posted_at` and `pin_id` back to the CSV. On failure, message the owner once and stop.

### 2. Weekly article draft (`article-weekly` cron)
1. Read `05-traffic/seo-plan.md`, find the first B-series brief without a file in `05-traffic/articles/`.
2. Draft 1,200 to 1,800 words in the voice guide with YAML front matter, question H2s, one table, a "What the notebook adds" section, `[OPT-IN BLOCK]`, and the legal line. No invented statistics. No invented personal stories. Say where state rules vary and where to verify.
3. Save to `05-traffic/articles/<id>-<slug>.md` with `status: draft` in the front matter.
4. Message the owner: title, path, and "reply 'publish <id>' to approve". Do not publish.

### 3. Weekly report (`weekly-report` cron)
Run `python3 scripts/weekly_report.py` (reads Stripe and GA4 if keys are set, otherwise reads `06-analytics/manual-week.csv`), then send the plain-text summary to `OWNER_CHANNEL`. Flag the five KPIs against the thresholds in `06-analytics/kpis-and-unit-economics.md`.

### 4. Etsy check (`weekly-etsy-check` cron)
If `ETSY_API_KEY` is set, read the listing's views, favorites and orders for 30 days. If orders are under 3, propose (do not apply) two tag swaps from `05-traffic/seo-plan.md` keyword clusters and a new first image. Send the proposal to the owner.

### 5. Support triage (Gmail hook or `support-hourly` cron)
For each unread message to help@:
- **Refund request within 30 days of purchase:** reply with the approval text in `references/support-replies.md`, and message the owner with the Stripe charge id to refund (or, if `STRIPE_KEY` has refund permission and the owner has enabled `AUTO_REFUND=1`, issue the refund and log it).
- **Correction or error report:** append to `06-analytics/corrections-log.md` with date, page, claim, and source; thank the sender using the template; message the owner.
- **Process question:** draft a reply in the voice guide that answers from the notebook's content, never gives state-specific legal advice, and points to the relevant page. Save as a Gmail draft for the owner. Do not send.

## Safety rules
- Never send SMS. Never post to Facebook groups or Reddit automatically.
- Never change prices, ad budgets, or publish articles without an explicit owner message.
- Every failure is reported once, then the job waits for its next scheduled run.
