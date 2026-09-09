# Launch checklist: 14 days to live

Work top to bottom. Nothing on day N depends on anything after it.

## Day 1: accounts
- [ ] Register theexecutorsdesk.com (or fallback per `08-brand/brand.md`)
- [ ] systeme.io account, custom domain, sender email verified (SPF/DKIM/DMARC)
- [ ] Stripe account, Apple Pay / Google Pay on
- [ ] Google Analytics 4 property; Google Ads account; Meta Business + Pixel; Pinterest business account
- [ ] Etsy shop "TheExecutorsDesk"
- [ ] help@ mailbox

## Day 2: product
- [ ] Rebuild PDFs (`02-product/build_pdfs.mjs`) after filling the PERSONALIZE blocks in the sales copy (the PDFs have none)
- [ ] Optional: open the notebook in Acrobat → Prepare Form → auto-detect fields → save a "fillable" variant
- [ ] Send the notebook to a probate attorney for a one-pass review; ask specifically about the state quick reference and the tax section
- [ ] Print it once. Photograph it on a desk. Ten photos for Etsy, three for the sales page.

## Days 3 to 4: funnel
- [ ] Build the seven funnel steps per `03-funnel/systeme-io-setup.md`
- [ ] Paste copy from `landing-page-copy.md` and `checkout-bump-upsell-copy.md`; or paste `landing-page.html` into a custom-code block for `/notebook`
- [ ] Upload the three PDFs as products; set the bump; set the upsell/downsell (Ledger delivered as the Google Sheets copy link)
- [ ] Create tags; create the automation rules (rule 2 first if on the free plan)
- [ ] Create the four email campaigns from `04-email/`; import `sequences.json` or paste
- [ ] Legal pages: privacy, terms, refunds; the "not legal advice" line in every footer
- [ ] Tracking IDs pasted; events verified in GA4 DebugView; `purchase` value fires on `/thank-you`

## Day 5: test
- [ ] Stripe test mode: opt-in → checklist email → buy with bump → decline upsell → take downsell → downloads correct → tags correct → onboarding email arrives
- [ ] Switch to live; buy once with your own card; refund it; confirm the refund tag and log

## Day 6: Etsy
- [ ] Listing 1 (notebook, $19.50) and Listing 2 (feeder, $9) per `03-funnel/etsy-listings.md`; export pages 6 and 9 of the notebook for the feeder file
- [ ] Add the `/72e` link to page 30 of the Etsy variant (rebuild with the Etsy URL) so Etsy buyers join the list
- [ ] Message-to-buyers text set

## Day 7: content
- [ ] Publish A1, A2, A3 from `05-traffic/articles/` on the blog with the opt-in block
- [ ] Pinterest: 8 boards; pin the first 10 titles by hand using `render_pin.mjs` images
- [ ] Seed the `pins-queue.csv` and the briefs sheet for automation

## Days 8 to 9: automation
- [ ] Choose n8n (import the four JSON workflows, set credentials and env vars) or OpenClaw (copy the skill, set env, add the five cron jobs from `07-automation/openclaw-cron-jobs.md`)
- [ ] Run each job once by hand; confirm the owner-notification path works
- [ ] Google Ads and Meta automated rules from the traffic docs (pause thresholds)

## Day 10: Google Search ads
- [ ] Campaign per `05-traffic/google-ads.md`, $15/day, `lead_72` as the primary conversion
- [ ] Negatives list pasted; no broad match

## Days 11 to 13: watch, do not touch
- [ ] Read the opt-in rate daily. Under 20% after 200 visits: rewrite the `/72` headline before anything else.
- [ ] Read every reply to the nurture emails. They tell you what the next product is.

## Day 14: Meta ads
- [ ] Only if opt-in rate is above 30%: launch the 8 creatives at $20/day optimizing for Lead, per `05-traffic/meta-ads.md`
- [ ] Weekly report arrives Sunday; from here the system runs and you review a draft article on Mondays

## Month 2 and after
- [ ] Upload the Estate Ledger xlsx to Google Drive as a Sheet, record the video; switch on the Ledger pitch sequence
- [ ] First State Addendum (Texas, Florida, California or New York, whichever the list asks for most)
- [ ] Offer the free checklist to three hospice social workers and three funeral homes as a printed handout with the URL
