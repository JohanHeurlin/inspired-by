# Played & Made — Your Life in Games & the Humans Who Built Them

Live site: **<https://johanheurlin.github.io/inspired-by/>**

An interactive family tree of video game history (1950s to today), a heartfelt tribute to the human makers, studios, and hardware engineers behind the art, and a shareable two-minute **"My Life in Games"** childhood & industry-career timeline.

## Features

- **My Gaming Timeline & Always-Accessible Game Picker (`➕ Pick games`):** Enter your birth year, pick the tactile 3D systems you played on, and tap games (`✓` Played · `★` Played a ton · `♥` All-Time Favorite) either by era/age or via **✦ Memory, Vibe & Mood Packs** (*Couch Co-op, Older Sibling's Floppy Box, Quarter-Munchers, 2 A.M. Strategy, Indie Gems, 😤 Brutal Games That Made Us Sweat, 🛟 Worlds That Carried Us Through*). Jump back into **➕ Pick games** (`#picks`) anytime, drag any cover's `⠿` grip between years, and test onboarding safely via **🧪 Test new-visitor flow**.
- **Living Art, Sourced Real-World Stories & Maker Postcards (`#gratitude` & `#giveback`):**
  - **Why Games Matter & Verified Stories:** Highlights video games as lifelines through turbulent childhoods and collaborative art, paired with **6 documented, primary-sourced real-world stories** (*Robin & Zelda Williams*, *Satoru Iwata's GDC keynote*, *87-year-old Mayor Audie*, *Dani Bunten Berry & Will Wright*, *Erik Wolpaw*, and *Child's Play / Desert Bus*) — zero fabricated player letters.
  - **Personal Thank-You Postcards & Direct Non-Profit Support (`#giveback`):** Save personal notes on your device, download a shareable **Thank-You Postcard (`.png`)**, submit genuine human notes for review, or support 6 verified non-profits (*Video Game History Foundation*, *Child's Play*, *Take This*, *IGDA Foundation*, *Urban Arts*, *Girls Make Games*) directly with 0% cut.
- **In-UI Screenshots, Title Screens & Artwork Gallery:** Automatically pulls real in-game gameplay screenshots, retro title screens, creator photos, and widescreen artwork (via Wikipedia `media-list` REST API, Libretro open thumbnail archive, and Steam CDN) directly into Quick-Look modals and Game pages with an interactive zoom lightbox.
- **Personal Shelves & Shareable Custom Themed Lists (`📋 Custom lists` / `#list-…`):**
  - Tag games with **`🛟 Carried me through`** or **`😤 Made me sweat`** to unlock dedicated shelves right on your timeline.
  - Build custom themed lists (*Games That Made Me Sweat, Worlds That Carried Me Through, Couch Co-op Chaos, Soundtracks in My Head, Desert-Island Five*, or any custom theme) with per-game quips, serverless `#list-…` share URLs, and downloadable `.png` list cards.
- **Shareable Cards (with Real Box Art), 4K Poster & Interactive 2D Physics Box Pile:** Share your timeline via a serverless URL hash (`#t1-…`), vertical **Story Card**, **♥ Favorites Grid**, **🕹️ Consoles & Favorites Card**, **🛠 Maker Legacy Card**, **4K Desktop Poster** (all preloading CORS-clean real box art onto the exported `.png` without disturbing the live poster wall), or toss your boxes in the interactive **📦 Physics Box Pile** (with gravity, bounce, and `🪐 Zero-G`).
- **Cinema Player + Draggable Floating Mini-Player (`1,192` pre-indexed clips + live fallback):** Watch trailers and gameplay right on-site in a dark theater player, and click **⑂ Lineage tree**, **📄 Game page**, **Walk roots**, or **🗕 Mini-player** to shrink the video into a draggable, corner-snapping Picture-in-Picture dock that keeps playing without reloading while you read and explore (`⤢` to expand back, `⇄` to hop corners, `×` to close).
- **Independent Audio Controls (`🔊 SFX` + `♪ Synth`):** Layered UI sound design inspired by Nintendo Switch / Playdate — musical triangle-wave chimes on game picks (`✓` / `★` / `♥`) and Trivia streaks, paired with whisper-soft directional micro-ticks (`~30ms`, `-15 dB` quieter, zero hover spam) when stepping through roots or lineage nodes, all controlled by **`🔊 SFX`** alongside an opt-in **125-BPM *Tron*-inspired synthwave arpeggiator** (`♪ Synth`).
- **Player Archetype, Pyramid of Craft, Maker Ode & Official Store Links:** Unlocks your **Gamer Profile & Core Play Loops**, **Pyramid of Craft** + **Playfulness Across Life** curve, **Visual Studio & Creator `%` Ode**, and **Missed Roots**, **Indie Gems**, and **Spiritual Successors** — all with official DRM-free GOG & Steam links.
- **Interactive Lineage Org-Chart (`⑂ Lineage` / `#lineage`), Big Picture (5 Views) & 46-Country World Map:**
  - **Top-Bar `⑂ Lineage` Org-Chart (`#lineage`):** Jump straight into the live clickable lineage org-chart above the fold — click any node to walk across generations, filter by 6 evidence tiers, jump to your own timeline games, or connect any two games via **Six Degrees of Pong**.
  - **The Big Picture:** Switch between **🌟 Landmarks (clean)**, **🏔️ Influence Skyline**, **🌊 Genre Rivers**, **🌍 Geography**, and **❤️ My Constellation**.
  - **Genres, Mechanics, Mobile Craft, Mods/UGC, Tabletop Roots & Game Prices (`#mechanics` / `#genres` / `#mobile` / `#ugc` / `#boardgames` / `#prices`):** Explore **16 iconic game mechanics**, **30 genres & how hybrid genres breed**, **📱 Mobile & 3B Pockets** (honoring touch-first physics, small-cell studio culture, and global accessibility), **🧱 Mods & UGC Worlds** (tracing 1990s PC mods like *Counter-Strike*, *Team Fortress*, *DotA*, and *DayZ* forward to *Minecraft*, *Hypixel SkyBlock*, *GTA FiveM RP*, *Roblox*, and *Fortnite UEFN*), **14 tabletop/wargame/boardgame roots**, and **💸 Game Prices Over Time (1977–2026)** — toggling between launch sticker tags and 2026 inflation-adjusted dollars, your personal timeline receipt, console launch hardware prices, and a one-click **🍿 Reality Check vs. Movies, Music, Food & Everyday Life** (`1990 → 2026` `%` change + cost per hour of entertainment).
  - **World Map (`#world`):** Interactive Natural Earth `110m` choropleth world map across **46 countries** (click any country directly on the map or toggle between the full catalog and your own timeline).
  - **6-Mode Arcade Trivia (`🎯 Trivia` / `#trivia`) & 🎰 Lucky Reel:** Dedicated top-bar **`🎯 Trivia`** mode leading with **`🕯️ Lore & Deep Cuts`** (24 industry, cancelled-game, sunsetted-world, and hardware-folklore questions) alongside **Lineage**, **Launch Year**, **Studio**, **Country**, and **System**, plus 1-tap streak sharing and the **3-Reel Lucky Slot Machine**.
- **🕯️ The Vault: Unfinished Masterpieces, Sunsetted Worlds & Gaming Lore (`#vault`):**
  - **Unfinished & Cancelled Games in the Family Tree (`12` projects):** Honors cancelled passion projects (*Project Titan* → *Overwatch*, *Van Buren* → *Fallout: New Vegas*, *Thrill Kill* → *Wu-Tang: Shaolin Style*, *Silent Hills* → *Resident Evil 7*, *Star Wars 1313*, *EarthBound 64* → *Mother 3*, *StarCraft: Ghost*, *Prey 2*, *Scalebound*, *Half-Life 2: Episode Three*, *Agent*, *Desert Bus / Smoke and Mirrors*) with `🕯️ Unreleased / Cancelled` badges, dashed lineage nodes, and one-tap **`🛠 I worked on this`** credits for developers.
  - **Worlds Whose Servers Went Dark (`13` sunsetted online worlds):** Preserves player memories of *Glitch*, *Chromehounds*, *Star Wars Galaxies*, *City of Heroes*, *The Matrix Online*, *WildStar*, *Echo VR*, *Knockout City*, *Club Penguin*, *MAG*, *1 vs. 100*, *Battleborn*, and satellite-broadcast *BS The Legend of Zelda*.
  - **Parallel Universes, Scams & Deep-Cut Hardware (`10` editorial stories + `10` regional/cult machines):** Stories and selectable consoles covering **Dendy**, **Gizmondo** (Uppsala Mafia & Malibu Ferrari crash), **Atari's 728,000 Alamogordo desert cartridges**, **TecToy's 35-year Brazilian Sega universe**, **Subor**, **Vectrex**, **Sharp X68000**, **NEC PC-98**, **Virtual Boy**, **Nokia N-Gage**, **Philips CD-i**, **Amiga CD32**, **Sega Channel & Satellaview**, **Infinium Phantom & Coleco Chameleon**, and **Steel Battalion**.
- **Installable Progressive Web App (PWA) & Offline Support:** Install **Played & Made** (`short_name`: **`Played&Made`**, 16-bit Pixel Heart emblem across standard, maskable, Android monochrome themed, and Apple Touch icons) directly to your Windows/macOS dock, Android launcher, or iPhone/iPad Home Screen (`📲 Install` in header/Settings when supported, with app-icon shortcuts, Richer Install UI previews, and an offline-capable service worker).
- **Creator Bio & Personal Timeline (`#about`):** Linked from the footer byline (`Johan Heurlin`), featuring a casual 16-year game-industry snapshot (*Apple App Store & Game Center* → *King* → *Google Play Games & Play Games on PC*) and an interactive Creator Gaming Timeline slot.
- **Natural Touch Gestures & Foldable Era Strips:** Swipe left/right across **Walk the Roots**, **Screenshot Zoom**, **Year Sheets**, and **Trivia**; swipe down to dismiss mobile sheets; drag-to-pan the **Lineage Org-Chart**; and fold/peek individual **📻 Meanwhile** pop-culture strips with saved state.
- **Direct Supabase AI Review Queue for Consoles, Games, Lineage & Ideas (`➕ Suggest console, game or idea`):** Zero-login in-app submission form writing permanently into a write-only RLS-protected **Supabase Postgres table (`public.pm_inbox`)** reviewed directly by AI & synced to the **Played & Made AI Triage Inbox** Google Sheet & `data/feature_backlog.json` — no GitHub login or personal WhatsApp/SMS share sheet required.

## Project Structure

- `src/app.html`: Single-file vanilla HTML/CSS/JS application template (`/*__DATA__*/` placeholder).
- `data/base/` & `data/agents/`: Family-tree, catalog, genre, and sourced lineage records.
- `data/studios.json`: Curated studio histories, human makers, and post-closure studio diaspora links.
- `data/culture.json`: Why Games Matter pillars, 14 seeded Letters to the Makers, 35 Hall of Pioneers profiles, 18 hardware engineer spotlights, 12 era nostalgia windows, *GTA* cultural headlines, and verified non-profits.
- `data/mechanics_world.json`: 16 cross-era mechanics, 30 genre definitions & hybrid lineages, 14 tabletop/boardgame bridges, verified studio logos, and cover overrides.
- `data/media.json` & `data/media_extra.json`: Resolved cover thumbnails (`wt:`/`w:` Wikimedia, `s:` Steam, `i:` IGDB), MobyGames IDs, and `1,192` YouTube gameplay/trailer IDs (`~` prefix marks best-effort auto-matches).
- `data/feature_backlog.json` & `tools/ai-feature-triage.py`: Structured feature backlog + AI placement classifier (`default` vs `settings-toggle`).
- `data/codes.json`: Append-only base-36 game code registry for permanent `#t1-…` and `#list-…` share URLs (**never delete or reorder entries**).
- `src/manifest.webmanifest` & `src/sw.js`: Web App Manifest (with subpath-safe `id`, maskable icons, app shortcuts, and Richer Install screenshots) and build-hashed offline Service Worker template.
- `tools/build.ps1`: Validates and merges all data into `dist/index.html`, `dist/inspired-by.html`, `dist/data.json`, `dist/manifest.webmanifest`, versioned `dist/sw.js`, and Google/AI-search discovery files (`dist/robots.txt`, `dist/sitemap.xml`, `dist/llms.txt`, plus Schema.org `JSON-LD` and static crawlable HTML).
- `tools/make-og-card.ps1` & `tools/make-pwa-assets.ps1`: Generate `dist/og-card.png` (`1200×630` OpenGraph card), `dist/icon-192.png`, `dist/icon-512.png`, `dist/icon-maskable-512.png`, `dist/apple-touch-icon.png`, and `dist/pwa-mobile.png`.
- `tools/fetch-media.py` & `tools/fetch-igdb-covers.py`: Cover art & MobyGames resolvers (`.env.local` is git-ignored and auto-loaded by `fetch-igdb-covers.py`).

## Rebuild & Preview Locally

```powershell
powershell -ExecutionPolicy Bypass -File tools\build.ps1
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

## Optional Local IGDB Cover Art Pass (`.env.local`)

Drop your Twitch Developer credentials into a local `.env.local` file in the repo root (git-ignored automatically):

```ini
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

Then run `python tools\fetch-igdb-covers.py` followed by `tools\build.ps1`.
