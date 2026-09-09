# Automation map: what runs without you

Everything after launch is either (a) native to systeme.io and Stripe, (b) an n8n workflow, or (c) an OpenClaw cron job. Two options are given for (b)/(c) because this repo is OpenClaw; use whichever you already run. Nothing publishes public content without the owner approving a draft, on purpose: grief-adjacent copy with a legal dimension should have one human read it.

| # | Job | Trigger | Runs in | Human in loop? | File |
|---|---|---|---|---|---|
| 1 | Deliver the free checklist, start nurture | Opt-in form | systeme.io automation rule | No | `03-funnel/systeme-io-setup.md` §4 |
| 2 | Deliver purchases, tag, start onboarding, stop nurture | Stripe payment | systeme.io automation rule | No | same |
| 3 | Abandoned checkout emails | Order page visited, no payment in 4 h | systeme.io (Startup plan) | No | same |
| 4 | Ledger pitch to non-buyers | Tag + 3 days | systeme.io | No | same |
| 5 | Refund handling (tag, unsubscribe, log) | Stripe refund webhook | n8n `refund-handler.json` or systeme.io rule | No | `n8n-workflows/` |
| 6 | Pinterest pin scheduling from the title list | Daily 09:10 | n8n `pin-scheduler.json` or OpenClaw cron `pin-daily` | No (images generated from the templated HTML; titles pre-approved in the plan) | `n8n-workflows/`, `openclaw-skill/` |
| 7 | Weekly SEO article draft from the next brief | Monday 06:00 | n8n `article-drafter.json` or OpenClaw cron `article-weekly` | **Yes**: draft lands in a "review" folder/Notion page and a chat message; owner replies "publish" | same |
| 8 | Weekly KPI report to the owner | Sunday 18:00 | n8n `weekly-report.json` or OpenClaw cron `weekly-report` | No | same |
| 9 | Etsy listing health check (views, favorites, renewals, tag rotation suggestion) | Weekly | OpenClaw cron `weekly-etsy-check` | Suggests; owner applies (Etsy API write access requires app approval) | `openclaw-skill/` |
| 10 | Review request at day 30 | Tag + 30 days | systeme.io campaign | No | `04-email/` |
| 11 | Support inbox triage (refund requests, corrections, questions) | New email to help@ | OpenClaw Gmail hook or n8n Gmail trigger | Refunds: auto-approve within 30 days and log. Corrections: open an issue in the corrections log. Questions: draft a reply for the owner. | `openclaw-skill/` |
| 12 | Ad guardrails: pause a Google keyword after 40 clicks with no opt-in; pause a Meta creative with CPL over $6 after 7 days | Daily | Google Ads automated rules and Meta automated rules (native, no code) | No | `05-traffic/google-ads.md`, `meta-ads.md` |
| 13 | PDF rebuild when the source HTML changes (typo fixes, state updates) | git push to `main` touching `02-product/src` | GitHub Action `.github/workflows/executors-desk-pdfs.yml` (optional; see below) | No | `07-automation/github-action-pdf-build.yml` |

## Credentials the automations need (store in n8n credentials or OpenClaw's secrets, never in the repo)
- systeme.io API key (contacts, tags) · Stripe restricted key (read charges, refunds) · Pinterest API app (create pins) · GA4 Data API service account (read) · Google Sheets (dashboard) · Etsy API key (read stats; write requires Etsy app approval) · Gmail or the help@ mailbox (read, draft) · a Claude API key for drafting (articles, replies, pin descriptions).

## Failure behaviour
Every workflow posts a one-line failure message to the owner's chat (WhatsApp/Telegram via OpenClaw, or Slack via n8n). No workflow retries a publish action more than once. A failed pin or article simply waits for the next scheduled run.
