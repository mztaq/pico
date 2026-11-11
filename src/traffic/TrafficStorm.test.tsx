import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrafficStorm, formatTraffic, forwardedRequests, trafficRamp } from './TrafficStorm';

describe('Traffic Storm setup', () => {
  it('asks for a scenario on each new mount without displaying the old labels', () => {
    const html = renderToStaticMarkup(createElement(TrafficStorm, { onHome: () => {} }));
    expect(html).toContain('Traffic Storm');
    expect(html).toContain('Hacker name');
    expect(html).toContain('Botnet army size');
    expect(html).toContain('Server IP address');
    expect(html).toContain('Start simulation');
    expect(html).toContain('Reverse proxy protection');
    expect(html).toContain('No requests are sent to the IP');
    expect(html).not.toContain('NETWORK LAB');
    expect(html).not.toContain('LOCAL MODEL');
    expect(html).not.toContain('LIVE TRAFFIC VISUALIZATION');
  });

  it('formats modeled bandwidth in Gbps and Tbps', () => {
    expect(formatTraffic(0)).toBe('0.00 Gbps');
    expect(formatTraffic(5000)).toBe('1.28 Gbps');
    expect(formatTraffic(4_000_000)).toBe('1.02 Tbps');
  });

  it('eases synthetic traffic in gradually over 14 seconds', () => {
    expect(trafficRamp(-2)).toBeCloseTo(0.02);
    expect(trafficRamp(0)).toBeCloseTo(0.02);
    expect(trafficRamp(3)).toBeLessThan(trafficRamp(7));
    expect(trafficRamp(7)).toBeLessThan(trafficRamp(11));
    expect(trafficRamp(11)).toBeLessThan(trafficRamp(14));
    expect(trafficRamp(14)).toBeCloseTo(1);
    expect(trafficRamp(25)).toBeCloseTo(1);
  });

  it('filters 82 percent of requests only when protection is on', () => {
    expect(forwardedRequests(5000, false)).toBe(5000);
    expect(forwardedRequests(5000, true)).toBe(900);
    expect(forwardedRequests(0, true)).toBe(0);
  });
});
