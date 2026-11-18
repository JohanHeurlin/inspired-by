# Inspired By — The Family Tree of Video Games

Live site: **<https://johanheurlin.github.io/inspired-by/>**

An interactive family tree of video game history (1950s to today), a tribute to the human makers and studios behind the art, and a shareable two-minute **"My Life in Games"** childhood & industry-career timeline.

## Features

- **My Gaming Timeline:** Enter your birth year, pick the tactile 3D systems you played on, and tap games (`✓` Played · `★` Played a ton · `♥` All-Time Favorite) either by era/age or via **✦ Memory, Vibe & Mood Packs** (*Couch Co-op, Older Sibling's Floppy Box, Quarter-Munchers, 2 A.M. Strategy, Indie Gems*, etc.). Everything auto-saves locally so you can keep adding forgotten memories over time.
- **Player Archetype, Pyramid of Craft & Visual Maker Ode:** Unlocks a custom **Gamer Profile & Core Play Loops**, a **Pyramid of Craft** + **Playfulness Across Life** curve, a **Visual Studio & Creator `%` Ode** celebrating the human teams and hardware engineers who raised you, **Under-the-Radar Indie Gems**, and **Missed Roots** with official DRM-free GOG & Steam preservation links.
- **Shareable Cards & Posters:** Share your timeline via a serverless URL hash (`#t1-…`), vertical **Story Card**, **♥ Favorites Grid**, **🕹️ Consoles & Favorites Card** (your machines paired with your top games on each), **🛠 Maker Legacy Card**, or **4K Desktop Poster**.
- **Industry Maker Legacy (`🛠 I worked on this`):** Designers, engineers, artists, audio, QA, producers, and studio alumni can mark shipped games, studios (`🛠 I worked here`), disciplines, and unannounced/canceled projects — unlocking a dedicated **Worked On** career view, a **Ripple Effect** showcase of every later game in history that traces back to work they touched, and colleague/player callouts in Friend Compare.
- **Period CRT / Monitor Gameplay Viewer & 1980s Synthwave:** Watch gameplay and trailers inside era-authentic **1980s Woodgrain CRT**, **1990s Trinitron**, **2000s HD**, or **Modern 4K OLED** cabinets (`📺 Watch in period TV`), or toggle the zero-byte Web Audio **`♪ 80s synth`** ambience & retro tap chimes in the header.
- **Era Cultural Touchstones (`📻 Era memories`):** Optional "Meanwhile in the world" strips pairing each gaming era with the music, films, tech, and world headlines happening when you played (*Walkmans, Thriller, Berlin Wall, VHS stores, dial-up modems, Tamagotchis, iPods*).
- **Makers, Hall of Pioneers, Hardware Engineers & Giving Back:** Explore curated studio histories & post-closure diaspora, **35 Hall of Pioneers** profiles (`1958–today`), **18 Console & Home-Computer Hardware Engineer** spotlights (*Jay Miner, Gunpei Yokoi, Bob Yannes, Ken Kutaragi*, etc.), and direct links to verified non-profits supporting underrepresented youth in game creation, laid-off devs, hospital play, and game preservation.
- **Family Tree, Walk the Roots & GTA VI Marquee:** Trace any game back to early arcade, mainframe, and tabletop pioneers — including a 64-year *Grand Theft Auto VI* spotlight and expandable history of video game "moral panic" headlines from 1976 *Death Race* and the 1993 Senate hearings to today.
- **Real Box Art + Procedural Fallback:** Lazy-loads official box art thumbnails over zero-latency procedural era covers (toggleable in Timeline `Settings`).

## Project Structure

- `src/app.html`: Single-file vanilla HTML/CSS/JS application template (`/*__DATA__*/` placeholder).
- `data/base/`: Seed family-tree and catalog records.
- `data/agents/`: Research slices (games, lineage links, genre tags, primary interview upgrades).
- `data/studios.json`: Curated studio histories, human makers, and post-closure studio diaspora links.
- `data/culture.json`: Hall of Pioneers (`1958–today`), console/computer hardware engineers, 12 era nostalgia windows, *GTA* cultural headline milestones, and verified non-profit links.
- `data/media.json` & `data/media_extra.json`: Resolved cover thumbnails (`w:` Wikimedia, `s:` Steam, `i:` IGDB), MobyGames IDs, and YouTube gameplay/trailer IDs.
- `data/corrections.json`: Hand-checked overrides applied last during build.
- `data/codes.json`: Append-only base-36 game code registry for permanent `#t1-…` share URLs (**never delete or reorder entries**).
- `tools/build.ps1`: Validates and merges all data into `dist/index.html` (standalone web / GitHub Pages), `dist/inspired-by.html`, and `dist/data.json`.
- `tools/make-og-card.ps1`: Generates `dist/og-card.png` (`1200×630` social OpenGraph preview image).
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
