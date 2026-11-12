import { describe, expect, it } from 'vitest';
import { createTrafficFeed } from '../src/blackout/traffic-model';

describe('Blackout Protocol bounded request simulation', () => {
  it('issues distinct request IDs with multiple paths, source IPs and response codes', () => {
    const feed = createTrafficFeed(123);
    const routes = new Set<string>();
    const ids = new Set<string>();
    const sources = new Set<string>();
    const statuses = new Set<number>();
    for (let tick = 0; tick < 500; tick++) {
      feed.step({
        targetRps: tick < 200 ? 9000 : 40000,
        elapsed: tick * 0.05, health: tick < 200 ? 100 : 32,
        proxies: tick < 200 ? 0 : 4, burst: tick >= 200,
      }, 0.05);
      for (const req of feed.recent) {
        routes.add(req.path);ids.add(req.id);sources.add(req.source);statuses.add(req.status);
      }
    }
    expect(ids.size).toBeGreaterThan(90);
    expect(routes.size).toBeGreaterThan(4);
    expect(sources.size).toBeGreaterThan(15);
    expect(statuses.size).toBeGreaterThanOrEqual(3);
    expect(feed.recent.length).toBeLessThanOrEqual(18);
    expect(feed.recent.every(v=>v.bytes>0)).toBe(true);
    expect(feed.averageBytesPerRequest).toBeGreaterThan(0);
  });
  it('updates rates over time rather than returning hardcoded constant traffic', () => {
    const feed = createTrafficFeed(456);
    const rates: number[] = [];
    for (let i = 0; i < 120; i++) {
      const rps = feed.step({targetRps: 12000, elapsed: i * 0.1, health: 100, proxies: 0, burst: false}, 0.1);
      if (i > 8) rates.push(Math.round(rps));
    }
    expect(new Set(rates).size).toBeGreaterThan(15);
    expect(Math.min(...rates)).toBeGreaterThan(1000);
    expect(Number.isFinite(feed.averageBytesPerRequest)).toBe(true);
  });
});
