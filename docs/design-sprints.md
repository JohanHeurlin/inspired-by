# Inspired By: design sprints (Nov 17, 2026)

Inspired By has two halves that feed each other:

1. **My timeline**: tick the games you played growing up and get a shareable timeline of your life in games.
2. **Family tree**: look up any game and trace what inspired it, all the way back to the 1950s, and what it went on to inspire.

The version from Nov 7 had both halves, but they were separate tabs, the family tree was thin (404 links, 310 of them just "same series"), and sharing only worked for people inside your own claude.ai account.

---

## Sprint 1: The first two minutes

**Who:** a friend who taps your link in a group chat, on a phone, with two minutes of attention.

**What they want:** to see themselves. "What did I play when I was 12?" is irresistible. Nobody wants to fill in 40 years one screen at a time.

**What we learned from the old flow**
- It started with a birth year, then a grid of "iconic" games, then forced you year by year through 40+ screens.
- Three tiny buttons on every cover were fiddly on a phone.
- The payoff (the timeline) was hidden behind a button.

**Decisions**
- **One field to start:** the year you were born. Your name is asked only when you share.
- **"What did you play on?"** comes second. An Amiga kid shouldn't wade through NES games, and vice versa. The system list adapts to your age (it only shows systems from when you were 3 to 40).
- **One tap per game.** Tap once ✓ played, twice ✓✓ played a lot, three times ♥ favorite. Games are grouped by age bands (before you were born, 3–6, 7–9, 10–12…), picked by popularity and by the systems you chose.
- **Instant feedback:** a sticky bar shows your count and a tiny bar chart of your years, growing as you tap.
- **The reveal:** "Your life in games", with stats, a one-line hook ("Your games trace back to 412 earlier games, all the way to Spacewar! (1962)"), and a big Share button.
- **Depth is optional:** every year in your timeline has a "+ Add" tile that opens that year's games, and the search adds any game to the year it came out.

**Cut:** the forced year-by-year walkthrough, and the three tiny buttons.

---

## Sprint 2: The rabbit hole

**Who:** anyone with a favorite game, and game developers who care about where ideas come from (your teammates).

**What they want**
- "Where did my favorite game come from?"
- "What did it lead to?"
- "Take me back to the beginning."
- "How are these two games connected?"

**Decisions**
- **Every game gets a page:** who made it and where (with a flag), its genres and platforms, a note, and how much of later history traces back to it.
- **Roots:** one chain back to the oldest ancestor, preferring the strongest evidence. For example, "Elden Ring: 48 years in 9 steps".
- **Walk the roots:** a step-by-step story mode, one game per screen, with the year counting back. Each step says what the newer team *took* and what they *added*, with the source. This is the "ode to the people who make games" idea made literal.
- **Family tree:** two generations back and two forward, capped per column, ordered by year. Tap any game to move the tree to it. The old version drew every ancestor at once, which turns into a hairball once there are thousands of links.
- **Evidence stays visible:** every link is tagged "Developer said so", "Same team or code", "Same series", "Critics & historians", "Shared mechanics" or "Disputed", and shows its source. Filters let you hide the weaker kinds.
- **Ways in for people who don't have a game in mind:**
  - **Journeys:** curated genre stories (battle royale, the Souls family, Rogue to Hades, Minecraft's family, D&D to Baldur's Gate 3, ARC Raiders' roots, match three, the MOBA family).
  - **Today's rabbit hole:** a featured game of the day.
  - **Six degrees of Pong:** connect any two games.
  - **The most influential games**, ranked.
  - **The big picture:** a zoomable map of every game, by year and genre. Tap one to light up its whole family.
  - **Quiz:** "Which game inspired Doom?" Four covers, one answer, keep your streak.

---

## Sprint 3: Playing together

**Constraint we discovered:** friends outside your claude.ai account can open the page but can never save to its shared database. So the old "friends' timelines" feature only worked for you.

**Decisions**
- **Your timeline lives on your device, and the share link carries the whole timeline.** A 128-game timeline fits in a 464-character link. No account needed to view it, and nothing else about you is included.
- **Opening a friend's link** shows their timeline, how much you have in common, and a **Compare** view:
  - You both loved
  - You both played
  - At the same age: what each of you played at 8, 9, 10…
  - Only you, and only them
- **The friends wall:** you (the owner) can pin any friend's timeline you open, so everyone who opens the main link sees the crew.
- **Images:** a tall story card for chats and stories, and a 4K poster for your desktop.

---

## What's new or fun about it

- **The halves meet in your Gaming DNA.** Your timeline becomes a family tree of *you*:
  - the earlier games that shaped the most games you played
  - your genre mix
  - "roots you never played"
  - "what came next": games that borrowed from your favorites that you haven't ticked yet
- **Credits first.** Every link leads with what the newer team added, not with "X copied Y".
- **The covers are generated, not scraped.** The era sets the box style (a phosphor screen for the 1950s–70s, stripes for the early 80s, a pixel grid for the late 80s, airbrush for the early 90s, jewel case, keep case, flat digital tile), and the genre sets a pixel picture. Your timeline literally changes packaging as you grow up.

## Next ideas (not built yet)

- **Real box art:** needs an image source with a license, such as IGDB.
- **Community corrections:** "Suggest a missing link" opens the page's comment box today. A proper review queue needs everyone to have write access.
- **Ask Claude:** for games not in the tree yet, clearly labeled as unverified.
- **A yearly "Wrapped"** for the current year.
