import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrafficStorm, appendPingHistory, botLanePath, effectiveProxyFilterRatio, formatTraffic, forwardedRequests, modeledPing, nextFanSpeed, nodeLoadRatio, proxyFilterRatio, proxyLoadRatio, realUserLanePath, relayLanePath, serverPressure, trafficRamp, visualSurvivorCount, type PingEntry } from './TrafficStorm';

describe('Traffic Storm setup', () => {
  it('asks for a scenario on each new mount without displaying the old labels', () => {
    const html = renderToStaticMarkup(createElement(TrafficStorm, { onHome: () => {} }));
    expect(html).toContain('Traffic Storm');
    expect(html).toContain('Hacker name');
    expect(html).toContain('Botnet army size');
    expect(html).toContain('Server IP address');
    expect(html).toContain('Start simulation');
    expect(html).toContain('Web servers');
    expect(html).toContain('Defensive proxies');
    expect(html).toContain('Add web server');
    expect(html).toContain('Add defensive proxy');
    expect(html).toContain('No requests are sent to the IP');
    expect(html).not.toContain('NETWORK LAB');
    expect(html).not.toContain('LOCAL MODEL');
    expect(html).not.toContain('LIVE TRAFFIC VISUALIZATION');
  });

  it('formats modeled bandwidth in Gbps and Tbps', () => {
    expect(formatTraffic(0)).toBe('0.00 Gbps');
    expect(formatTraffic(5000)).toBe('20.97 Gbps');
    expect(formatTraffic(4_000_000)).toBe('16.78 Tbps');
  });

  it('eases synthetic traffic in gradually over 16 seconds', () => {
    expect(trafficRamp(-2)).toBeCloseTo(0.003);
    expect(trafficRamp(0)).toBeCloseTo(0.003);
    expect(trafficRamp(3)).toBeLessThan(trafficRamp(7));
    expect(trafficRamp(7)).toBeLessThan(trafficRamp(11));
    expect(trafficRamp(11)).toBeLessThan(trafficRamp(14));
    expect(trafficRamp(14)).toBeLessThan(trafficRamp(16));
    expect(trafficRamp(16)).toBeCloseTo(1);
    expect(trafficRamp(25)).toBeCloseTo(1);
  });

  it('models stronger proxies that saturate under excessive traffic', () => {
    expect(proxyFilterRatio(0)).toBe(0);
    expect(proxyFilterRatio(1)).toBeCloseTo(0.86);
    expect(proxyFilterRatio(2)).toBeCloseTo(0.92);
    expect(proxyFilterRatio(3)).toBeCloseTo(0.95);
    expect(proxyFilterRatio(4)).toBeCloseTo(0.97);
    expect(forwardedRequests(5000, 0)).toBe(5000);
    expect(forwardedRequests(5000, 1)).toBe(700);
    expect(forwardedRequests(5000, 2)).toBe(400);
    expect(forwardedRequests(5000, 4)).toBe(150);
    expect(forwardedRequests(0, 4)).toBe(0);
    expect(proxyLoadRatio(240000, 1)).toBeCloseTo(2.4);
    expect(proxyLoadRatio(240000, 4)).toBeCloseTo(0.6);
    expect(effectiveProxyFilterRatio(240000, 1)).toBeLessThan(proxyFilterRatio(1));
    expect(effectiveProxyFilterRatio(240000, 4)).toBeCloseTo(proxyFilterRatio(4));
    expect(forwardedRequests(240000, 1)).toBeGreaterThan(forwardedRequests(240000, 4));
  });

  it('starts fans slowly and winds them down rather than stopping instantly', () => {
    const startup = nextFanSpeed(0, 1, 0.05);
    expect(startup).toBeGreaterThan(0);
    expect(startup).toBeLessThan(0.1);
    const deceleration = nextFanSpeed(1, 0, 0.05);
    expect(deceleration).toBeGreaterThan(0.9);
    expect(deceleration).toBeLessThan(1);
    let slow = 1;
    for (let i = 0; i < 1000; i += 1) slow = nextFanSpeed(slow, 0, 0.05);
    expect(slow).toBe(0);
  });

  it('shares traffic across 1–4 fictional web servers', () => {
    expect(serverPressure(48_000, 0, 1)).toBe(15);
    expect(serverPressure(48_000, 0, 4)).toBe(3.75);
    expect(serverPressure(48_000, 4, 4)).toBeLessThan(1);
    expect(serverPressure(48_000, 4, 5)).toBe(serverPressure(48_000, 4, 4));
  });

  it('reports synthetic ping latency or timeout without contacting any address', () => {
    expect(modeledPing('203.0.113.10', 43)).toContain('43 ms (simulation)');
    expect(modeledPing('203.0.113.10', 520)).toContain('520 ms (simulation)');
    expect(modeledPing('203.0.113.10', null)).toContain('Request timed out');
  });

  it('shows separate loads for every web server and proxy node', () => {
    const serverLoads = [0, 1, 2, 3].map(index => nodeLoadRatio(16000, 4, index, 3200));
    const proxyLoads = [0, 1, 2, 3].map(index => nodeLoadRatio(240000, 4, index, 100000));
    expect(serverLoads.reduce((total, load) => total + load, 0)).toBeCloseTo(5);
    expect(proxyLoads.reduce((total, load) => total + load, 0)).toBeCloseTo(2.4);
    expect(new Set(serverLoads.map(load => load.toFixed(4))).size).toBeGreaterThan(1);
    expect(nodeLoadRatio(100, 4, 4, 100)).toBe(0);
  });

  it('uses exact connected path endpoints for incoming and filtered request packets', () => {
    const incoming = botLanePath(0, 220, 260);
    const accepted = relayLanePath(260, 220);
    const direct = botLanePath(0, 220, null);
    const realUser = realUserLanePath(220, 260);

    expect(incoming.startsWith('M 450 88 C ')).toBe(true);
    expect(incoming.endsWith('710 260')).toBe(true);
    expect(accepted.startsWith('M 790 260 C ')).toBe(true);
    expect(accepted.endsWith('990 220')).toBe(true);
    expect(direct.endsWith('990 220')).toBe(true);
    expect(realUser.startsWith('M 450 407 C ')).toBe(true);
    expect(realUser.endsWith('710 260')).toBe(true);
    for (const path of [incoming, accepted, direct, realUser]) {
      expect(path).not.toMatch(/(?:NaN|undefined|null)/);
    }
  });

  it('shows representative accepted traffic on all four outgoing paths even at 97% filtering', () => {
    expect(visualSurvivorCount(16, 0.97, 4)).toBe(4);
    expect(visualSurvivorCount(16, 0.86, 4)).toBeGreaterThanOrEqual(4);
    expect(visualSurvivorCount(16, 0.2, 4)).toBeLessThanOrEqual(8);
    expect(visualSurvivorCount(2, 0.97, 4)).toBe(2);
    expect(visualSurvivorCount(0, 0.97, 4)).toBe(0);
    expect(visualSurvivorCount(16, 0.97, 0)).toBe(0);
  });

  it('provides a valid curve for each server with two proxies and four servers', () => {
    const sources = [0, 1, 2, 3];
    const proxies = [195, 330];
    const servers = [141, 222, 303, 384];
    const paths = sources.map(index => relayLanePath(proxies[index % 2], servers[index]));
    expect(new Set(paths).size).toBe(4);
    paths.forEach((path, index) => {
      expect(path.startsWith('M 790 ' + proxies[index % 2])).toBe(true);
      expect(path.endsWith('990 ' + servers[index])).toBe(true);
    });
  });

  it('keeps unique rolling ping replies so the latest response animates as a new row', () => {
    let entries: PingEntry[] = [];
    for (let id = 1; id <= 14; id += 1) {
      entries = appendPingHistory(entries, { id, latency: id * 10, text: 'Reply ' + id });
    }
    expect(entries).toHaveLength(10);
    expect(entries[0]).toEqual({ id: 5, latency: 50, text: 'Reply 5' });
    expect(entries[9]).toEqual({ id: 14, latency: 140, text: 'Reply 14' });
    expect(new Set(entries.map(entry => entry.id)).size).toBe(10);
    const timeouts = appendPingHistory(entries, { id: 15, latency: null, text: 'Request timed out.' });
    expect(timeouts[timeouts.length - 1].latency).toBeNull();
    expect(timeouts).toHaveLength(10);
  });

});
