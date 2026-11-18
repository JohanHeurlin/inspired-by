#!/usr/bin/env python3
"""
AI Feature Request & Gratitude Triage Scanner for Played & Made.

Scans open GitHub issues labeled `feature-request` (via `gh issue list`), filters out spam,
scores each idea on (value + novelty - clutter_risk), classifies whether it belongs as:
  - rollout = "default"         (universal improvement for all visitors)
  - rollout = "settings-toggle" (niche / power-user preference under Settings -> Optional features)
  - rollout = "needs-review"    (ambiguous or high-complexity)
and writes the prioritized queue into `data/feature_backlog.json` so an AI coding agent can
implement top-ranked items in order.

Usage:
  python tools/ai-feature-triage.py           # Dry-run scan & print ranked evaluation
  python tools/ai-feature-triage.py --write   # Sync new open issues into data/feature_backlog.json
"""
import argparse
import datetime
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKLOG_PATH = ROOT / "data" / "feature_backlog.json"

SPAM_PATTERNS = re.compile(
    r"(crypto|casino|airdrop|telegram|whatsapp|seo\s+service|backlink|viagra|loan\s+offer)",
    re.I,
)
TOGGLE_HINTS = re.compile(
    r"\b(toggle|optional|opt-in|setting|power user|industry|advanced|compact|dense|experimental|hide|mode)\b",
    re.I,
)
HIGH_VALUE_HINTS = re.compile(
    r"\b(share|friend|memory|childhood|maker|studio|nostalgia|export|timeline|mobile|search|filter|list)\b",
    re.I,
)


def fetch_gh_issues(label: str):
    try:
        res = subprocess.run(
            [
                "gh",
                "issue",
                "list",
                "--label",
                label,
                "--state",
                "open",
                "--limit",
                "100",
                "--json",
                "number,title,body,createdAt,author,url",
            ],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(res.stdout or "[]")
    except Exception as exc:
        print(f"[note] Could not query live GitHub issues ({exc}); reading local backlog only.")
        return []


def evaluate_issue(issue: dict) -> dict:
    title = re.sub(r"^\[Feature\]\s*", "", (issue.get("title") or "").strip(), flags=re.I)
    body = (issue.get("body") or "").strip()
    text = f"{title}\n{body}"

    if len(text) < 20 or SPAM_PATTERNS.search(text):
        return {
            "id": f"gh-{issue['number']}",
            "ghNumber": issue["number"],
            "url": issue.get("url", ""),
            "title": title or "(untitled)",
            "status": "rejected-spam",
            "priority": 99,
            "rollout": "none",
            "rationale": "Filtered automatically (too short or matched spam pattern).",
        }

    wants_toggle = "Optional toggle in Settings" in body or bool(TOGGLE_HINTS.search(text))
    wants_default = "Default for everyone" in body and not wants_toggle
    rollout = "settings-toggle" if wants_toggle and not wants_default else "default"

    val_hits = len(HIGH_VALUE_HINTS.findall(text))
    priority = 1 if val_hits >= 3 else 2 if val_hits >= 1 else 3

    cat_match = re.search(r"### Area\s+([^\r\n]+)", body)
    category = cat_match.group(1).strip() if cat_match else "General"
    slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:24] or f"opt_{issue['number']}"

    rationale = (
        "Classified as Settings toggle so specialized preferences never clutter the default UI."
        if rollout == "settings-toggle"
        else "Classified as default improvement benefiting general timeline & exploration flow."
    )
    return {
        "id": f"gh-{issue['number']}",
        "ghNumber": issue["number"],
        "url": issue.get("url", ""),
        "title": title,
        "category": category,
        "rollout": rollout,
        **({"flagKey": slug} if rollout == "settings-toggle" else {}),
        "priority": priority,
        "status": "queued",
        "rationale": rationale,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="Write triaged queue to data/feature_backlog.json")
    args = ap.parse_args()

    doc = json.loads(BACKLOG_PATH.read_text(encoding="utf-8")) if BACKLOG_PATH.exists() else {"schema": 1, "items": []}
    existing_ids = {it["id"] for it in doc.get("items", [])}

    issues = fetch_gh_issues("feature-request")
    added = 0
    for iss in issues:
        ev = evaluate_issue(iss)
        if ev["id"] not in existing_ids and ev["status"] != "rejected-spam":
            doc.setdefault("items", []).append(ev)
            existing_ids.add(ev["id"])
            added += 1

    doc["items"].sort(key=lambda x: (0 if x.get("status") == "queued" else 1, x.get("priority", 5)))
    doc["updated"] = datetime.date.today().isoformat()

    queued = [x for x in doc["items"] if x.get("status") == "queued"]
    print(f"Backlog items: {len(doc['items'])} total | {len(queued)} queued | {added} newly imported from GitHub")
    for it in doc["items"]:
        print(f"  [P{it.get('priority',3)} | {it.get('status'):7s} | {it.get('rollout'):15s}] {it.get('title')}")

    if args.write:
        BACKLOG_PATH.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Updated {BACKLOG_PATH}")


if __name__ == "__main__":
    sys.exit(main() or 0)
