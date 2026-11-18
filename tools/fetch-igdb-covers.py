#!/usr/bin/env python3
"""
Fetch official 3:4 vertical cover image_ids from IGDB (free non-commercial API via Twitch OAuth)
and merge them into data/media.json as compact "i:<image_id>" entries.

Usage (once you create a free app at https://dev.twitch.tv/console):
  set TWITCH_CLIENT_ID=your_client_id
  set TWITCH_CLIENT_SECRET=your_client_secret
  python tools/fetch-igdb-covers.py
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON = os.path.join(ROOT, "dist", "data.json")
MEDIA_JSON = os.path.join(ROOT, "data", "media.json")


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower().replace("&", "and"))


def get_token(client_id: str, client_secret: str) -> str:
    body = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
    }).encode("utf-8")
    req = urllib.request.Request("https://id.twitch.tv/oauth2/token", data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode("utf-8"))["access_token"]


def igdb_post(endpoint: str, query: str, client_id: str, token: str):
    req = urllib.request.Request(
        f"https://api.igdb.com/v4/{endpoint}",
        data=query.encode("utf-8"),
        headers={
            "Client-ID": client_id,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "InspiredByGameHistory/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    cid = os.environ.get("TWITCH_CLIENT_ID", "").strip()
    sec = os.environ.get("TWITCH_CLIENT_SECRET", "").strip()
    if not cid or not sec:
        print("Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET first (free at https://dev.twitch.tv/console).")
        sys.exit(1)

    with open(DATA_JSON, encoding="utf-8") as f:
        data = json.load(f)
    media = {}
    if os.path.exists(MEDIA_JSON):
        with open(MEDIA_JSON, encoding="utf-8") as f:
            media = json.load(f)

    token = get_token(cid, sec)
    games = data["g"]
    print(f"Authenticated with Twitch. Matching {len(games)} games against IGDB...")

    # Match by IGDB slug first where known, then by title batch
    matched = 0
    batch_size = 40
    for start in range(0, len(games), batch_size):
        chunk = games[start:start + batch_size]
        names = []
        for g in chunk:
            clean_t = re.sub(r"\s*\((19|20)\d\d\)$", "", g[2]).replace('"', '\\"')
            names.append(f'"{clean_t}"')
        where = " | ".join(f'name ~ {n}' for n in set(names))
        q = f"fields name, slug, first_release_date, cover.image_id; where cover != null & ({where}); limit 500;"
        try:
            res = igdb_post("games", q, cid, token)
        except Exception as e:
            print(f"Batch {start} error: {e}")
            time.sleep(1.0)
            continue

        by_norm = {}
        for item in res:
            cov = (item.get("cover") or {}).get("image_id")
            if not cov:
                continue
            yr = 0
            if item.get("first_release_date"):
                yr = time.gmtime(item["first_release_date"]).tm_year
            by_norm.setdefault(norm(item.get("name", "")), []).append((yr, cov, item.get("slug", "")))

        for g in chunk:
            gid, title, year = g[1], g[2], g[3]
            clean_t = re.sub(r"\s*\((19|20)\d\d\)$", "", title)
            cands = by_norm.get(norm(clean_t), []) or by_norm.get(norm(title), [])
            if not cands:
                continue
            cands.sort(key=lambda x: abs(x[0] - year) if x[0] else 50)
            best_yr, img_id, slug = cands[0]
            if best_yr and abs(best_yr - year) > 5:
                continue
            rec = media.setdefault(gid, {})
            rec["img"] = f"i:{img_id}"
            if slug and not rec.get("igdb"):
                rec["igdb"] = slug
            matched += 1

        if (start // batch_size) % 10 == 0:
            print(f"  processed {start + len(chunk)}/{len(games)} (matched {matched} IGDB covers)")
        time.sleep(0.28)  # Respect IGDB 4 req/sec limit

    with open(MEDIA_JSON, "w", encoding="utf-8") as f:
        json.dump(media, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"Done! Saved {matched} IGDB covers to {MEDIA_JSON}. Run tools\\build.ps1 to rebuild.")


if __name__ == "__main__":
    main()
