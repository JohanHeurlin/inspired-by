# Inspired By — The Family Tree of Video Games

An interactive family tree of video game history (1950s to today), a tribute to the human makers and studios behind the art, and a shareable two-minute **"My Life in Games"** childhood timeline.

## Features

- **My Gaming Timeline:** Enter your birth year, pick the systems you played on, and tap games (`✓` Played · `★` Played a ton · `♥` All-Time Favorite). Move any game to the exact age/year you played it, add childhood memory notes & tags (*Couch co-op, LAN party, Summer break*), and share your timeline via a serverless URL hash (`#t1-…`), 4K desktop poster, or vertical story card.
- **Friend Comparison:** Open any friend's share link to see your `% in common`, shared favorites, and side-by-side **Same Age** or **Same Calendar Year** comparisons.
- **Family Tree & Walk the Roots:** Trace any game back to early arcade, mainframe, and tabletop pioneers. Every connection states what changed, what it built on, its evidence tier (*Developer said so, Same team/code, Same series, Critics & historians, Shared mechanics, Debated/disputed*), its relationship lens (*Creative synthesis, Genre evolution, Born from a mod, Fast-follow, Direct variant*), and cited sources.
- **Makers & Studio Diaspora:** Click any studio name to see its human creators, games, MobyGames full team credits, and — for shuttered or laid-off studios (*Looking Glass, Bullfrog, Clover, Volition, Pandemic, Westwood, Japan Studio*, etc.) — where their developers scattered next.
- **Real Box Art + Procedural Era Spines:** Lazy-loads official box art thumbnails over zero-latency procedural era covers (CRT phosphor, Atari stripes, NES grid, jewel case, keep case, digital tile), with a one-click header toggle.

## Project Structure

- `src/app.html`: Single-file vanilla HTML/CSS/JS application template (`/*__DATA__*/` placeholder).
- `data/base/`: Seed family-tree and catalog records.
- `data/agents/`: Research slices (games, lineage links, genre tags, primary interview upgrades).
- `data/studios.json`: Curated studio histories, human makers, and post-closure studio diaspora links.
- `data/media.json`: Resolved cover thumbnails (`w:` Wikimedia, `s:` Steam, `i:` IGDB) and exact MobyGames IDs.
- `data/corrections.json`: Hand-checked overrides applied last during build.
- `data/codes.json`: Append-only base-36 game code registry for permanent `#t1-…` share URLs (**never delete or reorder entries**).
- `tools/build.ps1`: Validates and merges all data into `dist/index.html` (standalone web / GitHub Pages), `dist/inspired-by.html`, and `dist/data.json`.
- `tools/fetch-media.py`: Zero-key Wikidata + Wikipedia + Steam cover & MobyGames ID resolver.
- `tools/fetch-igdb-covers.py`: Optional IGDB `3:4` cover upgrader (uses free non-commercial Twitch Developer Client ID & Secret).
- `.github/workflows/pages.yml`: Automatic GitHub Pages deployment from `./dist` on push to `main`.

## Rebuild Locally

```powershell
powershell -ExecutionPolicy Bypass -File tools\build.ps1
```

Preview locally on `http://localhost:8765`:

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

## Refreshing Cover Art & MobyGames Links

1. **Zero-key Wikipedia + Wikidata + Steam + MobyGames pass:**
   ```powershell
   python tools\fetch-media.py
   powershell -ExecutionPolicy Bypass -File tools\build.ps1
   ```
2. **Optional full IGDB `3:4` box-art pass (free non-commercial API):**
   Register a free app at <https://dev.twitch.tv/console>, then run:
   ```powershell
   $env:TWITCH_CLIENT_ID="your_client_id"
   $env:TWITCH_CLIENT_SECRET="your_client_secret"
   python tools\fetch-igdb-covers.py
   powershell -ExecutionPolicy Bypass -File tools\build.ps1
   ```
