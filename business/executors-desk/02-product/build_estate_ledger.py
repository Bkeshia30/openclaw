#!/usr/bin/env python3
"""Builds The Estate Ledger workbook (the $37 upsell) from the spec in 03-funnel/estate-ledger-spec.md.

Output: 02-product/ledger/The-Estate-Ledger.xlsx
Upload to Google Drive and open with Google Sheets; formulas, dropdowns and conditional formatting carry over.
Formulas only, no macros. Run: python3 build_estate_ledger.py
"""
import os
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

ACCENT = "2F4F4F"; INK = "1D1D1B"; MUTED = "5C5A55"; RULE = "C9C5BB"; INPUT = "FBF7EA"; AMBER = "FFF1C9"; RED = "F5DADA"; SOFT = "E7ECEA"
F = "Arial"
H = Font(name=F, bold=True, color="FFFFFF", size=10)
B = Font(name=F, size=10, color=INK)
BB = Font(name=F, size=10, bold=True, color=INK)
T = Font(name=F, size=16, bold=True, color=INK)
K = Font(name=F, size=9, bold=True, color=ACCENT)
M = Font(name=F, size=9, color=MUTED)
EX = Font(name=F, size=10, italic=True, color="8A8780")
hdr_fill = PatternFill("solid", fgColor=ACCENT)
in_fill = PatternFill("solid", fgColor=INPUT)
soft_fill = PatternFill("solid", fgColor=SOFT)
thin = Side(style="thin", color=RULE)
bottom = Border(bottom=thin)
MONEY = '$#,##0.00;($#,##0.00);"-"'
DATE = "yyyy-mm-dd"
PCT = "0.0%"
N = 200  # data rows per table

wb = Workbook()

def title(ws, text, sub=None):
    ws["A1"] = "THE EXECUTOR'S DESK"; ws["A1"].font = K
    ws["A2"] = text; ws["A2"].font = T
    if sub: ws["A3"] = sub; ws["A3"].font = M
    ws.sheet_view.showGridLines = False

def header(ws, row, cols, widths=None):
    for i, c in enumerate(cols, 1):
        cell = ws.cell(row=row, column=i, value=c); cell.font = H; cell.fill = hdr_fill
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.row_dimensions[row].height = 30
    if widths:
        for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w

def input_cols(ws, r0, r1, cols):
    for r in range(r0, r1 + 1):
        for c in cols:
            cell = ws.cell(row=r, column=c); cell.fill = in_fill; cell.font = B; cell.border = bottom
            cell.protection = Protection(locked=False)

def formula_cols(ws, r0, r1, cols, fmt=None):
    for r in range(r0, r1 + 1):
        for c in cols:
            cell = ws.cell(row=r, column=c); cell.font = B; cell.border = bottom
            if fmt: cell.number_format = fmt

def dv_list(ws, rng, options, allow_blank=True):
    dv = DataValidation(type="list", formula1='"' + ",".join(options) + '"', allow_blank=allow_blank, showErrorMessage=True,
                        errorTitle="Pick from the list", error="Choose one of the options in the dropdown.")
    ws.add_data_validation(dv); dv.add(rng)

def example(ws, row, values, italic_cols):
    for c, v in values.items():
        cell = ws.cell(row=row, column=c, value=v); cell.font = EX

# ---------------- Start here ----------------
ws = wb.active; ws.title = "Start here"
title(ws, "The Estate Ledger", "Inventory, ledger, claims, distribution and final accounting for one estate. Formulas only; no macros.")
ws.column_dimensions["A"].width = 30; ws.column_dimensions["B"].width = 60
lines = [
 "1. Fill in the estate details below. Shaded cells are yours to type in; white cells hold formulas and update by themselves.",
 "2. Inventory tab: one row per asset, at date-of-death value. Mark how each passes (A, B or C, the same sort as the notebook).",
 "3. Ledger tab: every transaction in the estate bank account, in date order. Money in on the left, money out on the right.",
 "4. Tick the Receipt column for every outgoing amount. Rows without a receipt turn amber until you do.",
 "5. Claims tab: every creditor claim as it arrives. Rows dated after the creditor window closes turn red.",
 "6. Distribution tab: beneficiaries and their shares. The computed share updates from the ledger balance and your reserve.",
 "7. Final accounting tab: print it. It pulls from the other tabs and is laid out the way courts and beneficiaries expect.",
 "8. Delete the three gray italic example rows on each tab once you have entered your own.",
 "9. Do not insert columns. Adding rows inside a table is fine; the totals cover 200 rows per table.",
 "10. Categories are dropdowns. If a transaction fits none, use the closest and explain in Notes.",
 "11. Reconcile the Ledger balance to the bank statement on the same day each month and write the date in the box below.",
 "12. Nothing here is legal or tax advice. Your CPA will want the Final accounting tab and the Ledger tab; send both.",
]
for i, l in enumerate(lines, 5):
    c = ws.cell(row=i, column=1, value=l); c.font = B; c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=2)
    ws.row_dimensions[i].height = 30
