# Google Search ads

Primary paid channel. The buyer types the question; the ad answers with the free checklist. Estate terms sit at the low end of legal CPCs because most advertisers want litigation clients, not families.

## Account structure
One campaign, Search only, US, English. No Display expansion, no Search Partners. Manual CPC or Maximize Conversions with a $6 target CPA for opt-ins after 30 conversions.

**Ad groups (exact and phrase match only; no broad match):**
| Ad group | Keywords | Landing |
|---|---|---|
| Parent died checklist | [what to do when a parent dies], "what to do when a parent dies checklist", [checklist after death of parent], "things to do when a parent dies" | `/72` |
| Executor checklist | [executor checklist], "executor duties checklist", [executor of estate checklist], "personal representative checklist" | `/72` |
| Executor duties | "what does an executor do", [executor of estate duties], "executor responsibilities" | `/72` |
| Death certificates | [how many death certificates do i need], "how many copies of death certificate" | `/72` (article B1 later) |
| Liability | "executor personally liable", [executor mistakes] | Article A3 with the opt-in |
| Probate or not | [do i need probate], "small estate affidavit", "what happens if you don't probate a will" | Article B2 / `/72` |
| Notebook (brand + product) | [executor workbook], [executor planner pdf], "estate settlement workbook" | `/notebook` |

**Negative keywords (campaign level):** attorney, lawyer, law firm, near me, jobs, salary, software, app, template excel free, uk, canada, australia, ontario, definition, meaning, movie, book pdf free download, torrent, will template, make a will, estate planning, living trust, executor fee calculator (until the article exists).

## Ads (responsive search ads; 12 headlines, 4 descriptions; pin headline 1)
**Headlines**
1. The First 72 Hours Checklist (pinned)
2. What To Do When A Parent Dies
3. Ten Things That Cannot Wait
4. In Order, With The Reason
5. Free One-Page PDF
6. Written For The Adult Child
7. What Not To Do Yet
8. Executor Checklist, Plain Language
9. Not A Law Firm
10. No Consultation Pitch
11. Print It Tonight
12. The Executor's Desk

**Descriptions**
1. Most after-death checklists are forty items written by a bank. This one is ten, in order, with the reason beside each. Free.
2. The ten things that protect the house, the paperwork and the people, plus six things to decline this week. One page.
3. Free 72-hour checklist for new executors. Then a short series on the first 90 days. No calls, no consultations.
4. General information, not legal advice. Practical tools for settling a parent's estate in the US.

**Sitelinks:** Executor duties in order · Can an executor be liable · Do you need probate · The 90-day notebook ($27)

## Budget and expectations
- $15 per day to start; $450 a month.
- Expected CPC $1.50 to $3 on these terms. At $2 and a 35% opt-in rate, cost per opt-in is about $5.70. At 10% of opt-ins buying within 14 days at a $36 average order, cost per purchase is about $57 against $36 of revenue on the first order. The channel is not profitable on the first purchase alone; it is profitable when the opt-in rate is 40%+, the email conversion reaches 12%, and the list is worked for the Ledger and State Addenda. Track it as cost per opt-in and revenue per opt-in over 60 days, not as day-one ROAS.
- Kill rule: any keyword with 40 clicks and no opt-in is paused. Any ad group with cost per opt-in over $9 after 14 days gets rewritten, not just paused.

## Conversion tracking
Import the GA4 events `lead_72` (thank-you page view) and `purchase` (with value) as Google Ads conversions. Set `lead_72` as the primary conversion for bidding during the first 30 days. See `06-analytics/tracking-setup.md`.
