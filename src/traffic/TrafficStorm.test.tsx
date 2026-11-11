import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrafficStorm, HIGH_TRAFFIC_THRESHOLD_GBPS, EFFECT_GAIN_MULTIPLIER, EFFECT_GAIN_CAP, FAN_NOISE_GAIN_MULTIPLIER, FAN_BLADE_ANGLES, SERVER_FAN_Y_OFFSET, SERVER_RACK_Y_OFFSET, botLanePath, botnetHeadingY, coolingFanDemand, deliveredTrafficRps, deliverySoundIntervalMs, deviceHeading, effectGain, generateDemoIp, effectiveProxyFilterRatio, formatTraffic, forwardedRequests, hackerCommandPath, isHighTraffic, nextFanSpeed, nodeLoadRatio, normalizeBotArmy, proxyFilterRatio, proxyHeadingY, proxyLoadRatio, relayLanePath, sanitizeHackerName, serverPressure, trafficRamp, trafficSpikeFactor, validateHackerName, visualSurvivorCount, webserverHeadingY, webserverPositions } from './TrafficStorm';

describe('Traffic Storm setup', () => {
  it('asks for a scenario on each new mount without displaying the old labels', () => {
    const html = renderToStaticMarkup(createElement(TrafficStorm, { onHome: () => {} }));
    expect(html).toContain('Traffic Storm');
    expect(html).toContain('Hacker name');
    expect(html).toContain('Enter simulation');
    expect(html).toContain('Letters and spaces only');
    expect(html).toContain('maxLength="24"');
    expect(html).toContain('No real traffic is sent.');
    expect(html).not.toContain('Botnet army size');
    expect(html).not.toContain('Generated server IP');
    expect(html).not.toContain('Generate IP');
    expect(html).not.toContain('Start simulation');
    expect(html).not.toContain('Add web server');
    expect(html).not.toContain('Add defensive proxy');
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain('NETWORK LAB');
    expect(html).not.toContain('LOCAL MODEL');
    expect(html).not.toContain('LIVE TRAFFIC VISUALIZATION');
    expect(html).not.toContain('storm-ping-activity');
  });

  it('filters digits, emoji and symbols from hacker names', () => {
    expect(sanitizeHackerName('Amar123!')).toBe('Amar');
    expect(sanitizeHackerName('  Muhammad  Mustaqim ')).toBe('Muhammad Mustaqim ');
    expect(sanitizeHackerName('Alex_99!')).toBe('Alex');
    expect(sanitizeHackerName('Élodie')).toBe('Élodie');
    expect(sanitizeHackerName('A'.repeat(30))).toHaveLength(24);
    expect(sanitizeHackerName('🧠')).toBe('');
  });

  it('requires a sensible 2–24 character letters-only hacker name', () => {
    expect(validateHackerName('Amar')).toBeNull();
    expect(validateHackerName('Muhammad Mustaqim')).toBeNull();
    expect(validateHackerName('Élodie')).toBeNull();
    expect(validateHackerName('')).toBeTruthy();
    expect(validateHackerName('A')).toBeTruthy();
    expect(validateHackerName('1234')).toBeTruthy();
    expect(validateHackerName('Amar99')).toBeTruthy();
    expect(validateHackerName('Amar!')).toBeTruthy();
    expect(validateHackerName('A'.repeat(25))).toBeTruthy();
  });

  it('sounds a successful delivery chime only for modeled delivered groups, at a bounded cadence', () => {
    expect(deliverySoundIntervalMs(0)).toBeNull();
    expect(deliverySoundIntervalMs(-3)).toBeNull();
    expect(deliverySoundIntervalMs(Number.NaN)).toBeNull();
    expect(deliverySoundIntervalMs(1)).toBe(760);
    expect(deliverySoundIntervalMs(2500)).toBe(650);
    expect(deliverySoundIntervalMs(10000)).toBe(320);
    expect(deliverySoundIntervalMs(10000000)).toBe(320);
    expect(deliveredTrafficRps(5000, 2, true)).toBe(0);
    expect(deliveredTrafficRps(5000, 2, false)).toBeGreaterThan(0);
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

  it('places BOTNET above the first bot icon without an excessive gap', () => {
    expect(botnetHeadingY()).toBe(45);
    expect(92 - 29 - botnetHeadingY()).toBe(18);
  });

  it('moves PROXY/PROXIES close to the first proxy for every node count', () => {
    expect(proxyHeadingY(1)).toBeCloseTo(210.5);
    expect(proxyHeadingY(2)).toBeCloseTo(143);
    expect(proxyHeadingY(3)).toBeCloseTo(109.25);
    expect(proxyHeadingY(4)).toBeCloseTo(89);
    expect(proxyHeadingY(1)).toBeGreaterThan(proxyHeadingY(4));
  });

  it('keeps the webserver heading near its first rack for one to four servers', () => {
    expect(webserverHeadingY(1)).toBeCloseTo(177.5);
    expect(webserverHeadingY(2)).toBeCloseTo(127.5);
    expect(webserverHeadingY(3)).toBeCloseTo(77.5);
    expect(webserverHeadingY(4)).toBeCloseTo(27.5);
    expect(webserverHeadingY(1)).toBeGreaterThan(webserverHeadingY(4));
  });

  it('spaces all four server racks apart and keeps them inside the SVG', () => {
    expect(webserverPositions(1)).toEqual([232.5]);
    expect(webserverPositions(2)).toEqual([182.5, 282.5]);
    const centers = webserverPositions(4);
    expect(centers).toEqual([82.5, 182.5, 282.5, 382.5]);
    expect(centers[0] - 37).toBeGreaterThan(0);
    expect(centers[3] + 37).toBeLessThan(465);
    centers.slice(1).forEach((center, index) => {
      expect(center - centers[index] - 74).toBeGreaterThanOrEqual(26);
    });
  });

  it('connects hacker commands to each bot along its visible curve', () => {
    const ends = [92, 190, 288, 386];
    ends.forEach((botY, index) => {
      const path = hackerCommandPath(index);
      expect(path.startsWith('M 215 251 C ')).toBe(true);
      expect(path.endsWith('350 ' + botY)).toBe(true);
      expect(path).not.toMatch(/(?:NaN|undefined|null)/);
    });
  });

  it('creates irregular traffic bursts rather than a constant or smooth line', () => {
    expect(trafficSpikeFactor(-2)).toBeCloseTo(0.9);
    expect(trafficSpikeFactor(0)).toBeCloseTo(0.9);
    expect(trafficSpikeFactor(0.25)).toBeGreaterThan(trafficSpikeFactor(0.5));
    expect(trafficSpikeFactor(1.3)).toBeGreaterThanOrEqual(0.9);
    expect(trafficSpikeFactor(2)).toBeLessThanOrEqual(1.35);
  });

  it('shows the high-traffic warning only at or above 100 Gbps', () => {
    expect(HIGH_TRAFFIC_THRESHOLD_GBPS).toBe(100);
    expect(isHighTraffic(0)).toBe(false);
    expect(isHighTraffic(23841)).toBe(false);
    expect(isHighTraffic(23842)).toBe(true);
    expect(isHighTraffic(48000)).toBe(true);
    expect(isHighTraffic(-1)).toBe(false);
    expect(isHighTraffic(Number.NaN)).toBe(false);
  });

  it('shows offline webserver delivery as zero while keeping attack and proxy loads', () => {
    const incoming = 320_000;
    expect(deliveredTrafficRps(incoming, 4, true)).toBe(0);
    expect(formatTraffic(deliveredTrafficRps(incoming, 4, true))).toBe('0.00 Gbps');
    expect(deliveredTrafficRps(incoming, 4, false)).toBe(forwardedRequests(incoming, 4));
    expect(proxyLoadRatio(incoming, 4)).toBeGreaterThan(1);
    expect(isHighTraffic(incoming)).toBe(true);
  });

  it('positions the webserver fans above the bay region', () => {
    expect(SERVER_FAN_Y_OFFSET).toBeLessThan(SERVER_RACK_Y_OFFSET);
    expect(SERVER_FAN_Y_OFFSET + 11.5).toBeLessThan(SERVER_RACK_Y_OFFSET);
    expect(FAN_BLADE_ANGLES).toHaveLength(5);
  });

  it('uses five evenly-spaced blades for each webserver fan', () => {
    expect(FAN_BLADE_ANGLES).toEqual([0, 72, 144, 216, 288]);
    expect(new Set(FAN_BLADE_ANGLES).size).toBe(5);
  });

  it('clamps and rounds live bot army slider values to valid 100-bot steps', () => {
    expect(normalizeBotArmy(-20)).toBe(100);
    expect(normalizeBotArmy(100)).toBe(100);
    expect(normalizeBotArmy(1000)).toBe(1000);
    expect(normalizeBotArmy(2999)).toBe(3000);
    expect(normalizeBotArmy(19999)).toBe(20000);
    expect(normalizeBotArmy(20001)).toBe(20000);
    expect(normalizeBotArmy(Number.NaN)).toBe(100);
  });

  it('links the visible army slider to the same synthetic count used for traffic', () => {
    const lowRps = normalizeBotArmy(2000) * 16;
    const highRps = normalizeBotArmy(10000) * 16;
    expect(highRps).toBeGreaterThan(lowRps);
    expect(serverPressure(highRps, 0, 1)).toBeGreaterThan(serverPressure(lowRps, 0, 1));
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

  it('raises simulation effect loudness while capping each oscillator gain', () => {
    expect(EFFECT_GAIN_MULTIPLIER).toBe(3);
    expect(EFFECT_GAIN_CAP).toBe(0.18);
    expect(FAN_NOISE_GAIN_MULTIPLIER).toBeGreaterThan(1);
    expect(effectGain(0.016)).toBeCloseTo(0.048);
    expect(effectGain(0.045)).toBeCloseTo(0.135);
    expect(effectGain(0.082)).toBeCloseTo(EFFECT_GAIN_CAP);
    expect(effectGain(100)).toBe(EFFECT_GAIN_CAP);
    expect(effectGain(-5)).toBe(0);
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

    expect(incoming.startsWith('M 450 92 C ')).toBe(true);
    expect(incoming.endsWith('710 260')).toBe(true);
    expect(accepted.startsWith('M 790 260 C ')).toBe(true);
    expect(accepted.endsWith('990 220')).toBe(true);
    expect(direct.endsWith('990 220')).toBe(true);
    for (const path of [incoming, accepted, direct]) {
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
