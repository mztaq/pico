import {describe, expect, it} from 'vitest';
import {
  ATTACK_TRAFFIC_SCALE, DEFENSE_WAVE_SCALE,
  poweredProxyCount, firstUnpoweredProxy, nearestPoweredProxy,
} from '../src/blackout/proxy-mechanics';

const proxy = (x:number,z:number,powered:boolean)=>({
  position:{x,z},userData:{powered},
});

describe('Blackout Protocol proxy sabotage and incident intensity',()=>{
  it('makes simulated traffic surges materially stronger without sending requests',()=>{
    expect(ATTACK_TRAFFIC_SCALE).toBeGreaterThan(1);
    expect(DEFENSE_WAVE_SCALE).toBeGreaterThan(1);
    expect(ATTACK_TRAFFIC_SCALE).toBeLessThan(2);
    expect(DEFENSE_WAVE_SCALE).toBeLessThan(2);
    expect(ATTACK_TRAFFIC_SCALE).toBeCloseTo(1.25);
    expect(DEFENSE_WAVE_SCALE).toBeCloseTo(1.45);
  });
  it('counts only powered edge proxy cabinets',()=>{
    const proxies=[proxy(2,1,true),proxy(5,1,false),proxy(8,1,true)];
    expect(poweredProxyCount(proxies)).toBe(2);
    proxies[0].userData.powered=false;
    expect(poweredProxyCount(proxies)).toBe(1);
    expect(firstUnpoweredProxy(proxies)).toBe(0);
    proxies[0].userData.powered=true;
    proxies[1].userData.powered=true;
    expect(poweredProxyCount(proxies)).toBe(3);
    expect(firstUnpoweredProxy(proxies)).toBe(-1);
  });
  it('targets the nearest powered proxy for the defense hacker, ignoring offline cabinets',()=>{
    const proxies=[proxy(1,1,false),proxy(9,2,true),proxy(12,2,true)];
    expect(nearestPoweredProxy(proxies,{x:1,z:1})).toBe(1);
    proxies[1].userData.powered=false;
    expect(nearestPoweredProxy(proxies,{x:1,z:1})).toBe(2);
    proxies[2].userData.powered=false;
    expect(nearestPoweredProxy(proxies,{x:1,z:1})).toBe(-1);
  });
});
