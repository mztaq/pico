# Pico Cloudflare D1 backend (draft)

This feature branch adds an opt-in prototype for anonymous workspace usage and a preference API. It does **not** upload code, editor files, typed inputs, or flowcharts.

## Setup
- Bind production and preview Cloudflare Pages to the existing `pico-db` D1 database using binding name `DB`. For safe previews, prefer a separate preview D1 database with the same schema.
- `public/_routes.json` runs Functions only for `/api/*` URLs. All compiler assets stay static.
- Tables required: `pico_visitors`, `pico_consent`, `pico_usage`, `pico_preferences`, per the setup already performed in D1 Console.
- Production is unchanged until the branch is merged.

## API
- `GET /api/cookies`: current server-recognized opt-in state.
- `POST /api/cookies`: booleans `analytics` and `preferences`. Opting out of both deletes the visitor and related records.
- `GET /api/preferences`: read settings, gated by preference consent.
- `PUT /api/preferences`: update theme, last workspace, and settings JSON.
- `DELETE /api/preferences`: delete stored preferences.
- `POST /api/usage`: submit 1-60 active seconds and one of `logic`, `python`, `pseudocode`, `flowchart`, `cpu` when analytics is permitted.

## Before merging
- Run `pnpm install`, `pnpm check`, `pnpm test`, and `pnpm build`. Those checks have not been run by the authoring assistant.
- Test endpoint requests and cookie behavior using a Pages preview deployment with a dedicated preview D1 database.
- Verify cloud preference synchronization in a Pages preview: accept Preferences, change the compiler theme and font size, wait at least 2 seconds, and query `pico_preferences`. Verify it stops sending writes when consent is revoked.
- Review privacy policy, cookie text, accessibility and consent-revocation behavior, including cross-tab behavior.
- Add durable rate limiting, idempotent telemetry updates, abuse defenses, and scheduled deletion of expired records before enabling production tracking.
- Test the backup and restore plan before real visitor data collection.

## Security notes
Cookie values are browser-specific random identifiers, not hardware fingerprints. D1 stores only their SHA-256 hashes. Cookies use Secure, HttpOnly and SameSite=Lax. State-changing API calls check the Origin header.

## Test the route on a Pages preview deployment
1. Configure a **Preview** D1 binding named `DB` (a separate D1 database with the four tables is preferred).
2. Redeploy the preview after binding changes.
3. Open `https://YOUR-PREVIEW.pages.dev/api/cookies`. Expected JSON: `{"status":"ok","database":"connected","analytics":false,"preferences":false}` for a new visitor.
4. In browser DevTools > Network, click Accept All and inspect `POST /api/cookies`, response status 200 and `Set-Cookie: __Host-pico_id=...`. Refresh the GET endpoint and expect both choices true.
5. Click Reject All, check the POST succeeds and the cookie is removed. A new GET should report both choices false.
6. Run `SELECT COUNT(*) AS visitors FROM pico_visitors;` in the **preview** D1 Console to inspect inserts/removals.

A 404 indicates the Functions route is not deployed. A 503 indicates the D1 binding or table is missing or unavailable. A failed POST can be inspected in Network for its response code.

## Preferences implementation
- Existing `pico.settings.v6` localStorage remains the immediate source of truth.
- When Preferences is enabled, the client uploads a compact settings JSON to `PUT /api/preferences` after a 1.2-second debounce.
- When no current local settings exist, the client attempts `GET /api/preferences` and restores the stored preferences before reloading the UI.
- If local settings exist, they take priority; the client syncs these to D1. No projects, code or flowcharts are uploaded.
- A declined Preferences choice disables the sync listener, and the consent API deletes the remote preference record.
- Verify synchronization with real changes before release; cross-device syncing and account identity are out of scope.
