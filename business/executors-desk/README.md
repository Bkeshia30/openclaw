# The Executor's Desk — a low-ticket digital product business, fully specified

**What this is:** the research, the product, the funnel, the copy, the traffic plans, the analytics and the automation for selling one $27 PDF workbook to a specific buyer: the adult child who has just been named executor of a parent's estate in the United States.

**Why this niche:** structural demand (about 2.6 million boomer deaths a year, rising to 4 million), a trigger event with real deadlines, a stressed buyer who will pay $27 without shopping around, thin competition on Etsy and almost none in funnel form, and a product that is a *tool* rather than information, which is what free bank checklists cannot match. Full reasoning and sources: `01-research/market-research.md`.

## What is in this folder
| Folder | Contents | Status |
|---|---|---|
| `01-research/` | Niche scorecard (10 candidates), buyer profile, demand and competition analysis, pricing, platform decision, unit economics, risks, 70+ sources | Done |
| `02-product/` | Source HTML + CSS for three products, build script, and the **rendered PDFs** in `pdf/`: the 30-page notebook ($27), the 1-page free checklist, the 6-page Scripts & Letters Pack ($9 bump) | Done; attorney review recommended before launch |
| `03-funnel/` | Offer stack, funnel map, opt-in / thank-you / sales page copy, checkout + bump + upsell + downsell + delivery copy, a deployable `landing-page.html`, systeme.io step-by-step, GoHighLevel mapping, Etsy listings, Estate Ledger (upsell) build spec | Done; Ledger sheet to build (1 day) |
| `04-email/` | 15 emails in four sequences (nurture, onboarding, ledger pitch, abandoned checkout) plus Etsy buyer message; `sequences.json` for import | Done |
| `05-traffic/` | SEO plan with 24 briefs and 3 finished articles, Pinterest plan with 60 pin titles (+ `pins-queue.csv`), Meta ads (8 creatives, policy rules), Google Search ads (7 ad groups, RSA copy, negatives), 12-week `content-calendar.csv` | Done |
| `06-analytics/` | The five KPIs with kill thresholds, unit economics and break-even by channel, `unit_economics.py` calculator, GA4/Ads/Pixel tracking spec, dashboard spec | Done |
| `07-automation/` | Automation map (13 jobs), four importable n8n workflows, an OpenClaw skill with working scripts (pin renderer, pin poster, queue seeder, weekly report), OpenClaw cron commands, optional GitHub Action to rebuild PDFs | Done; needs API keys |
| `08-brand/` | Voice guide (the anti-generic rules) and brand sheet | Done |
| `LAUNCH-CHECKLIST.md` | The 14-day order of operations to go live | Start here |

## Rebuild the PDFs
```bash
cd 02-product
npm i -D playwright@1.56.1 && npx playwright install chromium   # once
node build_pdfs.mjs                                            # writes pdf/*.pdf
```

## The three decisions already made for you
1. **Platform:** systeme.io (free, then $17/mo) for the funnel; Etsy in parallel as a discovery channel. GoHighLevel mapping is included if you already pay for it. Reasoning in the research doc, section 7.
2. **Traffic order:** Google Search ads to the free checklist first, SEO articles and Pinterest from day one for the long game, Meta ads in week four with story-led statics, Etsy always on.
3. **Tone:** no urgency tricks, no exclamation marks, no invented stories. The voice guide is the product's moat.

## What you still have to do yourself
- Register the domain and create the systeme.io, Stripe, Etsy, Pinterest, GA4 and ads accounts (about half a day).
- Write the two or three true sentences in the "Who wrote this" blocks (marked PERSONALIZE).
- Photograph the printed pages for the sales page and Etsy (an hour).
- Build the Estate Ledger sheet from `03-funnel/estate-ledger-spec.md` and record the 12-minute walkthrough (a day).
- Have a probate attorney read the notebook once ($300 to $500). The state quick-reference figures are starting points and are labeled as such; a licensed review is cheap insurance.
