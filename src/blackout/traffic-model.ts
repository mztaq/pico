export interface TrafficRequest {
  id: string;
  at: number;
  source: string;
  method: 'GET' | 'POST';
  path: string;
  status: 200 | 201 | 429 | 503;
  latency: number;
}

export interface TrafficSnapshot {
  targetRps: number;
  elapsed: number;
  health: number;
  proxies: number;
  burst: boolean;
}

const routes = [
  {path: '/api/catalog', method: 'GET' as const},
  {path: '/api/search', method: 'GET' as const},
  {path: '/api/session', method: 'POST' as const},
  {path: '/account', method: 'GET' as const},
  {path: '/api/orders', method: 'POST' as const},
  {path: '/assets/ui.css', method: 'GET' as const},
  {path: '/api/health', method: 'GET' as const},
  {path: '/dashboard', method: 'GET' as const},
];
const randomSource = (value: number): string => {
  const net = value < 0.33 ? '192.0.2.' : value < 0.66 ? '198.51.100.' : '203.0.113.';
  return net + (1 + Math.floor((value * 977.71 % 1) * 253));
};

/** A bounded traffic-event sampler. It never performs network I/O.
 * Its representative request records use unique IDs, diverse endpoints and
 * status outcomes. Sampled records are not actual outbound requests.
 */
export function createTrafficFeed(seed = 0x19860614) {
  let state = (seed >>> 0) || 1;
  let sequence = 0;
  let eventClock = 0;
  let rateClock = 0;
  let rate = 0;
  let drift = 0;
  const recent: TrafficRequest[] = [];
  function random() {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }
  function step(snapshot: TrafficSnapshot, dt: number): number {
    const delta = Math.max(0, Math.min(dt, 0.1));
    rateClock += delta;
    eventClock += delta;
    while (rateClock >= 0.32) {
      rateClock -= 0.32;
      drift = drift * 0.58 + (random() - 0.5) * 0.32;
      const wave = Math.sin(snapshot.elapsed * 0.36 + seed * 0.00001) * 0.05 +
        Math.sin(snapshot.elapsed * 1.09) * 0.025;
      const next = Math.max(0, snapshot.targetRps * (1 + drift + wave));
      rate = rate === 0 ? next : rate * 0.58 + next * 0.42;
    }
    while (eventClock >= 0.26) {
      eventClock -= 0.26;
      const n = 2 + Math.floor(random() * 4);
      for (let i = 0; i < n; i++) {
        const route = routes[Math.floor(random() * routes.length)];
        const chance = random();
        const overloaded = snapshot.health < 55 || snapshot.burst;
        const status: TrafficRequest['status'] = chance < (overloaded ? 0.18 : 0.025)
          ? 503 : chance < (snapshot.proxies > 0 ? 0.30 : 0.04)
            ? 429 : route.method === 'POST' ? 201 : 200;
        const request: TrafficRequest = {
          id: (sequence++).toString(36).toUpperCase().padStart(7, '0'),
          at: snapshot.elapsed,
          source: randomSource(random()),
          method: route.method,
          path: route.path,
          status,
          latency: Math.round(17 + random() * 170 + (overloaded ? random() * 560 : 0)),
        };
        recent.push(request);
        if (recent.length > 18) recent.shift();
      }
    }
    return rate;
  }
  return {step, recent};
}
