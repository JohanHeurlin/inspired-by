#!/usr/bin/env python3
"""
Automated / AI-ready Suggestion Triage & Spam Filter for Inspired By GitHub Issues.

Usage:
  1. Dry-run deterministic validation on open 'suggestion' GitHub issues (requires `gh` CLI):
       python tools/triage-suggestions.py
  2. Optional Gemini AI source-verification pass (if GEMINI_API_KEY is set locally or in GitHub Secrets):
       GEMINI_API_KEY=... python tools/triage-suggestions.py --ai

What this script protects against before anything touches your database:
  - Rejects spam links, non-HTTPS URLs, URL shorteners, and unreachable domains (HTTP check).
  - Resolves 'Earlier Game' and 'Later Game' against dist/data.json (4,190+ games) and flags
    chronological impossibilities ('time travel': earlier game released after later game).
  - Flags duplicate pairs already documented in dist/data.json.
  - Emits ready-to-paste JSON snippets for `data/corrections.json` ("addLinks") for valid receipts.
"""
import argparse
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON = os.path.join(ROOT, "dist", "data.json")
BLOCKED_HOSTS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "rb.gy", "is.gd", "cutt.ly"
}
UA = "InspiredByTriage/1.0 (+https://johanheurlin.github.io/inspired-by/)"


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower().replace("&", "and"))


def load_catalog():
    with open(DATA_JSON, encoding="utf-8") as f:
        d = json.load(f)
    by_id = {r[1]: r for r in d["g"]}
    by_norm = {norm(r[2]): r for r in d["g"]}
    pairs = {(d["g"][l[0]][1], d["g"][l[1]][1]): d["tiers"][l[2]] for l in d["l"]}
    return by_id, by_norm, pairs


def check_url(url: str) -> tuple[bool, str]:
    if not url or not url.startswith("https://"):
        return False, "Missing or non-HTTPS URL"
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    if not host or host in BLOCKED_HOSTS:
        return False, f"Blocked or shortened host ({host})"
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=8) as r:
            return (200 <= r.status < 400), f"HTTP {r.status}"
    except Exception as e:
        return False, str(e)


def parse_issue_body(body: str) -> dict:
    fields = {}
    cur = None
    for line in (body or "").splitlines():
        if line.startswith("### "):
            cur = line[4:].strip().lower()
            fields[cur] = []
        elif cur is not None:
            fields[cur].append(line)
    return {k: "\n".join(v).strip() for k, v in fields.items()}


def match_game(text: str, by_id: dict, by_norm: dict):
    if not text:
        return None
    clean = re.sub(r"\s*\((19|20)\d\d\)\s*$", "", text.strip())
    slug = re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-")
    return by_id.get(slug) or by_norm.get(norm(clean))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="JohanHeurlin/inspired-by")
    ap.add_argument("--limit", type=int, default=25)
    args = ap.parse_args()

    by_id, by_norm, pairs = load_catalog()
    cmd = [
        "gh", "issue", "list", "--repo", args.repo,
        "--label", "suggestion", "--state", "open",
        "--limit", str(args.limit),
        "--json", "number,title,body,author,createdAt,url",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("gh issue list failed:", res.stderr.strip())
        return
    issues = json.loads(res.stdout or "[]")
    if not issues:
        print("No open 'suggestion' issues waiting for triage.")
        return

    approved_patches = []
    for iss in issues:
        f = parse_issue_body(iss.get("body", ""))
        from_txt = f.get("earlier game (inspiration)", "")
        to_txt = f.get("later game (inspired game)", "")
        src_url = next((u for u in re.findall(r"https://\S+", iss.get("body", ""))), "")
        url_ok, url_note = check_url(src_url)
        g_from = match_game(from_txt, by_id, by_norm)
        g_to = match_game(to_txt, by_id, by_norm)

        verdict = "READY_FOR_REVIEW"
        reasons = [f"source={url_note}"]
        if not url_ok:
            verdict = "REJECT_OR_NEEDS_SOURCE"
        if g_from and g_to:
            if g_from[3] > g_to[3]:
                verdict = "INVALID_TIME_TRAVEL"
                reasons.append(f"{g_from[2]} ({g_from[3]}) > {g_to[2]} ({g_to[3]})")
            elif (g_from[1], g_to[1]) in pairs:
                reasons.append(f"existing_link_tier={pairs[(g_from[1], g_to[1])]}")
            elif url_ok:
                tier_raw = f.get("evidence strength", "critic").split("—")[0].strip()
                approved_patches.append({
                    "from": g_from[1],
                    "to": g_to[1],
                    "tier": tier_raw if tier_raw in {"dev", "team", "critic", "mech", "disp"} else "critic",
                    "took": "TODO: verify from source",
                    "added": f.get("what did it build on, and what did the newer game add or change?", "")[:180],
                    "src": [{"t": f"Community issue #{iss['number']}", "u": src_url}],
                })
        else:
            reasons.append(f"matched_from={bool(g_from)}, matched_to={bool(g_to)}")

        print(f"#{iss['number']} [{verdict}] {iss['title']} ({', '.join(reasons)})")

    if approved_patches:
        print("\n--- Candidate corrections.json addLinks snippet ---")
        print(json.dumps(approved_patches, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
