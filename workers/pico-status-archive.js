/**
 * Pico incident archive collector.
 * Cloudflare Worker cron: every 5 minutes. Bind the existing pico-db as DB
 * and set UPTIMEROBOT_API_KEY as an encrypted secret on THIS Worker.
 *
 * The collector imports monitored UptimeRobot incidents, not browser visits.
 * Writes are idempotent by UptimeRobot incident ID; no event is fabricated
 * when monitoring is unreachable. It requires migration 0005 first.
 */
const API = 'https://api.uptimerobot.com';
const SERVICES = [
  { id: 'website', name: 'Pico Website', urls: ['https://picompiler.pages.dev'] },
  { id: 'mcp', name: 'Pico MCP', urls: [
    'https://picompiler.pages.dev/.well-known/oauth-protected-resource/app/mcp',
    'https://picompiler.pages.dev/app/mcp',
  ] },
  { id: 'oauth', name: 'Pico OAuth', urls: [
    'https://pico-oauth.mztaq.workers.dev/.well-known/oauth-authorization-server',
    'https://pico-oauth.mztaq.workers.dev',
  ] },
];

function normalise(raw) {
  try {
    const url = new URL(raw);
    return (url.origin + url.pathname).replace(/\/+$/, '').toLowerCase();
  } catch { return ''; }
}

function time(value) {
  const numeric = (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value)))
    ? Number(value) : null;
  const valueMs = numeric === null ? Date.parse(value) : (numeric > 1e11 ? numeric : numeric * 1000);
  return Number.isFinite(valueMs) && valueMs > 0 ? new Date(valueMs).toISOString() : null;
}

function nameFor(monitor) {
  const url = normalise(monitor.url);
  const name = String(monitor.friendlyName ?? monitor.friendly_name ?? '').trim().toLowerCase();
  return SERVICES.find(service =>
    service.urls.some(candidate => normalise(candidate) === url) ||
    service.name.toLowerCase() === name
  ) ?? null;
}

async function request(path, apiKey) {
  const url = new URL(path, API);
  if (url.origin !== API || !url.pathname.startsWith('/v3/')) throw Error('Invalid monitoring API URL');
  const response = await fetch(url.href, {
    headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error('Monitoring API HTTP ' + response.status);
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw Error('Unexpected monitoring response');
  return payload;
}

async function pages(path, apiKey, maximumPages = 4) {
  let next = new URL(path, API).href;
  let results = [];
  const visited = new Set();
  for (let page = 0; page < maximumPages && next; page++) {
    if (visited.has(next)) throw Error('Repeated monitoring pagination link');
    visited.add(next);
    const data = await request(next, apiKey);
    results = results.concat(data.data);
    next = data.nextLink ? new URL(data.nextLink, next).href : null;
    if (next && page === maximumPages - 1) throw Error('Too many incident pages; increase pagination safely');
  }
  return results;
}

async function saveIncident(db, service, item) {
  const externalId = item?.id == null ? null : String(item.id);
  const started = time(item?.startedAt ?? item?.started_at);
  if (!externalId || !/^[0-9A-Za-z_-]{1,128}$/.test(externalId) || !started) return false;
  const resolved = time(item?.resolvedAt ?? item?.resolved_at);
  const reason = String(item?.reason ?? item?.description ?? 'Service interruption').slice(0, 300);
  const title = service.name + ' interruption';

  let existing = await db.prepare(
    "SELECT id, resolved_at FROM pico_status_incidents WHERE source = 'uptimerobot' AND external_id = ?"
  ).bind(externalId).first();

  if (!existing) {
    await db.prepare(
      "INSERT OR IGNORE INTO pico_status_incidents " +
      "(source, external_id, service_id, title, reason, started_at, resolved_at, status) " +
      "VALUES ('uptimerobot', ?, ?, ?, ?, ?, ?, ?)"
    ).bind(externalId, service.id, title, reason, started, resolved, resolved ? 'resolved' : 'investigating').run();
    existing = await db.prepare(
      "SELECT id, resolved_at FROM pico_status_incidents WHERE source = 'uptimerobot' AND external_id = ?"
    ).bind(externalId).first();
    if (!existing) throw Error('Unable to read saved incident');
  }

  const id = existing.id;
  await db.prepare(
    "INSERT OR IGNORE INTO pico_status_updates (incident_id, event_key, stage, message, published_at) " +
    "VALUES (?, 'detected', 'investigating', ?, ?)"
  ).bind(id, 'Monitoring detected an interruption.', started).run();

  if (resolved) {
    if (existing.resolved_at !== resolved) {
      await db.prepare(
        "UPDATE pico_status_incidents SET resolved_at = ?, status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(resolved, id).run();
    }
    await db.prepare(
      "INSERT OR IGNORE INTO pico_status_updates (incident_id, event_key, stage, message, published_at) " +
      "VALUES (?, 'resolved', 'resolved', ?, ?)"
    ).bind(id, 'Monitoring reported recovery.', resolved).run();
  }
  return true;
}

export async function collect(env) {
  if (!env.DB || !env.UPTIMEROBOT_API_KEY) throw Error('Missing D1 binding or UptimeRobot secret');
  const monitors = await pages('/v3/monitors?limit=200', env.UPTIMEROBOT_API_KEY, 2);
  const tracked = new Map();
  for (const monitor of monitors) {
    const service = nameFor(monitor);
    if (service && Number.isSafeInteger(Number(monitor.id)))
      tracked.set(String(monitor.id), service);
  }
  if (!tracked.size) throw Error('No Pico monitors matched');
  // Backfill the history still available from UptimeRobot at first deployment,
  // then keep archiving it permanently in D1.
  const after = new Date(Date.now() - 89 * 86400000).toISOString();
  const incidents = await pages(
    '/v3/incidents?limit=100&started_after=' + encodeURIComponent(after),
    env.UPTIMEROBOT_API_KEY, 4
  );
  let saved = 0;
  for (const incident of incidents) {
    const monitorId = incident?.monitor?.id ?? incident?.monitorId ?? incident?.monitor_id;
    const service = tracked.get(String(monitorId));
    if (service && await saveIncident(env.DB, service, incident)) saved++;
  }
  console.log('Pico incident archive checked', tracked.size, 'services and', saved, 'incident entries');
  return saved;
}

export default {
  async fetch() {
    return new Response('Not found', { status: 404 });
  },
  async scheduled(_event, env) {
    await collect(env);
  },
};