r = 19
ws.cell(row=r, column=1, value="ESTATE DETAILS").font = K
details = [("Decedent's full name", None), ("Date of death", DATE), ("Estate EIN", None), ("Court and case number", None),
           ("Executor / personal representative", None), ("Creditor claim window closes on", DATE),
           ("Reserve held back for taxes and final costs ($)", MONEY), ("Last bank reconciliation date", DATE)]
for i, (label, fmt) in enumerate(details, r + 1):
    ws.cell(row=i, column=1, value=label).font = BB
    c = ws.cell(row=i, column=2); c.fill = in_fill; c.border = bottom; c.font = B; c.protection = Protection(locked=False)
    if fmt: c.number_format = fmt
ws["B21"].comment = Comment("Typed as a date, e.g. 2026-03-14.", "Executor's Desk")
ws["B25"].comment = Comment("Ask the probate clerk. The Claims tab turns rows red after this date.", "Executor's Desk")
ws["B26"].comment = Comment("Money you keep in the estate account until the final tax bills are known. The Distribution tab subtracts it.", "Executor's Desk")
ws.cell(row=29, column=1, value="LEGEND").font = K
ws.cell(row=30, column=1, value="Shaded cell").fill = in_fill; ws.cell(row=30, column=2, value="Type here.").font = B
ws.cell(row=31, column=1, value="White cell").font = B; ws.cell(row=31, column=2, value="Formula. Leave it alone.").font = B
ws.cell(row=32, column=1, value="Gray italic row").font = EX; ws.cell(row=32, column=2, value="Example. Delete it.").font = B
ws.cell(row=34, column=1, value="Version 1.0, September 2026. General information, not legal or tax advice.").font = M
for row in ws.iter_rows(min_row=1, max_row=40, max_col=2):
    for c in row:
        if c.fill.fgColor.rgb != "00" + INPUT and c.fill.fgColor.rgb != INPUT: c.protection = Protection(locked=True)
ws.protection.sheet = True; ws.protection.formatCells = False

# ---------------- Inventory ----------------
inv = wb.create_sheet("Inventory")
title(inv, "Inventory", "One row per asset at date-of-death value. A = passes by beneficiary designation. B = passes by ownership or trust. C = probate estate.")
CATS = ["bank", "brokerage", "retirement", "life insurance", "real estate", "vehicle", "personal property", "business", "receivable", "digital"]
inv.cell(row=5, column=1, value="TOTALS BY CATEGORY").font = K
inv.cell(row=5, column=4, value="TOTALS BY HOW IT PASSES").font = K
HR = 18; D0 = HR + 1; D1 = HR + N
for i, cat in enumerate(CATS, 6):
    inv.cell(row=i, column=1, value=cat).font = B
    c = inv.cell(row=i, column=2, value=f"=SUMIF($A${D0}:$A${D1},A{i},$E${D0}:$E${D1})"); c.number_format = MONEY; c.font = B
for i, (k, lab) in enumerate([("A", "A: beneficiary designation (not probate)"), ("B", "B: joint / trust (not probate)"), ("C", "C: probate estate")], 6):
    inv.cell(row=i, column=4, value=lab).font = B
    c = inv.cell(row=i, column=6, value=f'=SUMIF($D${D0}:$D${D1},"{k}",$E${D0}:$E${D1})'); c.number_format = MONEY; c.font = B
