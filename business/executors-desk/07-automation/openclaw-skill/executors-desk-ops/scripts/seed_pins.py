#!/usr/bin/env python3
"""Create 05-traffic/pins-queue.csv from the 60 titles in pinterest-plan.md."""
import csv, os, re, sys
root = os.environ.get("EXEC_DESK_ROOT", os.path.join(os.path.dirname(__file__), "../../../.."))
plan = open(os.path.join(root, "05-traffic/pinterest-plan.md")).read()
block = plan.split("## 60 pin titles")[1].split("## Descriptions")[0]
titles = [re.sub(r"^\d+\.\s*", "", l).strip() for l in block.strip().splitlines() if re.match(r"^\d+\.", l)]
boards = ["What to do when a parent dies","Executor checklist and duties","Probate, explained plainly","Death certificates, letters and paperwork","The empty house","Estate taxes and the final return","Siblings and beneficiaries","Executor tools and printables"]
out = os.path.join(root, "05-traffic/pins-queue.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["id","title","board","destination","fact","why","posted_at","pin_id"])
    for i, t in enumerate(titles, 1):
        dest = "etsy" if i % 10 == 0 else ("/blog" if i % 10 == 5 else "/72")
        w.writerow([i, t, boards[(i-1) % len(boards)], dest, "", "", "", ""])
print("wrote", out, len(titles), "pins")
