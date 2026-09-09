#!/usr/bin/env python3
"""Weekly KPI summary. Uses Stripe + GA4 if STRIPE_KEY / GA4 creds exist; otherwise reads 06-analytics/manual-week.csv
(columns: spend,view_72,lead_72,orders,revenue,refunds). Prints plain text for the owner's chat."""
import csv, json, os, sys, time, urllib.request
root = os.environ.get("EXEC_DESK_ROOT", os.path.join(os.path.dirname(__file__), "../../../.."))
k = {}
sk = os.environ.get("STRIPE_KEY")
if sk:
    since = int(time.time()) - 7*86400
    def get(url):
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {sk}"})
        return json.loads(urllib.request.urlopen(req).read())
    ch = get(f"https://api.stripe.com/v1/charges?limit=100&created[gte]={since}")["data"]
    rf = get(f"https://api.stripe.com/v1/refunds?limit=100&created[gte]={since}")["data"]
    paid = [c for c in ch if c.get("paid") and not c.get("refunded")]
    k.update(orders=len(paid), revenue=sum(c["amount"] for c in paid)/100, refunds=len(rf))
manual = os.path.join(root, "06-analytics/manual-week.csv")
if os.path.exists(manual):
    row = list(csv.DictReader(open(manual)))[-1]
    for c in ("spend","view_72","lead_72","orders","revenue","refunds"):
        k.setdefault(c, float(row.get(c) or 0))
for c in ("spend","view_72","lead_72","orders","revenue","refunds"): k.setdefault(c, 0)
optin = k["lead_72"]/k["view_72"] if k["view_72"] else 0
aov = k["revenue"]/k["orders"] if k["orders"] else 0
rr = k["refunds"]/k["orders"] if k["orders"] else 0
cpo = k["spend"]/k["lead_72"] if k["lead_72"] else 0
flags = []
if k["view_72"] and optin < .20: flags.append("opt-in rate under 20%: fix the /72 page before spending more")
if k["orders"] and aov < 30: flags.append("AOV under $30: check the bump")
if rr > .06: flags.append("refund rate over 6%: read every reason this week")
if cpo > 9: flags.append("cost per opt-in over $9: pause the worst ad group")
print(f"Executor's Desk weekly\nViews /72: {int(k['view_72'])}  Opt-ins: {int(k['lead_72'])}  Opt-in rate: {optin:.1%}\n"
      f"Orders: {int(k['orders'])}  Revenue: ${k['revenue']:.2f}  AOV: ${aov:.2f}\n"
      f"Refunds: {int(k['refunds'])}  Refund rate: {rr:.1%}\nSpend: ${k['spend']:.2f}  Cost per opt-in: ${cpo:.2f}\n"
      + ("Flags:\n- " + "\n- ".join(flags) if flags else "No flags."))
