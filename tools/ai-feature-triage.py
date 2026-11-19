#!/usr/bin/env python3
"""
AI Inbox & Feature Request Triage Scanner for Played & Made.

Reads zero-login submissions from:
  1. Google Sheet `Played & Made — AI Triage Inbox` (ID: 1rz8vmu8JSWOl7RdoLC8z1qxLRnj6VSSFD3PiyYfWTmA)
     via the `gsheets` CLI (including linked Google Form responses in `Form Responses 1` + `Inbox`), and
  2. Open GitHub issues labeled `feature-request` (via `gh issue list`),

filters spam, classifies each submission into:
  - rollout = "catalog-addition" (missing console, game, cancelled project, or lore story)
  - rollout = "lineage-source"   (cited game-to-game inspiration link)
  - rollout = "maker-note"       (real human thank-you note submitted for review)
  - rollout = "default"          (universal UI/feature improvement for all visitors)
  - rollout = "settings-toggle"  (niche / power-user preference under Settings -> Optional features)
and writes the prioritized queue into `data/feature_backlog.json` (plus syncs triaged status rows to `Inbox`).

Usage:
  python tools/ai-feature-triage.py           # Dry-run scan & print ranked evaluation
  python tools/ai-feature-triage.py --write   # Sync triaged queue into data/feature_backlog.json & Sheet Inbox
"""
import argparse
import datetime
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKLOG_PATH = ROOT / "data" / "feature_backlog.json"
SHEET_ID = "1rz8vmu8JSWOl7RdoLC8z1qxLRnj6VSSFD3PiyYfWTmA"
RELAY_TOPIC = "pm-inbox-4e82b9d1c6a073f5"

SPAM_PATTERNS = re.compile(
    r"(crypto|casino|airdrop|telegram|whatsapp|seo\s+service|backlink|viagra|loan\s+offer)",
    re.I,
)
TOGGLE_HINTS = re.compile(
    r"\b(toggle|optional|opt-in|setting|power user|industry|advanced|compact|dense|experimental|hide|mode)\b",
    re.I,
)
HIGH_VALUE_HINTS = re.compile(
    r"\b(share|friend|memory|childhood|maker|studio|nostalgia|export|timeline|mobile|search|filter|list|dendy|console|cancelled|sunset|lore|lineage)\b",
    re.I,
)


def resolve_gsheets_bin() -> str | None:
    found = shutil.which("gsheets")
    if found:
        return found
    for cand in [
        pathlib.Path.home() / "AppData" / "Local" / "antigravity-bins" / "gsheets.exe",
        pathlib.Path.home() / ".local" / "bin" / "gsheets",
    ]:
        if cand.exists():
            return str(cand)
    return None


def parse_read_all_output(raw: str) -> dict[str, list[list[str]]]:
    tabs: dict[str, list[list[str]]] = {}
    parts = re.split(r"^---\s+(.+?)\s+---\s*$", raw, flags=re.M)
    for idx in range(1, len(parts), 2):
        name = parts[idx].strip()
        body = parts[idx + 1].strip()
        if not body:
            tabs[name] = []
            continue
        try:
            tabs[name] = json.loads(body)
        except Exception:
            tabs[name] = []
    return tabs


