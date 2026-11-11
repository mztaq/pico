import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrafficStorm, effectiveProxyFilterRatio, formatTraffic, forwardedRequests, modeledPing, nextFanSpeed, proxyFilterRatio, proxyLoadRatio, serverPressure, trafficRamp } from './TrafficStorm';

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

});
