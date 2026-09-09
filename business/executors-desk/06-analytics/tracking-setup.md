# Tracking setup

Goal: one dashboard, updated automatically, showing the five KPIs. Nothing here needs a developer.

## Events (GA4 names; fire the same names into Meta Pixel and Google Ads)
| Event | Where it fires | Parameters |
|---|---|---|
| `view_72` | `/72` page view | source, medium, campaign (from UTM) |
| `lead_72` | `/72/thanks` page view | same |
| `view_notebook` | `/notebook` page view | |
| `begin_checkout` | `/checkout` page view | |
| `purchase` | `/thank-you` page view | value (order total incl. bump/upsell), currency USD, items |
| `upsell_view` | `/ledger-offer` view | |
| `refund` | systeme.io refund webhook → n8n → GA4 Measurement Protocol | value |

## Where to paste what
1. **GA4**: create the property; copy the Measurement ID into systeme.io → Settings → Tracking. Mark `lead_72` and `purchase` as key events.
2. **Google Ads**: link the GA4 property; import `lead_72` and `purchase` as conversions. Primary for bidding: `lead_72` for the first 30 days.
3. **Meta Pixel**: paste the pixel ID into systeme.io. Map `lead_72` → Lead, `purchase` → Purchase with value. Set up the Conversions API through systeme.io's Meta integration if available; otherwise browser pixel only is acceptable at this scale.
4. **UTMs**: every link outside the site carries `utm_source`, `utm_medium`, `utm_campaign`. Pinterest pins: `utm_source=pinterest&utm_medium=pin&utm_campaign=<pin-id>`. Emails: `utm_source=email&utm_medium=<sequence>&utm_campaign=<email-number>`. Etsy PDF link: `utm_source=etsy&utm_medium=pdf`.
5. **Etsy**: Etsy Stats → export monthly. The weekly automation pulls views, favorites, orders via the Etsy API where available, otherwise from the CSV export you drop into the shared folder.

## The dashboard (Google Sheet, fed by n8n weekly)
Tabs: `weekly` (one row per week: spend by channel, page views, opt-ins, orders, AOV, revenue, refunds, Etsy views/orders, Pinterest outbound clicks), `cohorts` (opt-ins by week and their 60-day revenue), `kpis` (the five numbers with conditional formatting against the thresholds). The n8n workflow `weekly-report.json` appends the row and emails the owner a plain-text summary.

## Privacy
Cookie banner where required (systeme.io has one). Privacy policy names GA4, Meta Pixel, Stripe and the email provider. No SMS, no phone collection.
