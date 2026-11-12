/** Browser-only game balancing for the simulated network incident. */
export interface ProxyStatus { userData: { powered: boolean } }
export const ATTACK_TRAFFIC_SCALE = 1.25;
export const DEFENSE_WAVE_SCALE = 1.45;
export function poweredProxyCount(proxies: readonly ProxyStatus[]): number {
  return proxies.filter(proxy => proxy.userData.powered).length;
}
export function firstUnpoweredProxy(proxies: readonly ProxyStatus[]): number {
  return proxies.findIndex(proxy => !proxy.userData.powered);
}
export function nearestPoweredProxy(
  proxies: readonly (ProxyStatus & { position: {x:number; z:number} })[],
  from: {x:number; z:number},
): number {
  let nearest=-1, distance=Infinity;
  for(let i=0;i<proxies.length;i++){
    if(!proxies[i].userData.powered)continue;
    const d=Math.hypot(proxies[i].position.x-from.x,proxies[i].position.z-from.z);
    if(d<distance){distance=d;nearest=i;}
  }
  return nearest;
}
