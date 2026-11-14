/** Low-cost 2D sight blocking for the server-room cover.
 * Uses a line-segment / axis-aligned cabinet intersection test.
 */
export interface PointXZ { x: number; z: number }
export interface CoverRectangle { minX: number; maxX: number; minZ: number; maxZ: number }
export function isSightBlocked(from: PointXZ, to: PointXZ, cover: CoverRectangle): boolean {
  let near = 0, far = 1;
  for (const [origin, delta, low, high] of [
    [from.x, to.x - from.x, cover.minX, cover.maxX],
    [from.z, to.z - from.z, cover.minZ, cover.maxZ],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < low || origin > high) return false;
      continue;
    }
    const p = (low - origin) / delta;
    const q = (high - origin) / delta;
    near = Math.max(near, Math.min(p, q));
    far = Math.min(far, Math.max(p, q));
    if (near > far) return false;
  }
  return near < 1 && far > 0;
}
export type HackerPhase = 'working' | 'escaping' | 'hiding' | 'returning';
export interface HackerDecisionInput {
  phase: HackerPhase;
  guardVisible: boolean;
  nearbyGuard: boolean;
  reachedWaypoint: boolean;
  now: number;
  hidingUntil: number;
}
export function chooseHackerPhase(input: HackerDecisionInput): HackerPhase {
  if (input.phase === 'working' && (input.guardVisible || input.nearbyGuard)) return 'escaping';
  if (input.phase === 'escaping' && input.reachedWaypoint) return 'hiding';
  if (input.phase === 'hiding' && input.now >= input.hidingUntil && !input.guardVisible && !input.nearbyGuard)
    return 'returning';
  if (input.phase === 'returning' && (input.guardVisible || input.nearbyGuard)) return 'escaping';
  if (input.phase === 'returning' && input.reachedWaypoint) return 'working';
  return input.phase;
}

/** Guards elsewhere in the data center should not keep the hacker hidden.
 * Both the current hiding spot and the original laptop station need clearance.
 */
export function hackerAreaIsClear(
  guards: readonly PointXZ[],
  defender: PointXZ,
  hacker: PointXZ,
  workstation: PointXZ,
  guardDistance = 11,
  playerDistance = 8,
): boolean {
  const distance = (a:PointXZ,b:PointXZ) => Math.hypot(a.x-b.x,a.z-b.z);
  if(distance(defender,hacker)<playerDistance ||
     distance(defender,workstation)<playerDistance) return false;
  for(const guard of guards){
    if(distance(guard,hacker)<guardDistance ||
       distance(guard,workstation)<guardDistance) return false;
  }
  return true;
}