def fetch_sheet_submissions() -> tuple[list[dict], set[str]]:
    gs_bin = resolve_gsheets_bin()
    if not gs_bin:
        print("[note] gsheets CLI not on PATH; skipping Google Sheet scan.")
        return [], set()
    try:
        res = subprocess.run(
            [gs_bin, "readonly", "read-all", SHEET_ID, "--json"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
    except Exception as exc:
        print(f"[note] Could not read Google Sheet {SHEET_ID} ({exc}).")
        return [], set()

    tabs = parse_read_all_output(res.stdout or "")
    inbox_rows = tabs.get("Inbox", [])
    known_inbox_ids: set[str] = set()
    submissions: list[dict] = []

    # 1. Existing rows in Inbox tab
    for row in inbox_rows[1:]:
        if len(row) < 3 or not (row[2] or "").strip():
            continue
        ts = row[0] if len(row) > 0 else ""
        cat = row[1] if len(row) > 1 else "General"
        title = row[2] if len(row) > 2 else ""
        details = row[3] if len(row) > 3 else ""
        scope = row[4] if len(row) > 4 else ""
        page = row[5] if len(row) > 5 else ""
        status = row[6] if len(row) > 6 else ""
        sub_id = row[10] if len(row) > 10 and row[10].strip() else make_sub_id(cat, title, details)
        known_inbox_ids.add(sub_id)
        submissions.append(
            {
                "id": sub_id,
                "ts": ts,
                "category": cat,
                "title": title,
                "body": details,
                "scope": scope,
                "page": page,
                "sheetStatus": status,
                "fromForm": False,
            }
        )

    # 2. Linked Google Form tab (typically "Form Responses 1")
    for tab_name, rows in tabs.items():
        if tab_name in ("Inbox", "Setup & AI Notes") or not rows or len(rows) < 2:
            continue
        headers = [h.strip().lower() for h in rows[0]]
        for row in rows[1:]:
            if not any((c or "").strip() for c in row):
                continue
            rec = {headers[i]: (row[i] if i < len(row) else "").strip() for i in range(len(headers))}
            ts = rec.get("timestamp", "")
            cat = rec.get("category", "") or "General"
            title = rec.get("title", "")
            details = rec.get("details", "")
            scope = rec.get("scope", "") or "Let AI & maintainer decide"
            page = rec.get("source page", "") or rec.get("context", "")
            if not title:
                continue
            sub_id = make_sub_id(cat, title, details)
            if sub_id in known_inbox_ids:
                continue
            submissions.append(
                {
                    "id": sub_id,
                    "ts": ts,
                    "category": cat,
                    "title": title,
                    "body": details,
                    "scope": scope,
                    "page": page,
                    "sheetStatus": "New",
                    "fromForm": True,
                }
            )
    return submissions, known_inbox_ids


def fetch_relay_submissions(known_ids: set[str]) -> list[dict]:
    import urllib.request

    url = f"https://ntfy.sh/{RELAY_TOPIC}/json?poll=1&since=24h"
    out: list[dict] = []
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            raw_lines = resp.read().decode("utf-8", errors="ignore").splitlines()
    except Exception as exc:
        print(f"[note] Could not poll live relay ({exc}).")
        return out

    for ln in raw_lines:
        if not ln.strip():
            continue
        try:
            env = json.loads(ln)
            if env.get("event") != "message":
                continue
            payload = json.loads(env.get("message") or "{}")
        except Exception:
            continue
        title = (payload.get("title") or "").strip()
        if not title:
            continue
        cat = (payload.get("cat") or "General").strip()
        body = (payload.get("body") or "").strip()
        sub_id = (payload.get("id") or "").strip() or make_sub_id(cat, title, body)
        if sub_id in known_ids:
            continue
        known_ids.add(sub_id)
        ts = payload.get("ts") or datetime.datetime.fromtimestamp(
            env.get("time", 0), tz=datetime.timezone.utc
        ).strftime("%Y-%m-%d %H:%M:%SZ")
        out.append(
            {
                "id": sub_id,
                "ts": ts,
                "category": cat,
                "title": title,
                "body": body,
                "scope": (payload.get("scope") or "Let AI & maintainer decide").strip(),
                "page": (payload.get("page") or "").strip(),
                "sheetStatus": "New",
                "fromForm": True,
            }
        )
    return out


def make_sub_id(cat: str, title: str, body: str) -> str:
    raw = f"{cat.strip().lower()}|{title.strip().lower()}|{body.strip()[:120].lower()}"
    return "sheet-" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:8]


def evaluate_submission(sub: dict) -> dict:
    title = (sub.get("title") or "").strip()
    body = (sub.get("body") or "").strip()
    cat = (sub.get("category") or "General").strip()
    scope = (sub.get("scope") or "").strip()
    text = f"{cat}\n{title}\n{body}"

    if len(title) < 2 or SPAM_PATTERNS.search(text):
        return {
            "id": sub["id"],
            "source": "google-sheet",
            "title": title or "(untitled)",
            "category": cat,
            "status": "rejected-spam",
            "priority": 99,
            "rollout": "none",
            "rationale": "Filtered automatically (too short or matched spam pattern).",
        }

    cat_l = cat.lower()
    if any(k in cat_l for k in ("console", "game", "cancelled", "sunsetted", "lore")):
        rollout = "catalog-addition"
        rationale = "Catalog / hardware / Vault lore request ready for AI verification and data/agents/ addition."
    elif "lineage" in cat_l or "source" in cat_l:
        rollout = "lineage-source"
        rationale = "Lineage link or source citation queued for primary-source & chronology verification."
    elif "thank" in cat_l or "maker" in cat_l and "note" in cat_l:
        rollout = "maker-note"
        rationale = "Genuine human-submitted thank-you note queued for maintainer review."
    else:
        wants_toggle = "Settings toggle" in scope or bool(TOGGLE_HINTS.search(text))
        wants_default = "everyone" in scope and not wants_toggle
        rollout = "settings-toggle" if wants_toggle and not wants_default else "default"
        rationale = (
            "Classified as Settings toggle so specialized preferences never clutter default UI."
            if rollout == "settings-toggle"
            else "Classified as default improvement benefiting core timeline, trivia, or lineage UX."
        )

    val_hits = len(HIGH_VALUE_HINTS.findall(text))
    priority = 1 if val_hits >= 3 or rollout == "catalog-addition" else 2 if val_hits >= 1 else 3
    slug = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:24] or sub["id"]
    return {
        "id": sub["id"],
        "source": "google-sheet",
        "submittedAt": sub.get("ts", ""),
        "title": title,
        "details": body,
        "category": cat,
        "rollout": rollout,
        **({"flagKey": slug} if rollout == "settings-toggle" else {}),
        "priority": priority,
        "status": "shipped" if sub.get("sheetStatus", "").lower() == "shipped" else "queued",
        "rationale": rationale,
        "_sub": sub,
    }


