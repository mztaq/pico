# Pico Cloudflare D1 backend (draft)

This feature branch adds an opt-in prototype for anonymous workspace usage and a preference API. It does **not** upload code, editor files, typed inputs, or flowcharts.

## Setup
- Bind production and preview Cloudflare Pages to the existing `pico-db` D1 database using binding name `DB`. For safe previews, prefer a separate preview D1 database with the same schema.
- `public/_routes.json` runs Functions only for `/api/*` URLs. All compiler assets stay static.
- Tables required: `pico_visitors`, `pico_consent`, `pico_usage`, `pico_preferences`, per the setup already performed in D1 Console.
- Production is unchanged until the branch is merged.

## API
- `GET /api/consent`: current server-recognized opt-in state.
- `POST /api/consent`: booleans `analytics` and `preferences`. Opting out of both deletes the visitor and related records.
- `GET /api/preferences`: read settings, gated by preference consent.
- `PUT /api/preferences`: update theme, last workspace, and settings JSON.
- `DELETE /api/preferences`: delete stored preferences.
- `POST /api/usage`: submit 1-60 active seconds and one of `logic`, `python`, `pseudocode`, `flowchart`, `cpu` when analytics is permitted.

## Before merging
- Run `pnpm install`, `pnpm check`, `pnpm test`, and `pnpm build`. Those checks have not been run by the authoring assistant.
- Test endpoint requests and cookie behavior using a Pages preview deployment with a dedicated preview D1 database.
- Integrate cloud preferences with existing settings storage. This draft currently exposes the preference API but does not automatically synchronize settings.
- Review privacy policy, cookie text, accessibility and consent-revocation behavior, including cross-tab behavior.
- Add durable rate limiting, idempotent telemetry updates, abuse defenses, and scheduled deletion of expired records before enabling production tracking.
- Test the backup and restore plan before real visitor data collection.

## Security notes
Cookie values are browser-specific random identifiers, not hardware fingerprints. D1 stores only their SHA-256 hashes. Cookies use Secure, HttpOnly and SameSite=Lax. State-changing API calls check the Origin header.