inv.cell(row=9, column=4, value="All assets").font = BB
c = inv.cell(row=9, column=6, value=f"=SUM($E${D0}:$E${D1})"); c.number_format = MONEY; c.font = BB
inv.cell(row=10, column=4, value="Assets not yet valued (count)").font = B
c = inv.cell(row=10, column=6, value=f'=SUMPRODUCT(($B${D0}:$B${D1}<>"")*($E${D0}:$E${D1}=""))'); c.font = B
inv.cell(row=16, column=1, value="Each row: pick a category, name the institution, mark A/B/C, enter the date-of-death value and where it came from.").font = M
header(inv, HR, ["Category", "Institution / description", "Account last 4", "Passes (A/B/C)", "Date-of-death value", "Source of value", "Status", "Notes"],
       [18, 34, 14, 14, 18, 18, 14, 40])
input_cols(inv, D0, D1, [1, 2, 3, 4, 5, 6, 7, 8])
for r in range(D0, D1 + 1): inv.cell(row=r, column=5).number_format = MONEY
dv_list(inv, f"A{D0}:A{D1}", CATS)
dv_list(inv, f"D{D0}:D{D1}", ["A", "B", "C"])
dv_list(inv, f"F{D0}:F{D1}", ["statement", "appraisal", "guide value", "estimate"])
dv_list(inv, f"G{D0}:G{D1}", ["located", "valued", "retitled", "sold", "distributed"])
example(inv, D0, {1: "bank", 2: "First County Bank checking", 3: "4471", 4: "C", 5: 12480.22, 6: "statement", 7: "valued", 8: "Sole name, no POD. Moved to estate account 2026-04-02."}, [])
example(inv, D0 + 1, {1: "retirement", 2: "Fidelity IRA", 3: "9902", 4: "A", 5: 86310.00, 6: "statement", 7: "located", 8: "Beneficiary: the three children equally. Not probate."}, [])
example(inv, D0 + 2, {1: "real estate", 2: "14 Elm St, Dayton OH", 3: "", 4: "C", 5: 214000.00, 6: "appraisal", 7: "valued", 8: "Date-of-death appraisal 2026-04-10, J. Ortiz, licensed."}, [])
inv.freeze_panes = f"A{D0}"
inv.protection.sheet = True; inv.protection.formatCells = False; inv.protection.insertRows = False

# ---------------- Ledger ----------------
led = wb.create_sheet("Ledger")
title(led, "Ledger", "Every transaction in the estate bank account. Reconcile to the statement monthly.")
LCATS = ["income-interest", "income-dividend", "income-other", "sale proceeds", "transfer in", "funeral", "administration", "legal", "accounting", "tax", "debt paid", "distribution", "reimbursement to executor"]
LHR = 12; L0 = LHR + 1; L1 = LHR + N
summary = [("Total money in", f"=SUM($D${L0}:$D${L1})"), ("Total money out", f"=SUM($E${L0}:$E${L1})"),
           ("Balance in estate account", f"=B5-B6"), ("Outgoing rows without a receipt", f'=COUNTIFS($E${L0}:$E${L1},">0",$G${L0}:$G${L1},"<>Yes")')]
for i, (lab, f) in enumerate(summary, 5):
    led.cell(row=i, column=1, value=lab).font = BB if i == 7 else B
    c = led.cell(row=i, column=2, value=f); c.font = BB if i == 7 else B
    if i < 8: c.number_format = MONEY
led.cell(row=10, column=1, value="Money in goes in column D, money out in column E. Never both on one row. Receipt = Yes for every outgoing amount.").font = M
header(led, LHR, ["Date", "Payee / payer", "Category", "Money in", "Money out", "Running balance", "Receipt?", "Notes"], [12, 32, 24, 16, 16, 18, 10, 44])
input_cols(led, L0, L1, [1, 2, 3, 4, 5, 7, 8])
formula_cols(led, L0, L1, [6], MONEY)
for r in range(L0, L1 + 1):
    led.cell(row=r, column=1).number_format = DATE
    led.cell(row=r, column=4).number_format = MONEY; led.cell(row=r, column=5).number_format = MONEY
    led.cell(row=r, column=6, value=f'=IF(AND(D{r}="",E{r}=""),"",SUM($D${L0}:D{r})-SUM($E${L0}:E{r}))')
