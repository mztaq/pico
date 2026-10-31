# Pico Cloudflare D1 backend

Pico uses an opt-in Cloudflare D1 backend for anonymous workspace usage and optional preference synchronization. It does **not** upload code, editor files, typed inputs, or flowcharts.

## Setup
- Bind production and preview Cloudflare Pages to the existing `pico-db` D1 database using binding name `DB`. For safe previews, prefer a separate preview D1 database with the same schema.
- `public/_routes.json` runs Functions only for `/api/*` URLs. All compiler assets stay static.
- Tables required: `pico_visitors`, `pico_consent`, `pico_usage`, `pico_preferences`, per the setup already performed in D1 Console.
- Review changes in a preview before updating Production. Deployments require matching D1 bindings and a configured rate-limit secret.

## API
- `GET /api/cookies`: current server-recognized opt-in state.
- `POST /api/cookies`: booleans `analytics` and `preferences`. Opting out of both deletes the visitor and related records.
- `GET /api/preferences`: read settings, gated by preference consent.
- `PUT /api/preferences`: update theme, last workspace, and settings JSON.
- `DELETE /api/preferences`: delete stored preferences.
- `POST /api/usage`: submit `{batchId: crypto.randomUUID(), entries: [{workspace:'python',seconds:15}]}` with 1-60 total active seconds, up to six workspaces per batch, when analytics is permitted. Repeating a batch ID does not add usage twice. The six counters are `logic_sim_seconds`, `python_seconds`, `pseudocode_seconds`, `flowchart_seconds`, `cpu_studio_seconds`, and `binary_lab_seconds`.

## Before new releases
- Run `pnpm install`, `pnpm check`, `pnpm test`, and `pnpm build`. Review GitHub Actions results and run these checks locally when changing the backend.
- Test endpoint requests and cookie behavior using a Pages preview deployment with a dedicated preview D1 database.
- Verify cloud preference synchronization in a Pages preview: accept Preferences, change the compiler theme and font size, wait at least 2 seconds, and query `pico_preferences`. Verify it stops sending writes when consent is revoked.
- Review privacy policy, cookie text, accessibility and consent-revocation behavior, including cross-tab behavior.
- Deploy and verify the D1 migration, rate-limit secret, and separate cleanup Worker before merging. Rate limits are basic D1/IP protections, not a substitute for Cloudflare WAF controls.
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

## Required migration and deployment configuration

**The updated API intentionally rejects POST requests with HTTP 503 until the rate-limit secret is configured.** Do not rotate the secret during active requests without considering the temporary effect on counters.

1. Open the D1 Console for the matching Preview database and execute `migrations/0002_usage_safety.sql`. It creates `pico_usage_events` and `pico_rate_limits`. Apply the same migration to Production only before a production release.
2. In Cloudflare Pages → picompiler → Settings → Preview → Variables and secrets, add a secret variable named `RATE_LIMIT_SECRET`. Generate a unique random value at least 32 characters long. Do not commit the secret to GitHub or paste it into chat.
3. Redeploy the feature-branch preview.
4. Verify `GET /api/cookies` still returns `database: connected`. Click Accept All and verify POST returns 200.
5. Verify `POST /api/usage` sends a batch ID and one to six workspace entries. Replaying the **same** batch ID must return `applied:false` and leave totals unchanged.
6. Check that excessively repeated requests return HTTP 429. The current per-minute ceilings are cookies 12, preferences 20 and usage 24 requests per IP address. Shared school networks may hit these sooner.

## Binary Lab usage counter migration (required before releasing)

The sixth workspace uses `pico_usage.binary_lab_seconds` for opt-in active time. Its **physical position must be immediately before `last_updated`**, matching the existing production schema supplied from the D1 Console.

Cloudflare D1/SQLite appends columns with `ALTER TABLE ADD COLUMN`. Migration `migrations/0003_binary_lab_usage.sql` therefore creates `pico_usage_reordered` with the intended order, copies **every existing visitor ID, five usage totals, and timestamp**, initializes Binary Lab time to zero, then replaces the original table. It preserves the primary key and `ON DELETE CASCADE` foreign key to `pico_visitors`.

**Do not deploy or merge the API until the migration has been applied successfully.** The API includes the sixth counter in all usage writes, so a missing column will break tracking for every workspace.

