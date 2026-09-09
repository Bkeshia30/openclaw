#!/usr/bin/env python3
"""Unit economics calculator for The Executor's Desk funnel.

Example:
  python3 unit_economics.py --optin-rate 0.35 --email-conv 0.10 --cpc 2.00 --daily-spend 15
"""
import argparse

p = argparse.ArgumentParser()
p.add_argument("--core", type=float, default=27.0)
p.add_argument("--bump-price", type=float, default=9.0)
p.add_argument("--bump", type=float, default=0.35, help="bump take rate")
p.add_argument("--upsell-price", type=float, default=37.0)
p.add_argument("--upsell", type=float, default=0.15, help="upsell take rate")
p.add_argument("--downsell-price", type=float, default=19.0)
p.add_argument("--downsell", type=float, default=0.10, help="downsell take rate among upsell decliners")
p.add_argument("--refund", type=float, default=0.03)
p.add_argument("--optin-rate", type=float, default=0.35)
p.add_argument("--email-conv", type=float, default=0.10, help="share of opt-ins who buy within 60 days")
p.add_argument("--cpc", type=float, default=2.0)
p.add_argument("--daily-spend", type=float, default=15.0)
p.add_argument("--days", type=int, default=30)
a = p.parse_args()

aov = a.core + a.bump_price * a.bump + a.upsell_price * a.upsell + a.downsell_price * a.downsell * (1 - a.upsell)
fees = aov * 0.029 + 0.30
net_per_order = aov - fees - aov * a.refund

clicks = a.daily_spend * a.days / a.cpc
optins = clicks * a.optin_rate
orders = optins * a.email_conv
cost_per_optin = a.daily_spend * a.days / optins if optins else float("inf")
cost_per_order = a.daily_spend * a.days / orders if orders else float("inf")
revenue = orders * aov
net = orders * net_per_order - a.daily_spend * a.days
rev_per_optin = revenue / optins if optins else 0
breakeven_conv = cost_per_optin / net_per_order if net_per_order else float("inf")

print(f"Average order value        ${aov:6.2f}")
print(f"Net per order after fees   ${net_per_order:6.2f}")
print(f"--- {a.days} days at ${a.daily_spend:.0f}/day, CPC ${a.cpc:.2f} ---")
print(f"Clicks                     {clicks:8.0f}")
print(f"Opt-ins ({a.optin_rate:.0%})             {optins:8.0f}   cost per opt-in ${cost_per_optin:.2f}")
print(f"Orders ({a.email_conv:.0%} of opt-ins)   {orders:8.1f}   cost per order  ${cost_per_order:.2f}")
print(f"Revenue                    ${revenue:8.2f}")
print(f"Net after ad spend         ${net:8.2f}")
print(f"Revenue per opt-in         ${rev_per_optin:6.2f}")
print(f"Break-even email conversion needed: {breakeven_conv:.1%}")
