// Read-only public incident archive from the existing Pico D1 database.
// Configure a Preview D1 binding named DB on the picompiler Pages project.
function respond(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=60, s-maxage=120' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequestGet(context) {
  const db = context.env.DB;
  if (!db) return respond({ status: 'not-configured', incidents: [], nextPage: null }, 503);
  const params = new URL(context.request.url).searchParams;
  const raw = params.get('page') ?? '1';
  if (!/^[1-9]\d{0,3}$/.test(raw)) return respond({ error: 'Invalid page' }, 400);
  const page = Number(raw);
  const perPage = 20;
  const offset = (page - 1) * perPage;
  try {
    const data = await db.prepare(
      "SELECT id, service_id, title, reason, started_at, resolved_at, status " +
      "FROM pico_status_incidents ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?"
    ).bind(perPage + 1, offset).all();
    const rows = data.results ?? [];
    const hasNext = rows.length > perPage;
    const current = rows.slice(0, perPage);
    const ids = current.map(row => row.id);
    let updates = [];
    if (ids.length) {
      const marks = ids.map(() => '?').join(',');
      const detail = await db.prepare(
        'SELECT incident_id, stage, message, published_at FROM pico_status_updates ' +
        'WHERE incident_id IN (' + marks + ') ORDER BY published_at ASC, id ASC'
      ).bind(...ids).all();
      updates = detail.results ?? [];
    }
    const items = current.map(row => ({
      id: row.id,
      service: ({website: 'Pico Website',mcp: 'Pico MCP',oauth: 'Pico OAuth'})[row.service_id] ?? 'Pico',
      title: row.title,
      reason: row.reason,
      startedAt: row.started_at,
      resolvedAt: row.resolved_at,
      status: row.status,
      updates: updates.filter(u => u.incident_id === row.id).map(u => ({
        stage: u.stage,
        message: u.message,
        publishedAt: u.published_at,
      })),
    }));
    return respond({ status: 'ok', incidents: items, nextPage: hasNext ? page + 1 : null });
  } catch (error) {
    console.error('Pico archive query failed', String(error));
    return respond({ status: 'unavailable', incidents: [], nextPage: null }, 503);
  }
}
