# Pico Arena: game-first implementation plan

Status: active design / draft PR #158. Main must remain unchanged until live gameplay
and multiplayer deployment are verified.

## Research and reference points

The goal is not to copy competitor artwork, source code or copyrighted characters.
Use their mechanics and presentation principles to define original Pico games.

- Blooket **Tower Defense**: correct answers provide tokens for building/upgrade
  decisions. Questions arrive between waves, not permanently beside the map.
  References: https://help.blooket.com/hc/en-us/articles/42441291043095-Game-Overview-Tower-Defense
  and https://help.blooket.com/hc/en-us/articles/42448846834455-Game-Overview-Tower-Defense-2
- Gimkit **2D modes**: real interactive playfields, original little character
  avatars, and game settings that adjust the balance between quiz and gameplay.
  References: https://help.gimkit.com/en/article/2d-game-modes-1fhidpg/
  and https://help.gimkit.com/en/article/game-options-explained-16312ua/
- Wayground **WayArena**: clearly separated quiz and battle phases, rewards that
  directly power play, short games, and a host spectator view with results.
  Reference: https://help.wayground.com/support/solutions/articles/158000451316-wayarena

## Design contract

1. Never render an empty page. A missing game chunk, deploy problem or crash must
   show an error with a reload/back option. Direct nested paths must work after
   a hard refresh and after browser Back/Forward.
2. The playfield occupies the centre of the game, not a small card next to a
   permanent quiz panel. HUD has only time, health, charge, score, and menu.
3. A button opens a focused quiz overlay. Correct answers grant charge or a
   mode-specific resource. The player returns to the world immediately.
4. Final goal: alternating learning and gameplay phases: question earning,
   preparation, wave/battle and next-wave reward. Host settings govern how often
   students answer questions.
5. Use original hand-drawn-style 2D creatures/turrets in high-DPI Canvas,
   high-contrast outlines, simple bright map tiles, short hit/impact animations,
   health bars and clear path indicators.
6. Keep Pico themes for all menus and overlays; use original colour schemes for
   the game world itself. Reduce motion and disable expensive decoration when
   requested.
7. Do not needlessly add copy, labels above headings, tutorial walls, multiple
   navigation tabs or a site footer during gameplay.

## Four distinct modes

### Circuit Clash: strategy tower defence
- Lush board with a winding route, server base and clear enemy entry.
- Blaster rapid fire, Frost slowing, Pulse area damage; upgrade, later sell and
  target priority settings.
- Enemy types have readable silhouettes, attack animations, health and wave
  progression, not anonymous squares.
- Server loses health when enemies pass; survive until the end to win.
- Future phase: answer 3 questions, spend earned charge, start a wave, repeat.
  Current code still simulates continuous timed waves. Do not call this milestone
  complete until a real wave-preparation flow is implemented.

### Hacker Heist: cyber action and puzzle mode
- Different game, not merely recoloured tower defence.
- Cyber-map, fictional security nodes and simulated terminal puzzles that
  require recognising logic/security clues. Never ask users for real passwords.
- Earn breach energy by answering questions; spend it on malware defences,
  a timed firewall lockdown, or fictional security mini-game actions.
- Future: independent objective and score logic, not shared tower-defence rules.
  Present code currently shares tower defence with a separate firewall ability.

### Data Sprint: 2D racing
- Distinct characters and lanes, simple run cycles, finishing markers and
  progress visibly driven by question accuracy.
- Next milestone: player interaction, hazards/checkpoints and meaningful choices,
  not solely an animated score indicator.

### Classic Quiz
- Clean full-screen question mode with score, short feedback, streaks and
  projected top-five results. No forced fictional action layer.

## Hosting

Choose mode, question source (bank or host-written), duration (90–480s),
player limits, nickname style, then create the code. Players join via code or
link. Host sees an uncluttered spectator screen and start/end controls.
Room state is held in a memory-only Cloudflare Durable Object.
Server grades answers and validates every charge purchase. No D1 required.
Sessions can be erased on eviction, restarts and deploys. Avoid claiming
durability, persistent rooms or uninterrupted high-concurrency service.

## Visual performance

- HTML/CSS for UI, Canvas 2D for action. No WebGL or heavy 3D dependencies.
- Cap render FPS to 30 on low-spec PCs. Adapt device pixel ratio (maximum 2).
- Fixed simulation timestep; fixed maximum units; skip offscreen rendering.
- Do not fetch external fonts or images in a game loop.
- Keyboard and pointer support; touch targets at least 40px where practical.
- Reduced-motion accessibility and theme contrast checks.

## Release checklist

- [x] Render failure boundary added around Learn and lazy Arena.
- [x] Direct-link regression test for /app/learn?section=arena&mode=circuit.
- [x] Full-width 2D battlefield plus compact HUD; quiz overlay on request.
- [x] Distinct themed maps for Circuit Clash and Hacker Heist.
- [x] Multiplayer score/charge actions validated in the Worker.
- [ ] Verify published Pages preview opens after a hard refresh and after
  changing modes, using a real browser console and Network tab.
- [ ] Create a true alternating question / build / wave / results state machine.
- [ ] Expand original character/tower art and impact effects.
- [ ] Build Hacker Heist's own fictional terminal game, distinct from TD.
- [ ] Add meaningful player controls and hazards to Data Sprint.
- [ ] Test two or more concurrent players, disconnections, resource spending
  and spectating with Preview Worker and `ARENA_SERVICE` binding.
- [ ] Validate mobile widths and older school PCs before merging.

## Success conditions

A new player should identify the goal in under 10 seconds, enter an actual
playfield immediately, understand the reward from answering a question, see
visible changes caused by each purchase, and finish with an accurate scoreboard.
No blank screen; no footer over the match; no static diamond-grid imitation.
