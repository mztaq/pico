// Cloudflare Pages Function for the public Pico status site.
// Set UPTIMEROBOT_API_KEY as a Preview-environment secret. Never put it in the HTML.
// All fields returned here are public, deliberately limited to Pico monitors.
const SERVICES = [
  { id: "website", name: "Pico Website", target: "https://picompiler.pages.dev" },
  { id: "mcp", name: "Pico MCP", target: "https://picompiler.pages.dev/app/mcp" },
  { id: "oauth", name: "Pico OAuth", target: "https://pico-oauth.mztaq.workers.dev" },
];

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function normalise(url) {
  try {
    const parsed = new URL(url);
    return (parsed.origin + parsed.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function statusOf(monitor) {
  const value = String(monitor?.status ?? "").toUpperCase();
  if (value === "UP") return "operational";
  if (value === "DOWN") return "outage";
  if (value === "LOOKS_DOWN") return "degraded";
  return "unknown";
}

function findMonitor(monitors, service) {
  const exact = monitors.find((monitor) => normalise(monitor.url) === normalise(service.target));
  if (exact) return exact;
  const words = {
    website: ["pico website", "pico homepage"],
    mcp: ["pico mcp", "pico api"],
    oauth: ["pico oauth", "pico authentication"],
  };
  return monitors.find((monitor) => words[service.id].some((name) => String(monitor.friendlyName ?? "").toLowerCase() === name)) ?? null;
}

function pickPercent(data) {
  const uptime = data && typeof data === "object" ? data.uptime : null;
  return typeof uptime === "number" && Number.isFinite(uptime) && uptime >= 0 && uptime <= 100
    ? Math.round(uptime * 100) / 100
    : null;
}

async function fetchUptime(url, key) {
  const reply = await fetch(url, {
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!reply.ok) throw new Error("UptimeRobot API returned " + reply.status);
  return reply.json();
}

export async function onRequestGet(context) {
  const key = context.env.UPTIMEROBOT_API_KEY;
  if (!key) {
    return response({
      state: "unconfigured",
      updatedAt: null,
      services: SERVICES.map((service) => ({ ...service, status: "unknown", uptime24h: null, uptime30d: null })),
      incidents: [],
    });
  }

  // Cache successful responses at the Cloudflare edge. The UptimeRobot Free API
  // is rate-limited, so browser polling must not call it for each visitor.
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/status", context.request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const monitorsReply = await fetchUptime("https://api.uptimerobot.com/v3/monitors?limit=50", key);
    if (!Array.isArray(monitorsReply?.data)) throw new Error("Unexpected monitor response");
    const monitors = monitorsReply.data;
    const services = SERVICES.map((service) => {
      const monitor = findMonitor(monitors, service);
      return {
        ...service,
        monitorId: monitor?.id ?? null,
        status: monitor ? statusOf(monitor) : "unknown",
        uptime24h: null,
        uptime30d: null,
      };
    });
    const matched = services.filter((service) => Number.isSafeInteger(service.monitorId) && service.monitorId > 0);

    const now = new Date();
    const to = now.toISOString();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const requests = matched.flatMap((service) => [
      { service, key: "uptime24h", url: "https://api.uptimerobot.com/v3/monitors/" + service.monitorId + "/stats/uptime?from=" + encodeURIComponent(h24) + "&to=" + encodeURIComponent(to) },
      { service, key: "uptime30d", url: "https://api.uptimerobot.com/v3/monitors/" + service.monitorId + "/stats/uptime?from=" + encodeURIComponent(d30) + "&to=" + encodeURIComponent(to) },
    ]);
    const results = await Promise.allSettled([
      ...requests.map((entry) => fetchUptime(entry.url, key)),
    ]);
    requests.forEach((entry, index) => {
      const result = results[index];
      if (result.status === "fulfilled") entry.service[entry.key] = pickPercent(result.value);
    });

    // UptimeRobot v3 does not expose a general incident-history endpoint here.
    // Keep this distinct from a verified empty incident history.
    const incidents = null;

    const body = {
      state: matched.length ? "connected" : "no-monitors",
      updatedAt: now.toISOString(),
      services: services.map(({ monitorId, ...service }) => service),
      incidents,
    };
    const result = response(body);
    context.waitUntil(cache.put(cacheKey, result.clone()));
    return result;
  } catch {
    return response({ state: "unavailable", updatedAt: null, services: [], incidents: null }, 503);
  }
}
