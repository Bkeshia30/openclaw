#!/usr/bin/env python3
"""Post one pin to Pinterest. Usage: post_pin.py --board-id ID --title T --description D --link URL --image pin.png"""
import argparse, base64, json, os, sys, urllib.request
p = argparse.ArgumentParser()
for k in ("board-id","title","description","link","image"): p.add_argument("--"+k, required=True)
a = p.parse_args()
tok = os.environ.get("PINTEREST_TOKEN")
if not tok: sys.exit("PINTEREST_TOKEN not set")
data = base64.b64encode(open(a.image, "rb").read()).decode()
body = {"board_id": a.board_id, "title": a.title[:100], "description": a.description[:500], "link": a.link,
        "media_source": {"source_type": "image_base64", "content_type": "image/png", "data": data}}
req = urllib.request.Request("https://api.pinterest.com/v5/pins", data=json.dumps(body).encode(),
                             headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
with urllib.request.urlopen(req) as r:
    print(json.loads(r.read())["id"])
