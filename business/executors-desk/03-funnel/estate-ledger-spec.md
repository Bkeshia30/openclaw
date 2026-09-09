# Estate Ledger (upsell) — build spec

Google Sheets template, one file, five tabs. Buyer receives a "make a copy" link. Build in Sheets, not Excel, so the walkthrough video and the buyer's copy match.

## Tabs
1. **Start here** — instructions in 12 lines, the decedent's details (name, date of death, EIN, court case number), and a "what to fill in first" order.
2. **Inventory** — one row per asset. Columns: category (dropdown: bank, brokerage, retirement, life insurance, real estate, vehicle, personal property, business, receivable, digital), institution, account last 4, how it passes (A/B/C, matching the notebook), date-of-death value, source of value (statement, appraisal, guide), current status (located, valued, retitled, sold, distributed), notes. Totals by category and by A/B/C at the top.
3. **Ledger** — every estate-account transaction. Columns: date, payee/payer, category (dropdown: income-interest, income-dividend, income-other, sale proceeds, funeral, administration, legal, accounting, tax, debt paid, distribution, reimbursement to executor, transfer in), amount in, amount out, running balance (formula), receipt? (checkbox), notes. Conditional formatting: any row without a receipt turns amber.
4. **Claims** — creditor claims. Columns: creditor, date received, amount claimed, secured?, documentation received?, allowed / disputed / rejected, amount allowed, date paid, notes. A cell at the top for the creditor-window close date; rows dated after it turn red.
5. **Distribution** — beneficiaries with percentage or specific gift, computed share from the ledger's net (formula), partial distributions paid, balance owed, receipt and release signed (checkbox).
6. **Final accounting** — a print-ready summary pulling from Ledger and Inventory: opening inventory value, income received, gains and losses, expenses by category, distributions, closing balance. Formatted to match what most probate courts ask for in a formal accounting.

## Rules
- No macros or scripts. Formulas only, so the copy works for anyone.
- Freeze header rows; data validation on every dropdown; protect formula cells.
- One accent color, the same green as the PDFs (#2f4f4f). No emoji.
- Include three example rows in gray italic that the buyer deletes.

## Walkthrough video (12 minutes)
1. Make a copy (30 s). 2. Start here tab (1 min). 3. Enter one asset, watch totals (2 min). 4. Enter five ledger rows, including an executor reimbursement (3 min). 5. Enter a claim and dispute it (2 min). 6. Set distribution shares and watch the math (2 min). 7. Print the final accounting (1 min).
