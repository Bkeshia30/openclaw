# Funnel map

Two lanes. Both feed one email list. Nothing in either lane requires a human after setup.

```
                 ┌─────────────── LANE A: own funnel (systeme.io) ───────────────┐
Google Search ads ─┐                                                                │
SEO articles ──────┤                                                                │
Pinterest pins ────┼──►  /72  opt-in page  ──►  thank-you page with $27 offer ──►  checkout (+$9 bump)
Meta ads ──────────┤          │                                                        │
Reddit / FB groups ┘          │ (email captured)                                       ▼
                              ▼                                          post-purchase OTO: $37 Ledger
                    5-email nurture over 10 days                                       │ declined?
                    (see 04-email/nurture-sequence.md)                                 ▼
                              │                                          downsell: $19 Ledger (no video)
                              └──► /notebook sales page ──► checkout ──►               │
                                                                                       ▼
                                                                    delivery email + 4-email onboarding
                                                                                       │
                                                                          day 14: State Addendum offer
                                                                          day 30: review request

                 ┌─────────────── LANE B: Etsy (discovery) ───────────────┐
Etsy search ──► listing ($19.50 notebook) ──► instant download
Pinterest pins ─┘      │
                       └── $9 feeder listing (72-hour checklist + death certificate tracker)
                                                     │
                       last page of every PDF links to /72 ──► joins the email list ──► Lane A from here
```

## Pages to build (all in systeme.io)
| Path | Type | Copy file |
|---|---|---|
| `/72` | Opt-in page | `03-funnel/landing-page-copy.md` § Opt-in page |
| `/72/thanks` | Thank-you + tripwire offer | `03-funnel/landing-page-copy.md` § Thank-you page |
| `/notebook` | Long-form sales page | `03-funnel/landing-page-copy.md` § Sales page (also rendered as `03-funnel/landing-page.html`) |
| `/checkout` | Order form with bump | `03-funnel/checkout-bump-upsell-copy.md` |
| `/ledger-offer` | One-time offer | `03-funnel/checkout-bump-upsell-copy.md` |
| `/ledger-offer/wait` | Downsell | `03-funnel/checkout-bump-upsell-copy.md` |
| `/thank-you` | Delivery page | `03-funnel/checkout-bump-upsell-copy.md` |
| `/blog/...` | SEO articles | `05-traffic/seo-plan.md` and `05-traffic/articles/` |

## Conversion targets by step (cold traffic)
| Step | Target | Kill threshold (fix before spending more) |
|---|---|---|
| Ad click → opt-in page view | 85%+ (page speed) | under 70% |
| Opt-in page → email | 35% | under 20% |
| Thank-you page → $27 purchase (immediate) | 4% | under 1.5% |
| Nurture emails → purchase within 14 days | 8% of opt-ins | under 3% |
| Checkout → bump taken | 35% | under 20% |
| Purchase → $37 upsell | 15% | under 7% |
| Decline → $19 downsell | 12% | under 5% |
| Refund rate | under 3% | over 6% |

## Why the tripwire is on the thank-you page and not the opt-in page
The opt-in is the only step that must work for cold traffic. Putting the $27 offer after the email capture means every paid click that opts in has 10 days of automated follow-up to convert, instead of one shot.
