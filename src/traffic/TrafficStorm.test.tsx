import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrafficStorm, botLanePath, coolingFanDemand, deviceHeading, generateDemoIp, effectiveProxyFilterRatio, formatTraffic, forwardedRequests, nextFanSpeed, nodeLoadRatio, proxyFilterRatio, proxyLoadRatio, realUserLanePath, relayLanePath, serverPressure, trafficRamp, trafficSpikeFactor, visualSurvivorCount } from './TrafficStorm';

describe('Traffic Storm setup', () => {
  it('asks for a scenario on each new mount without displaying the old labels', () => {
    const html = renderToStaticMarkup(createElement(TrafficStorm, { onHome: () => {} }));
    expect(html).toContain('Traffic Storm');
    expect(html).toContain('Hacker name');
    expect(html).toContain('Botnet army size');
    expect(html).toContain('Generated server IP');
    expect(html).toContain('Generate IP');
    expect(html).toContain('readOnly=""');
    expect(html).not.toContain('placeholder="203.0.113.10"');
    expect(html).toContain('Start simulation');
    expect(html).toContain('Web servers');
    expect(html).toContain('Defensive proxies');
    expect(html).toContain('Add web server');
    expect(html).toContain('Add defensive proxy');
    expect(html).toContain('No requests are sent to the IP');
    expect(html).not.toContain('NETWORK LAB');
    expect(html).not.toContain('LOCAL MODEL');
    expect(html).not.toContain('LIVE TRAFFIC VISUALIZATION');
    expect(html).not.toContain('storm-ping-activity');
  });

  it('generates only reserved documentation IP addresses without manual entry', () => {
    expect(generateDemoIp(() => 0)).toBe('192.0.2.1');
    expect(generateDemoIp(() => 0.5)).toBe('198.51.100.128');
    expect(generateDemoIp(() => 0.999999)).toBe('203.0.113.254');
    for (const sample of [0, 0.1, 0.34, 0.55, 0.67, 0.99, 1, -1]) {
      const ip = generateDemoIp(() => sample);
      expect(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.(?:[1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(ip)).toBe(true);
    }
  });

  it('uses singular and plural headings without counts for network nodes', () => {
    expect(deviceHeading('WEBSERVER', 'WEBSERVERS', 1)).toBe('WEBSERVER');
    expect(deviceHeading('WEBSERVER', 'WEBSERVERS', 4)).toBe('WEBSERVERS');
    expect(deviceHeading('PROXY', 'PROXIES', 1)).toBe('PROXY');
    expect(deviceHeading('PROXY', 'PROXIES', 2)).toBe('PROXIES');
  });

  it('creates irregular traffic bursts rather than a constant or smooth line', () => {
    expect(trafficSpikeFactor(-2)).toBeCloseTo(0.9);
    expect(trafficSpikeFactor(0)).toBeCloseTo(0.9);
    expect(trafficSpikeFactor(0.25)).toBeGreaterThan(trafficSpikeFactor(0.5));
    expect(trafficSpikeFactor(1.3)).toBeGreaterThanOrEqual(0.9);
    expect(trafficSpikeFactor(2)).toBeLessThanOrEqual(1.35);
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
    expect(proxyLoadRatio(240000, 1)).toBeCloseTo(4);
    expect(proxyLoadRatio(240000, 4)).toBeCloseTo(1);
    expect(effectiveProxyFilterRatio(240000, 1)).toBeLessThan(proxyFilterRatio(1));
    expect(effectiveProxyFilterRatio(240000, 4)).toBeCloseTo(proxyFilterRatio(4));
    expect(forwardedRequests(240000, 1)).toBeGreaterThan(forwardedRequests(240000, 4));
  });

  it('starts the fan immediately at an audible and visible idle speed before heavy load', () => {
    expect(coolingFanDemand(0, true)).toBeCloseTo(0.34);
    expect(coolingFanDemand(14, true)).toBeCloseTo(0.34);
    expect(coolingFanDemand(70, true)).toBeCloseTo(0.7);
    expect(coolingFanDemand(100, true)).toBe(1);
    expect(coolingFanDemand(100, false)).toBe(0);
    const startup = nextFanSpeed(0, coolingFanDemand(14, true), 0.05);
    expect(startup).toBeGreaterThan(0.01);
    expect(startup).toBeLessThan(0.1);
  });

  it('max 20,000-bot scenario overwhelms all four proxy servers and four web servers', () => {
    const peakRps = 20_000 * 16;
    const totalWebServerCapacity = 4 * 3200;
    expect(proxyLoadRatio(peakRps, 4)).toBeGreaterThan(1);
    expect(effectiveProxyFilterRatio(peakRps, 4)).toBeLessThan(proxyFilterRatio(4));
    expect(forwardedRequests(peakRps, 4)).toBeGreaterThan(totalWebServerCapacity);
    expect(serverPressure(peakRps, 4, 4)).toBeGreaterThan(2);
    // The overload is robust to the model's small peak traffic variation.
    expect(serverPressure(peakRps * 0.9, 4, 4)).toBeGreaterThan(1);
    // A smaller botnet may still be protected by all four edges.
    expect(serverPressure(10_000 * 16, 4, 4)).toBeLessThan(1);
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

  it('shows separate loads for every web server and proxy node', () => {
    const serverLoads = [0, 1, 2, 3].map(index => nodeLoadRatio(16000, 4, index, 3200));
    const proxyLoads = [0, 1, 2, 3].map(index => nodeLoadRatio(240000, 4, index, 60000));
    expect(serverLoads.reduce((total, load) => total + load, 0)).toBeCloseTo(5);
    expect(proxyLoads.reduce((total, load) => total + load, 0)).toBeCloseTo(4);
    expect(new Set(serverLoads.map(load => load.toFixed(4))).size).toBeGreaterThan(1);
    expect(nodeLoadRatio(100, 4, 4, 100)).toBe(0);
  });

  it('uses exact connected path endpoints for incoming and filtered request packets', () => {
    const incoming = botLanePath(0, 220, 260);
    const accepted = relayLanePath(260, 220);
    const direct = botLanePath(0, 220, null);
    const realUser = realUserLanePath(220, 260);

    expect(incoming.startsWith('M 450 92 C ')).toBe(true);
    expect(incoming.endsWith('710 260')).toBe(true);
    expect(accepted.startsWith('M 790 260 C ')).toBe(true);
    expect(accepted.endsWith('990 220')).toBe(true);
    expect(direct.endsWith('990 220')).toBe(true);
    expect(realUser.startsWith('M 450 470 C ')).toBe(true);
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


});