1. Confirm the matching Cloudflare Pages D1 database binding `DB`, and back up the live database. Test the migration on a separate Preview D1 database first.
2. Inspect the existing schema and check for custom indexes, triggers, dependent tables, or restrictive visitor-workspace CHECK constraints. Stop and adapt the migration if additional table dependencies are present:
   ```sql
   PRAGMA table_info(pico_usage);
   SELECT type, name, sql FROM sqlite_master
     WHERE tbl_name='pico_usage' AND type IN ('index','trigger') AND sql IS NOT NULL;
   SELECT type, name, sql FROM sqlite_master
     WHERE type='table' AND sql LIKE '%REFERENCES pico_usage%';
   SELECT sql FROM sqlite_master WHERE type='table' AND name='pico_visitors';
   ```
3. Use the migration file with the **transactional Cloudflare D1 migrations runner** on the intended database. Configure Wrangler to target the correct database and verify whether older migrations were already manually applied, to avoid replaying them. Cloudflare's `wrangler d1 migrations apply` backs up the database and rolls back failed migrations. Avoid pasting individual `DROP TABLE` steps into the dashboard.
4. Verify the new field order and data integrity:
   ```sql
   PRAGMA table_info(pico_usage);
   PRAGMA foreign_key_check;
   SELECT visitor_id, logic_sim_seconds, python_seconds, pseudocode_seconds,
          flowchart_seconds, cpu_studio_seconds, binary_lab_seconds, last_updated
     FROM pico_usage LIMIT 5;
   ```
   The expected order is `visitor_id`, `logic_sim_seconds`, `python_seconds`, `pseudocode_seconds`, `flowchart_seconds`, `cpu_studio_seconds`, `binary_lab_seconds`, `last_updated`. Check original totals and row counts against the backup. New binary totals should be zero.
5. Migrate Production only after Preview verification, then merge/deploy the API, accept Analytics on a test browser and spend time in Binary Lab. Verify that only `binary_lab_seconds` increments, and the other five workspace counters, Preferences API, and idempotent batch retries still work.

This is a **one-time** table rebuild. If the sixth column already exists, do not re-run this migration. Applying the SQL file in GitHub does not alter the live database.

## Scheduled retention cleanup

Pages Functions do not support scheduled cron handlers. Create a **separate Cloudflare Worker** from `workers/pico-cleanup.ts`, bind the appropriate D1 database as `DB`, and configure the Cron Trigger `0 2 * * *` (02:00 UTC daily). Deploy Preview cleanup against the Preview D1 database. After review, deploy a separate Production cleanup Worker bound to Production D1. Do not share D1 with another environment unintentionally.

This Worker removes expired consent/visitor records, seven-day-old usage batch IDs, and expired request-limit counters. Foreign-key cascades remove related preferences and usage. Do not enable production collection before confirming the Worker executes and deletion works.

## Regression checklist

1. GET /api/cookies works with or without a cookie.
2. Accept All creates one visitor and consent record.
3. Change theme and font size. One preferences row updates after debounce. Browser theme changes immediately.
4. Track 20 active seconds in Python, 20 in Flowchart, then 20 in CPU Studio. Expect these specific workspace totals (with one-second sampling tolerance), not all seconds in the last workspace.
5. Send the exact same usage batch ID twice. Expect `applied:true` then `applied:false`; totals must increase only once.
6. Leave the tab inactive or hidden. No additional active seconds should be recorded.
7. Reject All. Existing visitor, consent, usage, and preferences rows are deleted.
8. Set a test visitor's `expires_at` to the past and run the cleanup Worker manually in a nonproduction environment. Confirm that its dependent rows disappear.

## Consent lifetime renewal

Successful consented activity in `POST /api/usage` and `PUT /api/preferences` extends both `pico_visitors.expires_at` and `pico_consent.expires_at` by 90 days. The server also renews the Secure, HttpOnly visitor cookie using `Set-Cookie`. Reading public pages or rejecting optional consent does not extend tracking. The `pico_consent.updated_at` field is changed only when a visitor explicitly updates their consent choice.

Regression test: with Analytics accepted, record a valid usage batch and verify both expiry timestamps move forward together; check the response refreshes the cookie. Repeat with Preferences accepted and an updated editor setting. Verify Reject All clears the cookie and deletes related data.
