#!/usr/bin/env python3
"""
Populate data/media.json with:
  - Official box-art / arcade-flyer cover thumbnails from Wikipedia/Wikimedia (CORS-safe) & Steam library_600x900
  - Exact MobyGames numeric IDs (for 1-click "Full dev team credits on MobyGames" links)
  - IGDB slugs

Zero API keys required. Preserves any existing "i:<igdb_hash>" entries from fetch-igdb-covers.py.
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JSON = os.path.join(ROOT, "dist", "data.json")
MEDIA_JSON = os.path.join(ROOT, "data", "media.json")
UA = "InspiredByGameHistory/1.0 (https://github.com; game-history-preservation)"

GAME_WORDS = re.compile(
    r"\b(video game|computer game|arcade|game|rpg|role-playing|shooter|platformer|expansion|mod|simulation|simulator|puzzle|pinball|tabletop|wargame|visual novel|interactive fiction|mud)\b",
    re.I,
)
BAD_WORDS = re.compile(
    r"\b(film|movie|album|song|band|novel by|television series|tv series|painting|municipality|river|species|disambiguation)\b",
    re.I,
)
BAD_IMG = re.compile(
    r"(Commons-logo|Wikipedia-logo|Wiki_letter|Question_book|Edit-clear|Ambox|Symbol_|Flag_of_|Folder_Hexagonal|Crystal_Clear|Nuvola|Text_document|Disambig|Portrait_of_|Headshot)",
    re.I,
)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower().replace("&", "and"))


def clean_title(t: str) -> str:
    return re.sub(r"\s*\((19|20)\d\d\)$", "", t).strip()


def compact_img(url: str) -> str:
    if not url:
        return ""
    url = url.split("?")[0]
    prefixes = [
        ("https://upload.wikimedia.org/wikipedia/en/", "w:en/"),
        ("https://thumb.wikimedia.org/wikipedia/en/thumb/", "wt:en/thumb/"),
        ("https://upload.wikimedia.org/wikipedia/commons/", "w:commons/"),
        ("https://thumb.wikimedia.org/wikipedia/commons/thumb/", "wt:commons/thumb/"),
    ]
    for full, short in prefixes:
        if url.startswith(full):
            return short + url[len(full):]
    return url


def http_json(url: str, timeout: int = 20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def query_wikidata(games):
    """Batch-query Wikidata for video games matching our titles to get MobyGames ID, Steam AppID, IGDB slug, and enwiki page."""
    by_norm = {}
    for g in games:
        ct = clean_title(g[2])
        by_norm.setdefault(norm(ct), []).append(g)

    unique_titles = []
    seen = set()
    for g in games:
        ct = clean_title(g[2])
        if ct not in seen and len(ct) <= 80:
            seen.add(ct)
            unique_titles.append(ct)

    wd_hits = {}  # gid -> {moby, steam, igdb, wiki}
    batch = 55
    print(f"Querying Wikidata in {(len(unique_titles) + batch - 1)//batch} batches...")
    for i in range(0, len(unique_titles), batch):
        chunk = unique_titles[i:i + batch]
        vals = " ".join('"' + t.replace("\\", "\\\\").replace('"', '\\"') + '"@en' for t in chunk)
        sparql = f"""SELECT ?label ?year ?moby ?steam ?igdb ?wiki WHERE {{
  VALUES ?label {{ {vals} }}
  ?item rdfs:label ?label; wdt:P31/wdt:P279* wd:Q7889.
  OPTIONAL {{ ?item wdt:P577 ?pub. BIND(YEAR(?pub) AS ?year) }}
  OPTIONAL {{ ?item wdt:P11688 ?moby. }}
  OPTIONAL {{ ?item wdt:P1733 ?steam. }}
  OPTIONAL {{ ?item wdt:P5794 ?igdb. }}
  OPTIONAL {{ ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>; schema:name ?wiki. }}
}}"""
        url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(sparql)
        try:
            res = http_json(url, timeout=25)
        except Exception as e:
            print(f"  Wikidata batch {i} skipped ({e})")
            time.sleep(1.0)
            continue

        for row in res.get("results", {}).get("bindings", []):
            lbl = row.get("label", {}).get("value", "")
            yr = int(row["year"]["value"]) if "year" in row and row["year"]["value"].isdigit() else 0
            cands = by_norm.get(norm(lbl), [])
            for g in cands:
                gid, gyear = g[1], g[3]
                if yr and abs(yr - gyear) > 5 and len(cands) > 1:
                    continue
                rec = wd_hits.setdefault(gid, {})
                if "moby" in row and row["moby"]["value"].isdigit() and not rec.get("moby"):
                    rec["moby"] = int(row["moby"]["value"])
                if "steam" in row and row["steam"]["value"].isdigit() and not rec.get("steam"):
                    rec["steam"] = row["steam"]["value"]
                if "igdb" in row and not rec.get("igdb"):
                    rec["igdb"] = row["igdb"]["value"]
                if "wiki" in row and not rec.get("wiki"):
                    rec["wiki"] = row["wiki"]["value"]
        time.sleep(0.25)

    print(f"Wikidata matched {len(wd_hits)} games.")
    return wd_hits


def query_wiki_images(page_to_gids, strict_desc=False):
    """Fetch Wikipedia infobox thumbnails in batches of 50 pages."""
    pages = list(page_to_gids.keys())
    found = {}  # gid -> compact_img
    for i in range(0, len(pages), 50):
        chunk = pages[i:i + 50]
        titles_param = "|".join(chunk)
        url = (
            "https://en.wikipedia.org/w/api.php?action=query&redirects=1"
            "&prop=pageimages|description&pilicense=any&piprop=thumbnail|name&pithumbsize=360&format=json"
            "&titles=" + urllib.parse.quote(titles_param)
        )
        try:
            d = http_json(url, timeout=20)
        except Exception as e:
            print(f"  Wiki batch {i} error: {e}")
            time.sleep(0.5)
            continue

        q = d.get("query", {})
        norm_map = {x["from"]: x["to"] for x in q.get("normalized", [])}
        redir_map = {x["from"]: x["to"] for x in q.get("redirects", [])}

        title_to_page = {}
        for _, p in q.get("pages", {}).items():
            if "missing" not in p and "title" in p:
                title_to_page[p["title"]] = p

        for orig in chunk:
            t1 = norm_map.get(orig, orig)
            t2 = redir_map.get(t1, t1)
            p = title_to_page.get(t2) or title_to_page.get(t1)
            if not p:
                continue
            desc = p.get("description", "") or ""
            ptitle = p.get("title", "")
            if strict_desc:
                is_game_title = "(video game)" in ptitle.lower() or "video game)" in ptitle.lower()
                if not is_game_title:
                    if BAD_WORDS.search(desc) and not GAME_WORDS.search(desc):
                        continue
                    if not GAME_WORDS.search(desc):
                        continue
            else:
                if "disambiguation" in desc.lower():
                    continue
            thumb = (p.get("thumbnail") or {}).get("source", "")
            pname = p.get("pageimage", "") or ""
            if not thumb or BAD_IMG.search(pname):
                continue
            # Prefer fair-use English Wikipedia infobox art; allow commons only if game-like
            if "/wikipedia/commons/" in thumb and strict_desc and not re.search(r"(cover|box|logo|art|flyer|screen|title|pack|arcade|game)", pname, re.I):
                continue
            cimg = compact_img(thumb)
            for gid in page_to_gids[orig]:
                if gid not in found:
                    found[gid] = cimg
        time.sleep(0.35)
    return found


def main():
    with open(DATA_JSON, encoding="utf-8") as f:
        data = json.load(f)

    media = {}
    if os.path.exists(MEDIA_JSON):
        with open(MEDIA_JSON, encoding="utf-8") as f:
            media = json.load(f)

    games = data["g"]
    print(f"Resolving media & MobyGames IDs for {len(games)} games...")

    wd_hits = query_wikidata(games)
    for gid, info in wd_hits.items():
        rec = media.setdefault(gid, {})
        if info.get("moby") and not rec.get("moby"):
            rec["moby"] = info["moby"]
        if info.get("steam") and not rec.get("steam"):
            rec["steam"] = info["steam"]
        if info.get("igdb") and not rec.get("igdb"):
            rec["igdb"] = info["igdb"]

    # Pass 1: Known exact enwiki titles from Wikidata (upgrade Steam fallback to authentic box art when available)
    exact_pages = {}
    for g in games:
        gid = g[1]
        cur_img = str(media.get(gid, {}).get("img", ""))
        if cur_img.startswith("i:"):
            continue
        wtitle = wd_hits.get(gid, {}).get("wiki")
        if wtitle:
            exact_pages.setdefault(wtitle, []).append(gid)

    print(f"Fetching Wikipedia covers for {len(exact_pages)} Wikidata-verified articles...")
    imgs1 = query_wiki_images(exact_pages, strict_desc=False)
    for gid, cimg in imgs1.items():
        media.setdefault(gid, {})["img"] = cimg

    # Pass 2: Candidate titles for remaining games in family tree or pop>=3 without cover art
    in_tree = set()
    for l in data.get("l", []):
        in_tree.add(games[l[0]][1])
        in_tree.add(games[l[1]][1])
    missing = [g for g in games if (not media.get(g[1], {}).get("img") or str(media.get(g[1], {}).get("img", "")).startswith("s:")) and (g[1] in in_tree or g[8] >= 3)]
    print(f"Trying Wikipedia '(video game)' articles for {len(missing)} remaining tree/popular games...")
    cand_vg = {}
    for g in missing:
        gid, ct, yr = g[1], clean_title(g[2]), g[3]
        cand_vg.setdefault(f"{ct} ({yr} video game)", []).append(gid)
        cand_vg.setdefault(f"{ct} (video game)", []).append(gid)

    imgs2 = query_wiki_images(cand_vg, strict_desc=False)
    for gid, cimg in imgs2.items():
        cur = str(media.get(gid, {}).get("img", ""))
        if not cur or cur.startswith("s:"):
            media.setdefault(gid, {})["img"] = cimg

    missing2 = [g for g in missing if not media.get(g[1], {}).get("img") or str(media.get(g[1], {}).get("img", "")).startswith("s:")]
    print(f"Trying strict description-verified exact titles for {len(missing2)} remaining tree/popular games...")
    cand_exact = {}
    for g in missing2:
        cand_exact.setdefault(clean_title(g[2]), []).append(g[1])
    imgs3 = query_wiki_images(cand_exact, strict_desc=True)
    for gid, cimg in imgs3.items():
        cur = str(media.get(gid, {}).get("img", ""))
        if not cur or cur.startswith("s:"):
            media.setdefault(gid, {})["img"] = cimg

    # Pass 3: Steam vertical library_600x900 fallback where Steam AppID is known
    steam_filled = 0
    for g in games:
        gid = g[1]
        rec = media.get(gid)
        if rec and not rec.get("img") and rec.get("steam"):
            rec["img"] = f"s:{rec['steam']}"
            steam_filled += 1

    total_img = sum(1 for v in media.values() if v.get("img"))
    total_moby = sum(1 for v in media.values() if v.get("moby"))
    with open(MEDIA_JSON, "w", encoding="utf-8") as f:
        json.dump(media, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"Saved {MEDIA_JSON}: {total_img}/{len(games)} covers ({steam_filled} via Steam fallback), {total_moby} exact MobyGames IDs.")


if __name__ == "__main__":
    main()
