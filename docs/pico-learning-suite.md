# Pico Learn: Notes and Pico Arena

This feature branch keeps Pico's existing Computer Science notes and makes Pico Arena
the single game experience. The existing Workspaces and Games section remain separate.

## Modes

- **Classic Quiz:** Host-created or topic-bank questions. Correct answers earn points.
- **Circuit Clash:** A playable Canvas 2D tower-defence battlefield. Answer questions
  for charge, place Blaster/Frost/Pulse towers off the winding enemy route, upgrade
  towers, survive progressively harder malware waves and protect your server core.
  Frost slows enemies, Pulse damages nearby groups and Blasters fire quickly.
- **Hacker Heist:** The same real-time tower-defence engine with faster malware
  and a distinct charge-powered Firewall Lockdown ability that slows enemies for
  seven seconds and has a cooldown. Its own cyber-style arena graphics.
- **Data Sprint:** An animated 2D race with original little runner characters,
  moving on lanes and reaching a finish line as players answer questions.
- **Solo:** A CPU opponent with its own simulated defence, automatic tower builds,
  malware waves, core health and points. Works offline without a room Worker.
- **Multiplayer:** One 6-character room code shared by all players, with server-side
  answers and authoritative scores. Host controls round length, player limits,
  random or player-chosen nicknames, and question source.

The server holds up to 30 host-created questions per session and validates their
four choices, answer index and text length. The question bank currently contains
**211 questions across 30 topics**: the 61 existing questions plus 150 newly written,
conceptually distinct questions (five new questions per topic). It does **not** contain
10,000 per topic. Each question has a separate prompt, four distinct options, one
correct answer, and an explanation. The regression tests reject duplicate IDs,
exact or numerical-variation prompts, invalid answers and missing topic coverage.

The 10,000-per-topic target is 300,000 questions. Building this responsibly
requires a reviewed source corpus, copyright checks, subject review and
near-duplicate screening. Never generate number-swapped clones or advertise
the target as complete until those checks are done.

## No D1, SQL migrations, or external server

Rooms use an API backed by a **Cloudflare Worker with Durable Objects**.
The Pages Function at `/api/arena/*` forwards requests via an internal service
binding to a Worker called `pico-arena-rooms`.

A separate memory-only Durable Object manages each room. The Worker does
**not** call Durable Object storage or D1, and it stores no quiz answers or
student data in a database. Cloudflare provisions a SQLite-backed namespace
for Free-plan Durable Objects, but this application does not use its storage.

As with any in-memory state, **inactive rooms or Cloudflare restarts can erase
matches**. Sessions are temporary, with a maximum lifetime of two hours.
A continuous match is best-effort and not restart-safe without persistence.

## Deploy the Worker

From the repo root, authenticated to Cloudflare:

```bash
npx wrangler deploy --config workers/pico-arena/wrangler.jsonc
```

The Worker configuration disables its public `workers.dev` endpoint. Access
is through a Cloudflare Service Binding, not a public API URL.

## Bind Pages to the Worker

1. Open Cloudflare Workers & Pages → your **picompiler Pages project**.
2. Under **Settings → Bindings**, add a **Service binding**.
3. Binding name: `ARENA_SERVICE`.
4. Worker/service: `pico-arena-rooms`.
5. Configure the **Preview** environment for the feature branch. Do Production
   too when you decide to release it.
6. Redeploy the Pages branch.

The deployed Pages Function then serves `/api/arena/create`,
`/api/arena/join`, `/api/arena/room?code=...`,
`/api/arena/start`, `/api/arena/answer`,
`/api/arena/action`, and `/api/arena/close`.

Without the service binding, multiplayer returns HTTP 503 with an
explanatory message. **Solo play and Notes still work without it.**

## Host controls and safety

- Host selects a mode, round length (90 to 480 seconds), minimum players
  (1–30), maximum players (1–30), and nickname style.
- In generated-name mode, the Worker assigns unique names including
  combinations such as BeardlyWolf and HotMonkey.
- Player-defined nicknames must be unique in the room and contain 2–20
  permitted characters.
- Topic-bank mode chooses from a selected IGCSE Computer Science unit.
- Custom-question mode accepts 1–30 host-authored multiple-choice questions.
- Host sessions and player sessions use separate random 256-bit bearer tokens.
  Only SHA-256 token hashes are kept in memory.
- Players cannot report scores to the Worker. The Worker grades each answer
  and applies all purchases to the authoritative room state.
- Clients poll room state every 2.5 seconds. The Worker advances each
  student's defence simulation on requests and validates all tower purchases,
  upgrades, charge spending, cooldowns and server-side scores.
  This uses Cloudflare request quotas.
- A Worker must serialize overlapping actions for each room to prevent
  overspending or inconsistent tile ownership.
- The existing Pages Function rejects cross-origin POST requests.

Before releasing publicly, test school-wide concurrency, rate limits,
network interruptions, mobile gameplay, screen-reader labels, CSS themes,
and CPU usage on low-spec PCs.

## Quality checks

```bash
pnpm check
pnpm test
pnpm build
```

Cloudflare Worker deployment is separate from the Vite build. Test the Worker
after deploying its Service Binding. A local production build alone is not
proof that multiplayer rooms work.

## Current question bank quality and growth

- `src/learning/questionBankExtra.ts` holds 150 new manually authored questions, five per topic.
- `src/learning/questionBank.test.ts` checks ID uniqueness, normalized prompts, answer choices, explanations, topic coverage and question rotation.
- `src/learning/arenaRules.ts` uses a full-cycle question index so every question in a selected topic bank appears before repetition.
- The test detects exact duplicates and simple numerical variants, not all semantic paraphrases. Editors must still review the science and wording before release.
- For 10,000 unique questions per topic, first create a licensed, reviewed source bank and arrange topic-based static chunks. Do not bundle 300,000 questions into the initial application JavaScript.

## Gameplay implementation

- `src/learning/towerDefense.ts`: deterministic simulation of moving enemies,
  tower targeting, projectiles, health, waves, upgrades and firewall abilities.
- `src/learning/DefenseField.tsx`: 30 FPS responsive Canvas renderer with
  visible turrets, animated malware, attack effects and click/keyboard controls.
- `src/learning/defense-field.css`: theme-aware map and tower shop layout.
- `src/learning/DefenseShowcase.tsx`: animated Learn landing preview matching
  the actual winding battlefield rather than the previous static node grid.
- `src/learning/towerDefense.test.ts`: movement, build legality, waves,
  damage, determinism, firewall and upgrade regression checks.
- The Learn footer appears **only on the Learn selection screen**. It never
  overlaps gameplay, the match leaderboard or the Notes page.
- HTML Canvas, CSS and small SVG icons are used for fast 2D rendering. No
  game engine, WebGL, stock art or copyrighted Gimkit/Blooket assets are used.
- The multiplayer Worker must be redeployed after this update, since room
  participants now have server-authoritative individual defence states.