dv_list(led, f"C{L0}:C{L1}", LCATS)
dv_list(led, f"G{L0}:G{L1}", ["Yes", "No"])
led.conditional_formatting.add(f"A{L0}:H{L1}", FormulaRule(formula=[f'AND($E{L0}>0,$G{L0}<>"Yes")'], fill=PatternFill("solid", fgColor=AMBER)))
example(led, L0, {1: date(2026, 4, 2), 2: "First County Bank (transfer of sole-name checking)", 3: "transfer in", 4: 12480.22, 7: "Yes", 8: "Closing statement attached"}, [])
example(led, L0 + 1, {1: date(2026, 4, 5), 2: "Dayton Daily News", 3: "administration", 5: 145.00, 7: "Yes", 8: "Notice to creditors, 3 runs"}, [])
example(led, L0 + 2, {1: date(2026, 4, 9), 2: "Reimbursement to executor: death certificates", 3: "reimbursement to executor", 5: 187.50, 7: "No", 8: "Receipt in folder, not yet scanned"}, [])
for r in range(L0, L0 + 3): led.cell(row=r, column=1).number_format = DATE
led.freeze_panes = f"A{L0}"
led.protection.sheet = True; led.protection.formatCells = False

# ---------------- Claims ----------------
cl = wb.create_sheet("Claims")
title(cl, "Claims", "Every creditor claim as it arrives. Do not pay until the window closes and the estate is known to be solvent.")
cl.cell(row=5, column=1, value="Creditor window closes on").font = BB
c = cl.cell(row=5, column=2, value="=IF('Start here'!B25=\"\",\"\",'Start here'!B25)"); c.number_format = DATE; c.font = BB
cl.cell(row=5, column=3, value="(set on the Start here tab; rows received after this date turn red)").font = M
CHR = 11; C0 = CHR + 1; C1 = CHR + N
for i, (lab, f) in enumerate([("Total claimed", f"=SUM($C${C0}:$C${C1})"), ("Total allowed", f"=SUM($G${C0}:$G${C1})"),
                              ("Total paid (from Ledger, category 'debt paid')", f"=SUMIF(Ledger!$C${L0}:$C${L1},\"debt paid\",Ledger!$E${L0}:$E${L1})"),
                              ("Claims still pending (count)", f'=COUNTIF($F${C0}:$F${C1},"pending")')], 6):
    cl.cell(row=i, column=1, value=lab).font = B
    c = cl.cell(row=i, column=2, value=f); c.font = B
    if i < 9: c.number_format = MONEY
header(cl, CHR, ["Creditor", "Date received", "Amount claimed", "Secured?", "Documentation received?", "Status", "Amount allowed", "Date paid", "Notes"],
       [30, 14, 16, 11, 16, 12, 16, 12, 44])
input_cols(cl, C0, C1, list(range(1, 10)))
for r in range(C0, C1 + 1):
    cl.cell(row=r, column=2).number_format = DATE; cl.cell(row=r, column=8).number_format = DATE
    cl.cell(row=r, column=3).number_format = MONEY; cl.cell(row=r, column=7).number_format = MONEY
dv_list(cl, f"D{C0}:D{C1}", ["Yes", "No"]); dv_list(cl, f"E{C0}:E{C1}", ["Yes", "No"])
dv_list(cl, f"F{C0}:F{C1}", ["pending", "allowed", "disputed", "rejected", "paid"])
cl.conditional_formatting.add(f"A{C0}:I{C1}", FormulaRule(formula=[f'AND($B{C0}<>"",$B$5<>"",$B{C0}>$B$5)'], fill=PatternFill("solid", fgColor=RED)))
example(cl, C0, {1: "Capital One (card ending 2210)", 2: date(2026, 4, 20), 3: 3412.77, 4: "No", 5: "Yes", 6: "allowed", 7: 3412.77, 9: "Statement matches date-of-death balance"}, [])
example(cl, C0 + 1, {1: "Miami Valley Hospital", 2: date(2026, 5, 2), 3: 8900.00, 4: "No", 5: "No", 6: "disputed", 7: 0, 9: "Itemized bill requested 2026-05-03; Medicare not yet billed"}, [])
example(cl, C0 + 2, {1: "Late claim: Acme Collections", 2: date(2026, 9, 30), 3: 640.00, 4: "No", 5: "No", 6: "rejected", 7: 0, 9: "Received after window; rejection letter sent"}, [])
for r in range(C0, C0 + 3): cl.cell(row=r, column=2).number_format = DATE
cl.freeze_panes = f"A{C0}"
cl.protection.sheet = True; cl.protection.formatCells = False

