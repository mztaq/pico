# Pico Learn: Notes and Pico Arena

This feature branch keeps Pico's existing Computer Science notes and makes Pico Arena
the single game experience. The existing Workspaces and Games section remain separate.

## Modes

- **Classic Quiz:** Host-created or topic-bank questions. Correct answers earn points.
- **Circuit Clash:** Answer questions to earn charge, capture 20 nodes, and reinforce
  owned nodes. Upgrade the amplifier for more charge per correct answer.
- **Hacker Heist:** A 2D hacker-style server grid with the same charge economy.
  Hack unclaimed and rival server nodes to take control.
- **Data Sprint:** A 2D race in which correct answers advance a player's racer.
- **Solo:** A simulated CPU rival with no backend. Quiz topics use Pico's existing bank.
- **Multiplayer:** One 6-character room code shared by all players, with server-side
  answers and authoritative scores. Host controls round length, player limits,
  random or player-chosen nicknames, and question source.

The server holds up to 30 host-created questions per session and validates their
four choices, answer index and text length. The question bank currently contains
**61 original questions across 30 topics**, not 10,000 per topic. Do not advertise
10,000 until that many genuinely distinct, reviewed questions exist.

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
- Clients poll room state every 2.5 seconds. This uses request quotas.
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