def append_new_to_inbox(rows_to_append: list[list[str]]) -> None:
    if not rows_to_append:
        return
    gs_bin = resolve_gsheets_bin()
    if not gs_bin:
        return
    ops = [{"op": "append", "range": "Inbox!A1", "data": rows_to_append}]
    tmp = pathlib.Path(tempfile.gettempdir()) / "pm_triage_sync.json"
    tmp.write_text(json.dumps(ops, ensure_ascii=False), encoding="utf-8")
    try:
        subprocess.run([gs_bin, "mutate", "batch", SHEET_ID, "-f", str(tmp)], cwd=str(ROOT), check=True)
        print(f"Synced {len(rows_to_append)} new form row(s) into Sheet Inbox tab.")
    except Exception as exc:
        print(f"[note] Could not append triaged rows to Inbox tab ({exc}).")


def fetch_gh_issues(label: str):
    gh_bin = shutil.which("gh") or r"C:\Program Files\GitHub CLI\gh.exe"
    if not os.path.exists(gh_bin) and not shutil.which("gh"):
        return []
    try:
        res = subprocess.run(
            [
                gh_bin,
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
    except Exception:
        return []


def evaluate_gh_issue(issue: dict) -> dict:
    title = re.sub(r"^\[[^\]]+\]\s*", "", (issue.get("title") or "").strip())
    body = (issue.get("body") or "").strip()
    sub = {
        "id": f"gh-{issue['number']}",
        "ts": issue.get("createdAt", ""),
        "category": "GitHub Issue",
        "title": title,
        "body": body,
        "scope": body,
    }
    ev = evaluate_submission(sub)
    ev["source"] = "github"
    ev["ghNumber"] = issue["number"]
    ev["url"] = issue.get("url", "")
    ev.pop("_sub", None)
    return ev


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="Write triaged queue to data/feature_backlog.json & Sheet Inbox")
    args = ap.parse_args()

    doc = json.loads(BACKLOG_PATH.read_text(encoding="utf-8")) if BACKLOG_PATH.exists() else {"schema": 1, "items": []}
    doc["sheetId"] = SHEET_ID
    doc["sheetUrl"] = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit"
    existing_ids = {it["id"] for it in doc.get("items", [])}

    sheet_subs, known_inbox_ids = fetch_sheet_submissions()
    relay_subs = fetch_relay_submissions(set(known_inbox_ids))
    sheet_subs.extend(relay_subs)
    inbox_append_rows: list[list[str]] = []
    added_sheet = 0
    for sub in sheet_subs:
        ev = evaluate_submission(sub)
        raw_sub = ev.pop("_sub", sub)
        if raw_sub.get("fromForm") and ev["id"] not in known_inbox_ids:
            inbox_append_rows.append(
                [
                    raw_sub.get("ts", ""),
                    raw_sub.get("category", ""),
                    raw_sub.get("title", ""),
                    raw_sub.get("body", ""),
                    raw_sub.get("scope", ""),
                    raw_sub.get("page", ""),
                    ev["status"],
                    f"P{ev['priority']}" if ev["priority"] < 99 else "Spam",
                    ev["rollout"],
                    ev["rationale"],
                    ev["id"],
                ]
            )
        if ev["id"] not in existing_ids and ev["status"] != "rejected-spam":
            doc.setdefault("items", []).append(ev)
            existing_ids.add(ev["id"])
            added_sheet += 1

    issues = fetch_gh_issues("feature-request")
    added_gh = 0
    for iss in issues:
        ev = evaluate_gh_issue(iss)
        if ev["id"] not in existing_ids and ev["status"] != "rejected-spam":
            doc.setdefault("items", []).append(ev)
            existing_ids.add(ev["id"])
            added_gh += 1

    doc["items"].sort(key=lambda x: (0 if x.get("status") == "queued" else 1, x.get("priority", 5)))
    doc["updated"] = datetime.date.today().isoformat()

    queued = [x for x in doc["items"] if x.get("status") == "queued"]
    print(
        f"Backlog items: {len(doc['items'])} total | {len(queued)} queued | "
        f"+{added_sheet} from Google Sheet | +{added_gh} from GitHub"
    )
    for it in doc["items"]:
        print(f"  [P{it.get('priority',3)} | {it.get('status'):7s} | {it.get('rollout'):16s}] {it.get('title')}")

    if args.write:
        if inbox_append_rows:
            append_new_to_inbox(inbox_append_rows)
        BACKLOG_PATH.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Updated {BACKLOG_PATH}")


if __name__ == "__main__":
    sys.exit(main() or 0)