# ---------------- Distribution ----------------
di = wb.create_sheet("Distribution")
title(di, "Distribution", "Shares are computed from the ledger balance less the reserve. Nothing is distributed before the creditor window closes and taxes are reserved for.")
di.cell(row=5, column=1, value="Balance in estate account").font = B
c = di.cell(row=5, column=2, value="=Ledger!B7"); c.number_format = MONEY; c.font = B
di.cell(row=6, column=1, value="Less: reserve for taxes and final costs").font = B
c = di.cell(row=6, column=2, value="='Start here'!B26"); c.number_format = MONEY; c.font = B
di.cell(row=7, column=1, value="Less: specific gifts (dollar amounts below)").font = B
DHR = 12; X0 = DHR + 1; X1 = DHR + 50
c = di.cell(row=7, column=2, value=f"=SUM($C${X0}:$C${X1})"); c.number_format = MONEY; c.font = B
di.cell(row=8, column=1, value="Available for percentage shares").font = BB
c = di.cell(row=8, column=2, value="=B5-B6-B7"); c.number_format = MONEY; c.font = BB
di.cell(row=9, column=1, value="Percentages entered (should total 100%)").font = B
c = di.cell(row=9, column=2, value=f"=SUM($B${X0}:$B${X1})"); c.number_format = PCT; c.font = B
di.conditional_formatting.add("B9", FormulaRule(formula=['AND(B9<>0,ROUND(B9,4)<>1)'], fill=PatternFill("solid", fgColor=RED)))
di.cell(row=10, column=1, value="Enter either a percentage or a specific gift amount per beneficiary, not both. Paid so far comes from your own records or the Ledger.").font = M
header(di, DHR, ["Beneficiary", "Share %", "Specific gift ($)", "Computed share", "Paid so far", "Balance owed", "Receipt & release signed?", "Notes"],
       [30, 10, 16, 18, 16, 16, 18, 40])
input_cols(di, X0, X1, [1, 2, 3, 5, 7, 8])
formula_cols(di, X0, X1, [4, 6], MONEY)
for r in range(X0, X1 + 1):
    di.cell(row=r, column=2).number_format = PCT; di.cell(row=r, column=3).number_format = MONEY; di.cell(row=r, column=5).number_format = MONEY
    di.cell(row=r, column=4, value=f'=IF(A{r}="","",IF(C{r}<>"",C{r},$B$8*B{r}))')
    di.cell(row=r, column=6, value=f'=IF(A{r}="","",D{r}-N(E{r}))')
dv_list(di, f"G{X0}:G{X1}", ["Yes", "No"])
di.cell(row=X1 + 2, column=1, value="Total distributed per Ledger (category 'distribution')").font = B
c = di.cell(row=X1 + 2, column=2, value=f"=SUMIF(Ledger!$C${L0}:$C${L1},\"distribution\",Ledger!$E${L0}:$E${L1})"); c.number_format = MONEY; c.font = B
di.cell(row=X1 + 3, column=1, value="Total 'Paid so far' entered above").font = B
c = di.cell(row=X1 + 3, column=2, value=f"=SUM($E${X0}:$E${X1})"); c.number_format = MONEY; c.font = B
di.cell(row=X1 + 4, column=1, value="Difference (should be zero)").font = BB
c = di.cell(row=X1 + 4, column=2, value=f"=B{X1+2}-B{X1+3}"); c.number_format = MONEY; c.font = BB
example(di, X0, {1: "Anna Kowalski (daughter)", 2: 0.5, 5: 0, 7: "No", 8: "Address on file"}, [])
example(di, X0 + 1, {1: "Mark Kowalski (son)", 2: 0.5, 5: 0, 7: "No", 8: ""}, [])
example(di, X0 + 2, {1: "St. Luke's Parish (specific gift, will §4)", 3: 5000, 5: 0, 7: "No", 8: "Pay after window closes"}, [])
di.freeze_panes = f"A{X0}"
di.protection.sheet = True; di.protection.formatCells = False

