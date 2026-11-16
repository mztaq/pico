# Pico incident archive setup

This uses the existing **pico-db** Cloudflare D1 database. It does not create a second database and does not change Pico visitor or usage tables.

Files:
- `migrations/0005_status_history.sql`: the two new D1 tables.
- `workers/pico-status-archive.js`: scheduled UptimeRobot collector.
- `functions/api/history.js`: read-only public archive API.
- `history.html`: full incident history at `/history`.
- `functions/api/status.js`: current health plus recent archived incidents when available.

## 1. Create tables in existing D1

1. Back up the existing `pico-db` database.
2. Cloudflare Dashboard → Storage & databases → D1 → `pico-db` → Console.
3. Run the SQL in `migrations/0005_status_history.sql`. It uses `IF NOT EXISTS` and leaves other tables unchanged.
4. Check that both tables exist:

```sql
SELECT name FROM sqlite_master WHERE type='table'
  AND name IN ('pico_status_incidents','pico_status_updates');
```

Do not put these tables in a different preview D1 if you want the public `status` deployment to display the same permanent records. Double-check the selected database before running SQL.

## 2. Give the status page read access to D1

1. Cloudflare → Workers & Pages → Pages project `picompiler` → Settings → Bindings.
2. Under **Preview**, add a D1 database binding.
3. Set variable name to `DB` and database to your existing `pico-db`.
4. Redeploy the `status` branch.
5. Check `https://status.picompiler.pages.dev/api/history`. It should return JSON with `"status":"ok"`. An empty incidents array is normal before outages are recorded.

**Security:** Preview bindings may be accessible to other deployed preview branches in this Pages project. Only give people trusted with `pico-db` access to change preview code. If you later want stricter separation, deploy a dedicated status Pages project and move history reads behind a restricted Worker.

## 3. Create the scheduled archival Worker

This is a **separate Worker**, not another database.

1. Cloudflare → Workers & Pages → Create → Worker → Start with Hello World.
2. Name it `pico-status-archive` and open its code editor.
3. Replace the starter code with the full contents of `workers/pico-status-archive.js` from the `status` GitHub branch, then Deploy.
4. In the Worker's Settings → Bindings, add a D1 binding called `DB`, selecting the existing `pico-db`.
5. In Settings → Variables and Secrets, add **encrypted secret** `UPTIMEROBOT_API_KEY` using your UptimeRobot read-only key. This Worker needs its own secret even though the Pico Pages project already has one. Do not commit or share the key.
6. In Settings → Triggers → Cron Triggers, add `*/5 * * * *`. Cloudflare runs it every 5 minutes in UTC.
7. Run a Cron Trigger test from Cloudflare if shown. Check Worker logs for `Pico incident archive checked 3 services`, or review the next scheduled execution. Do not use the public Worker URL to run a manual collection.

The Worker imports available UptimeRobot incidents from the past 89 days, then keeps storing new incidents as time passes. It deduplicates by UptimeRobot incident ID. It records an automatic detection update and a recovery update, but **does not invent root causes or claim your team has investigated the problem**.

## 4. Verify the records

```sql
SELECT id, service_id, started_at, resolved_at, status
FROM pico_status_incidents ORDER BY started_at DESC LIMIT 10;

SELECT incident_id, stage, message, published_at
FROM pico_status_updates ORDER BY published_at DESC LIMIT 10;
```

URLs:
- `https://status.picompiler.pages.dev/` — live status.
- `https://status.picompiler.pages.dev/history` — full incident archive.
- `https://status.picompiler.pages.dev/api/history` — read-only archive data.

If `/api/history` returns 503, confirm both the migration and the **Preview** D1 binding. If the scheduled Worker errors, inspect its logs and confirm the Worker's separate `DB` binding and `UPTIMEROBOT_API_KEY` secret.

UptimeRobot Free retains data for 3 months. This archive imports available incidents, not events from before monitoring started or data the provider already deleted. Cloudflare D1 records persist until manually deleted, subject to database availability, backups and retention management.

## 5. Operational limits

- Current monitor checks are normally 5 minutes apart. Short outages may not be captured.
- The archival Worker runs every 5 minutes, but UptimeRobot API responses and Cloudflare scheduling can lag.
- A failed API request does not create a false incident or delete previous ones.
- The first archive page returns 20 incidents and older pages load on demand.
- Records include only monitor IDs, times, incident text and status updates. They never contain Pico visitor data.
- Back up D1 periodically. Automated recovery and manual incident authoring are future upgrades, not included here.
