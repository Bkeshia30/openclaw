# systeme.io setup (the recommended stack)

Free plan to start. Upgrade to Startup ($17/mo) the day you need a second automation rule or pass 2,000 contacts. Every step below is inside systeme.io unless stated.

## 0. Account and domain
1. Create the account. Set the sender name to "The Executor's Desk" and the sender email to help@yourdomain. Verify the domain for sending (SPF, DKIM, DMARC records in your DNS; systeme.io shows the exact records).
2. Add the custom domain (free plan allows one). Point it at systeme.io per their DNS instructions.
3. Settings → Payment gateways: connect Stripe (and PayPal if you want it). Enable Apple Pay and Google Pay in Stripe; the buyer is on a phone at night.

## 1. Products
Create three products under **Products → Digital products**:
| Product | Price | File |
|---|---|---|
| The First 90 Days | $27 | Upload `The-First-90-Days-Executors-Working-Notebook.pdf` |
| Scripts & Letters Pack | $9 | Upload `Executor-Scripts-and-Letters-Pack.pdf` |
| The Estate Ledger | $37 (and a $19 variant) | "Link" delivery: the Google Sheets copy URL plus the video URL |

## 2. Funnel
**Funnels → Create → Sell a product.** Name: `Executor core`. Steps in order:
1. **Opt-in** — path `/72`. Copy from `landing-page-copy.md`. Form fields: email, first name (optional). On submit → step 2. Automation: add tag `lead-72`, send the checklist email (see `04-email`).
2. **Thank you + offer** — path `/72/thanks`. Copy from `landing-page-copy.md`. Button → step 4 (checkout).
3. **Sales page** — path `/notebook`. Paste the HTML from `landing-page.html` into a "custom code" block, or rebuild with the editor using the copy. Button → checkout.
4. **Order form** — path `/checkout`. Product: The First 90 Days. Enable **Order bump**: Scripts & Letters Pack, copy from `checkout-bump-upsell-copy.md`.
5. **Upsell** — path `/ledger-offer`. Product: The Estate Ledger $37. One-click purchase enabled (Stripe stores the card for the session). Decline link → step 6.
6. **Downsell** — path `/ledger-offer/wait`. Product: Ledger $19. Decline → step 7.
7. **Thank you** — path `/thank-you`. Shows the download links conditionally: systeme.io shows files for purchased products automatically on the "Digital product access" block.

## 3. Tags (used by automations and reporting)
`lead-72`, `buyer-notebook`, `buyer-bump`, `buyer-ledger`, `buyer-ledger-lite`, `refunded`, `etsy-buyer` (added when someone opts in from the link inside the Etsy PDF, via a separate opt-in page at `/72e` that is identical except for the tag).

## 4. Automation rules (free plan: one rule; Startup: ten)
Priority order if you are on the free plan and can only have one: use rule 2.
1. Trigger: form submitted on `/72` → Actions: add tag `lead-72`, subscribe to campaign **Nurture (10 days)**.
2. Trigger: product purchased (The First 90 Days) → Actions: add tag `buyer-notebook`, remove from campaign Nurture, subscribe to campaign **Onboarding (30 days)**.
3. Trigger: product purchased (Scripts & Letters) → add tag `buyer-bump`.
4. Trigger: product purchased (Ledger, either price) → add tag `buyer-ledger` or `buyer-ledger-lite`, remove from campaign **Ledger pitch**.
5. Trigger: order form visited but no purchase after 4 hours (systeme.io "abandoned cart" trigger in Startup) → subscribe to campaign **Abandoned checkout**.
6. Trigger: tag `buyer-notebook` added and `buyer-ledger` absent after 3 days → subscribe to campaign **Ledger pitch**.
7. Trigger: refund → add tag `refunded`, unsubscribe from all campaigns.

## 5. Campaigns (email sequences)
Create four campaigns and paste the emails from `04-email/`:
- **Nurture (10 days)** — 5 emails, days 0, 1, 3, 6, 10
- **Onboarding (30 days)** — 4 emails, days 0, 2, 7, 30
- **Ledger pitch** — 3 emails, days 3, 5, 8 after purchase (skipped if they bought the ledger)
- **Abandoned checkout** — 3 emails, hours 4, 24, 72

## 6. Blog
**Blog → Create.** Path `/blog`. Publish the three finished articles in `05-traffic/articles/`, then one per week from the briefs in `05-traffic/seo-plan.md`. Every article ends with the `/72` opt-in block.

## 7. Tracking
- Settings → Tracking: paste the Google Analytics 4 measurement ID, the Google Ads conversion tag, and the Meta Pixel. See `06-analytics/tracking-setup.md` for which event fires where.
- Thank-you page: add the purchase conversion snippet with the order value variable.

## 8. Legal pages
Create Privacy, Terms, Refund pages (systeme.io has templates). Add to the footer of every page. Add the "not legal advice" line to every sales page footer.

## 9. Test the whole thing
Use Stripe test mode. Run: opt-in → check the checklist arrives → buy with the bump → decline the upsell → take the downsell → confirm the thank-you page shows the right three files and the emails arrive with the right tags. Then switch Stripe to live and do one real $27 purchase with your own card and refund it.