# ---------------- Final accounting ----------------
fa = wb.create_sheet("Final accounting")
title(fa, "Final accounting", "Print this page. Every number pulls from the other tabs.")
fa.column_dimensions["A"].width = 52; fa.column_dimensions["B"].width = 20; fa.column_dimensions["C"].width = 20
def blank_safe(ref): return f"=IF({ref}=\"\",\"\",{ref})"
fa["A5"] = "Estate of"; fa["B5"] = blank_safe("'Start here'!B20"); fa["A6"] = "Date of death"; fa["B6"] = blank_safe("'Start here'!B21"); fa["B6"].number_format = DATE
fa["A7"] = "Court and case number"; fa["B7"] = blank_safe("'Start here'!B23"); fa["A8"] = "Personal representative"; fa["B8"] = blank_safe("'Start here'!B24")
for r in range(5, 9): fa.cell(row=r, column=1).font = B; fa.cell(row=r, column=2).font = B
def sec(row, text):
    c = fa.cell(row=row, column=1, value=text); c.font = H; c.fill = hdr_fill
    fa.cell(row=row, column=2).fill = hdr_fill; fa.cell(row=row, column=3).fill = hdr_fill
def line(row, label, formula, bold=False, fmt=MONEY):
    fa.cell(row=row, column=1, value=label).font = BB if bold else B
    c = fa.cell(row=row, column=2, value=formula); c.number_format = fmt; c.font = BB if bold else B
    if bold: fa.cell(row=row, column=1).border = Border(top=thin); c.border = Border(top=thin)
L = f"Ledger!$C${L0}:$C${L1}"; LI = f"Ledger!$D${L0}:$D${L1}"; LO = f"Ledger!$E${L0}:$E${L1}"
sec(10, "I. Inventory at date of death")
line(11, "Probate estate (Inventory, C)", "=Inventory!F8"); line(12, "Non-probate: beneficiary designations (A)", "=Inventory!F6")
line(13, "Non-probate: joint and trust (B)", "=Inventory!F7"); line(14, "Total assets at date of death", "=SUM(B11:B13)", True)
sec(16, "II. Receipts into the estate account")
line(17, "Transfers of inventory assets into the estate account", f'=SUMIF({L},"transfer in",{LI})')
line(18, "Proceeds of sales", f'=SUMIF({L},"sale proceeds",{LI})')
line(19, "Income: interest", f'=SUMIF({L},"income-interest",{LI})'); line(20, "Income: dividends", f'=SUMIF({L},"income-dividend",{LI})')
line(21, "Income: other", f'=SUMIF({L},"income-other",{LI})'); line(22, "Total receipts", "=SUM(B17:B21)", True)
sec(24, "III. Disbursements")
for i, cat in enumerate(["funeral", "administration", "legal", "accounting", "tax", "debt paid", "reimbursement to executor"], 25):
    line(i, cat.capitalize() if cat != "debt paid" else "Debts and claims paid", f'=SUMIF({L},"{cat}",{LO})')
line(32, "Total disbursements before distributions", "=SUM(B25:B31)", True)
sec(34, "IV. Distributions to beneficiaries")
line(35, "Distributions paid (Ledger)", f'=SUMIF({L},"distribution",{LO})')
sec(37, "V. Reconciliation")
line(38, "Total receipts (II)", "=B22"); line(39, "Less total disbursements (III)", "=B32"); line(40, "Less distributions (IV)", "=B35")
line(41, "Balance remaining in estate account", "=B38-B39-B40", True)
line(42, "Ledger running balance (should match)", "=Ledger!B7")
line(43, "Difference (should be zero)", "=B41-B42", True)
sec(45, "VI. Still to do")
line(46, "Assets in inventory not yet valued (count)", "=Inventory!F10", fmt="0")
line(47, "Claims still pending (count)", "=Claims!B9", fmt="0")
line(48, "Outgoing ledger rows without a receipt (count)", "=Ledger!B8", fmt="0")
line(49, "Reserve held for taxes and final costs", "='Start here'!B26")
line(50, "Available for distribution after reserve and specific gifts", "=Distribution!B8")
fa["A52"] = "Prepared by the personal representative from the estate's records. General information, not legal or tax advice."; fa["A52"].font = M
fa.print_area = "A1:C52"; fa.page_setup.fitToWidth = 1; fa.page_setup.orientation = "portrait"
fa.sheet_properties.pageSetUpPr.fitToPage = True
fa.protection.sheet = True

for w in wb.worksheets:
    for row in w.iter_rows():
        for c in row:
            if c.font and c.font.name != F:
                c.font = Font(name=F, size=c.font.size or 10, bold=c.font.bold, italic=c.font.italic, color=c.font.color)

wb.calculation.fullCalcOnLoad = True  # Excel and Google Sheets compute every formula on open
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ledger", "The-Estate-Ledger.xlsx")
wb.save(out); print("wrote", out)
