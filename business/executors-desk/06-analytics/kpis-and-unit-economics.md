# KPIs and unit economics

## The five numbers that matter (check weekly, automated report in `07-automation`)
| # | Metric | Formula | Target | Kill / fix threshold |
|---|---|---|---|---|
| 1 | Opt-in rate | opt-ins ÷ `/72` page views | 35% | under 20%: rewrite the page, not the ads |
| 2 | Revenue per opt-in (60-day) | all revenue from a cohort of opt-ins ÷ opt-ins | $4.00 | under $2.00: the emails or the offer are the problem |
| 3 | Cost per opt-in (paid) | ad spend ÷ paid opt-ins | under $6 | over $9 for 14 days: pause the channel |
| 4 | Average order value | revenue ÷ orders | $36 | under $30: bump copy or placement is broken |
| 5 | Refund rate | refunds ÷ orders (30-day) | under 3% | over 6%: read every refund reason that week |

Secondary: Etsy views → orders (target 3%+ after 50 sales), Pinterest outbound clicks per week, organic sessions per week, email open rate on the nurture (target 45%+; it is a requested PDF), bump take rate (35%), upsell take rate (15%).

## Unit economics per order (expected case)
| Line | Amount |
|---|---|
| Core | $27.00 |
| Bump at 35% take | +$3.15 |
| Upsell $37 at 15% | +$5.55 |
| Downsell $19 at 10% of the 85% who decline | +$1.62 |
| **Average order value** | **$37.32** (use $36 in planning) |
| Stripe fees (2.9% + $0.30) | −$1.38 |
| Refunds at 3% | −$1.12 |
| **Net per order** | **≈ $34.80** |
| Delivery cost | $0 |

## Break-even by channel
| Channel | Cost per opt-in | Opt-ins per order (at 10% email conversion) | Cost per order | Net after cost |
|---|---|---|---|---|
| Google Search | $5.70 | 10 | $57 | −$22 first order; positive at 16% email conversion or with State Addendum revenue |
| Meta (lead-optimized) | $4.50 | 10 | $45 | −$10 first order; positive at 13% |
| Pinterest organic | $0 | 10 | $0 | +$35 |
| SEO organic | $0 | 10 | $0 | +$35 |
| Etsy | $2.31 fees on $19.50 | direct | $2.31 | +$17 |

Reading: paid traffic buys the list; the list is worked for 60 days and the second products carry the margin. Organic channels are the profit. The plan spends on paid only while opt-in rate is above 30% and revenue per opt-in is above $3.

## Monthly targets (from the research doc)
| Month | Orders | Revenue at $36 | Ad spend | Net before tools |
|---|---|---|---|---|
| 1 | 10 | $360 | $0 | $360 |
| 2 | 35 | $1,260 | $600 | $660 |
| 3 | 70 | $2,520 | $600 | $1,920 |
| 6 | 150 | $5,400 | $900 | $4,500 |
| 12 | 250 | $9,000 | $1,200 | $7,800 |

Tools: systeme.io $0 → $17/mo; domain $12/yr; Etsy $0.20 per listing; n8n cloud $24/mo or self-hosted $0 (or OpenClaw's cron, $0). Attorney review of the notebook before launch: $300 to $500, one time.

## Calculator
`06-analytics/unit_economics.py` recomputes everything above from your real numbers. Run: `python3 unit_economics.py --optin-rate 0.32 --email-conv 0.09 --cpc 2.10 --bump 0.3 --upsell 0.12`.
