import { describe, expect, it } from 'vitest';
import { estimatedBitsPerSecond, formatBandwidth, throughputLabel } from '../src/blackout/traffic-bandwidth';
import { createTrafficFeed } from '../src/blackout/traffic-model';

describe('Estimated game traffic bandwidth',()=>{
  it('converts transfer bytes per request and RPS into bits per second',()=>{
    expect(estimatedBitsPerSecond(1000,125000)).toBe(1_000_000_000);
    expect(formatBandwidth(1_000_000_000)).toBe('1.00 Gbps');
    expect(formatBandwidth(999_000_000_000)).toBe('999.00 Gbps');
    expect(formatBandwidth(1_000_000_000_000)).toBe('1.00 Tbps');
    expect(formatBandwidth(2_250_000_000_000)).toBe('2.25 Tbps');
  });
  it('treats RPS and throughput separately and rejects invalid values',()=>{
    expect(throughputLabel(1000,125000)).toBe('1.00 Gbps');
    expect(throughputLabel(1000,250000)).toBe('2.00 Gbps');
    expect(formatBandwidth(-55)).toBe('0.00 Gbps');
    expect(estimatedBitsPerSecond(Number.NaN,100)).toBe(0);
  });
  it('updates bandwidth from varied local request size samples',()=>{
    const feed=createTrafficFeed(3124);
    const observations:number[]=[];
    for(let tick=0;tick<200;tick++){
      const rps=feed.step({
        targetRps:45000,elapsed:tick*.1,health:80,proxies:1,burst:false,
      },.1);
      if(tick>10)observations.push(Math.round(estimatedBitsPerSecond(rps,feed.averageBytesPerRequest)/1e7));
    }
    expect(new Set(observations).size).toBeGreaterThan(15);
    expect(feed.recent.some(item=>item.bytes>0)).toBe(true);
  });
});
