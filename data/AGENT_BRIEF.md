# Inspired By: content brief for research agents

## What this is

"Inspired By" is a web app about video game history, shared among friends and game-industry teammates (people who will check the facts). It has two halves:

1. **The family tree.** Search any game and see which earlier games inspired it (all the way back to the 1950s–70s), and what it went on to inspire. Every link says what the newer game *took* and what it *added*, how strong the evidence is, and where that comes from.
2. **My gaming timeline.** People tick the games they played growing up, year by year, and share the result. This needs a broad catalog of games people actually played, on every platform.

Your job is to add accurate, well-sourced content. Accuracy beats volume, but volume matters too: aim high within your slice.

## Project folder

`C:\Users\Johan\Desktop\Johan\01 - Prototypes & Builds\Inspired By\data\`

Existing data (read these first, and grep them before adding anything):

- `base\ids.tsv`: the 500 games already in the family tree (id, title, year, dev). **When you link to one of these games, use its existing id exactly** (some are short, for example `zelda` = The Legend of Zelda, `shadow-colossus` = Shadow of the Colossus, `pubg`, `half-life`).
- `base\links.tsv`: the 404 existing links (from, to, tier). Don't duplicate a pair that already exists.
- `base\catalog.tsv`: the 842 games already in the timeline picker (year, title, brand, dev, country, platforms).
- `base\data.json`: the full existing family tree (games and links with all text), if you need to see examples.

## Output

Write your results as JSON files in `data\agents\`, named `<your-slice>-1.json`, `<your-slice>-2.json` and so on. Keep each file under about 60 KB and write each one as soon as it's ready, so nothing is lost if you run long. Every file has this shape (leave out keys you don't use):

```json
{
  "games": [ ...new games only... ],
  "links": [ ...new links... ],
  "updates": [ {"id": "existing-id", "field": "year", "value": 1987, "why": "first released in Japan in 1987"} ]
}
```

The files must be valid JSON (double quotes, no trailing commas, no comments). After writing each file, check that it parses, for example with PowerShell: `Get-Content -Raw <file> | ConvertFrom-Json | Out-Null`.

### Game object

```json
{"id":"hollow-knight","title":"Hollow Knight","year":2017,"dev":"Team Cherry","cc":"AU","genres":["metroidvania"],"plats":["PC (Windows)","Switch","PlayStation 4","Xbox One"],"pop":4,"note":"Made by a team of three in Adelaide after a Kickstarter in 2014."}
```

- **id**: lowercase slug of the title. `&` becomes `and`, apostrophes and other punctuation are dropped, spaces become hyphens: "Baldur's Gate 3" → `baldurs-gate-3`. For a title that repeats in a franchise (reboots, remakes), add the year: `doom-2016`, `tomb-raider-2013`, `prey-2017`.
- **title**: the common English title.
- **year**: the year of the *first* release anywhere (a Japanese release counts).
- **dev**: the lead developer (a studio, or a person for early and indie games). Keep it short.
- **cc**: ISO two-letter country of the developer: US, JP, GB, SE, FI, FR, DE, CA, PL, AU, KR, CN, NO, DK, NL, CZ, UA, IS, RU and so on.
- **genres**: 1–2 keys from the genre list below.
- **plats**: the platforms it originally came out on, up to 6, using the platform names below.
- **pop**: how widely known or played it is today among people aged 25–50. 5 = household name (Tetris, Minecraft, Pac-Man). 4 = big hit most gamers know. 3 = well known to enthusiasts. 2 = cult or niche. 1 = historical or obscure.
- **note**: optional, at most 25 words: one striking, true fact. Plain words, no hype.

### Link object

```json
{"from":"metroid","to":"hollow-knight","tier":"dev","took":"A big interconnected map you open up by finding new abilities.","added":"A hand-drawn insect kingdom with demanding combat and almost no hand-holding.","src":[{"t":"William Pellen (Team Cherry), interview, 2017","u":"https://..."}],"extra":""}
```

- **from** is the earlier game (the inspiration), **to** is the later game.
- **tier** says how strong the evidence is:
  - `dev`: a developer of the later game publicly said the earlier game inspired it. Requires a source you actually found, with its URL.
  - `team`: the same key people or studio lineage, or the later game was built directly on the earlier one's engine, code or mod (Counter-Strike began as a Half-Life mod). "Same publisher" is not enough.
  - `series`: a direct sequel, prequel, spin-off or remake in the same franchise. Use sparingly: only main steps not already in `base\links.tsv`.
  - `critic`: critics, historians or the genre's documented history credit the earlier game as an influence, but you have no developer statement. Cite where it's documented (a Wikipedia article is fine).
  - `mech`: the earlier game popularized a core mechanic or genre that the later game is clearly built around, without a documented claim of direct influence. Use it when it helps someone trace a genre, and phrase it as "popularized" rather than "inspired".
  - `disp`: people disagree, or the developer denied it. Explain in `extra`.
- **took**: what the later game took from the earlier one. At most 18 words, concrete and plain.
- **added**: what the later game added or changed. At most 18 words. This is the star of each card: lead with the new team's own contribution.
- **src**: 0–2 sources. `t` = who said it, the outlet and the year (for example "Hidetaka Miyazaki, interview, Edge, 2015"). `u` = a URL **only if you saw that exact URL in a search result or fetched it**. Never build or guess a URL. Wikipedia article URLs are fine for `critic` and `mech` links when the article covers the connection.
- **extra**: optional, at most 25 words of context.

Good examples from the existing data:

```json
{"from":"shadow-colossus","to":"arc-raiders","tier":"dev","took":"Being a small human in a vast world full of huge machines.","added":"Turned that into a risky scavenging run you share with other players.","src":[{"t":"GamesRadar+, Stefan Strandberg (Embark), Nov 2025","u":"https://www.gamesradar.com/..."}],"extra":"Named as one of three games in Embark's early concept."}
```

## Quality rules

- **Never invent a connection.** If you aren't confident, leave it out. A smaller set of true links beats a big set with errors.
- No time travel: the `from` game's year must be earlier than or equal to the `to` game's year (equal only when the timing is documented).
- Every new game you add should connect to at least one other game through a link.
- Prefer links that let people trace a famous game back toward the 1970s (or the tabletop and mainframe roots), and links that show what a famous game went on to inspire. Fill gaps: famous games with no "inspired by" links are the biggest win.
- Don't duplicate existing pairs. Check `base\links.tsv`.
- Plain language. Don't use hype words such as iconic, legendary, revolutionary, masterpiece, groundbreaking, seminal.
- Don't add games that weren't released by mid-2026. For anything released in 2025 or 2026, confirm the release with a search.
- Credit the people: when a designer is known (Shigeru Miyamoto, Brenda Romero, Hideo Kojima, Markus Persson), name them in the source or note.

## Verifying with web search

Load the search tool once with ToolSearch (query `select:WebSearch`), then use it with `mode: "standard"`. Use it mainly to confirm `dev`-tier claims before you write them, and to get their URL. A search result whose title or snippet confirms the statement is enough. Budget roughly 40–80 searches, spent on the claims that matter most (famous games, surprising claims, recent games). If you believe a developer said something but can't confirm it, either use `critic` with a Wikipedia source or drop it.

## Genre keys (use 1–2 per game)

`roots` (early computer, mainframe and tabletop roots) · `arcade` (arcade and maze action) · `shmup` (shoot 'em up) · `platformer` · `metroidvania` · `action-adventure` · `open-world` · `fps` (first-person shooter) · `shooter` (third-person, tactical and online shooter) · `battle-royale` (battle royale and extraction) · `immersive-sim` (immersive sim and stealth) · `horror` · `rpg` (Western RPG) · `jrpg` (Japanese RPG) · `arpg` (action RPG and soulslike) · `roguelike` (roguelike and roguelite) · `mmo` (online worlds) · `strategy` (strategy and tactics) · `moba` (MOBA and auto-battler) · `sim` (simulation and management) · `survival` (survival, crafting and sandbox) · `adventure` (adventure and story) · `puzzle` · `fighting` · `beat-em-up` · `racing` · `sports` · `party` (party, music and social) · `card` (card and deckbuilder) · `space` (space and flight)

## Platform names (use these exact spellings)

Arcade · PC (DOS) · PC (Windows) · Mac · Linux · Amiga · Commodore 64 · Atari ST · ZX Spectrum · Amstrad CPC · MSX · Apple II · Atari 8-bit · Atari 2600 · Atari 7800 · Intellivision · ColecoVision · NES · SNES · Nintendo 64 · GameCube · Wii · Wii U · Switch · Switch 2 · Game Boy · Game Boy Color · Game Boy Advance · Nintendo DS · Nintendo 3DS · Master System · Mega Drive / Genesis · Sega CD · Saturn · Dreamcast · Game Gear · PlayStation · PlayStation 2 · PlayStation 3 · PlayStation 4 · PlayStation 5 · PSP · PS Vita · Xbox · Xbox 360 · Xbox One · Xbox Series X|S · iPhone / iPad · Android · Browser · TurboGrafx-16 · Neo Geo · 3DO · Atari Jaguar · Atari Lynx · Mainframe (for PDP-1, PLATO, university and lab machines before home computers) · Tabletop (board, card and pen-and-paper games) · VR (Quest, PC VR, PS VR)

## When you're done

Reply with a short report: how many games and links you added (and how many links are `dev` tier), the five most interesting chains you created, and anything you were unsure about. Don't paste the data into the reply; it's in the files.
