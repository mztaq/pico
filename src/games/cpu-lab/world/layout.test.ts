import { describe, expect, it } from 'vitest';
import { PUZZLE_ORDER, type PuzzleId } from '../sim/puzzles';
import { SPAWN } from '../state/save';
import { blockers, findInteractable, INTERACTABLES, isFree, moveWithCollision, OBSTACLES, roomAt } from './layout';

const flags = (upTo: number) => ({ solved: Object.fromEntries(PUZZLE_ORDER.map((id, i) => [id, i < upTo])) as Record<PuzzleId, boolean> });
const R = 0.35;

/** Walk in small steps toward a target and report how far the player got. */
function walk(from: { x: number; z: number }, to: { x: number; z: number }, upTo: number) {
  let p = { ...from };
  const b = blockers(flags(upTo));
  for (let i = 0; i < 4000; i++) {
    const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.1) break;
    p = moveWithCollision(p.x, p.z, (dx / d) * 0.05, (dz / d) * 0.05, R, b);
  }
  return p;
}

describe('CPU Lab world collision', () => {
  it('spawns the player on free floor', () => { expect(isFree(SPAWN.x, SPAWN.z, R, blockers(flags(0)))).toBe(true); });
  it('keeps the player inside the walls', () => {
    const p = walk({ x: 0, z: 0 }, { x: 30, z: 0 }, 0);
    expect(p.x).toBeLessThan(7);
  });
  it('slides along walls instead of sticking', () => {
    const b = blockers(flags(0));
    const p = moveWithCollision(6.5, 0, 0.3, -0.3, R, b);
    expect(p.z).toBeLessThan(0); expect(p.x).toBeLessThanOrEqual(6.65);
  });
  it('locks the workshop door until the first puzzle is solved', () => {
    expect(roomAt(walk({ x: 0, z: -2 }, { x: 0, z: -12 }, 0).x, walk({ x: 0, z: -2 }, { x: 0, z: -12 }, 0).z)).toBe('Workshop');
    const p = walk({ x: -2.4, z: -5 }, { x: 0, z: -12 }, 1);
    expect(roomAt(p.x, p.z)).toBe('Memory Vault');
  });
  it('blocks the chasm until the bridge extends, then allows crossing on the bridge only', () => {
    const before = walk({ x: 0, z: -27 }, { x: 0, z: -36.5 }, 2);
    expect(before.z).toBeGreaterThan(-29.5);
    const after = walk({ x: 0, z: -28.5 }, { x: 0, z: -36.5 }, 3);
    expect(after.z).toBeLessThan(-35);
    expect(walk({ x: 4, z: -28.5 }, { x: 4, z: -36.5 }, 3).z).toBeGreaterThan(-29.5);
  });
  it('leaves every interactable reachable on free floor in front of it', () => {
    const b = blockers(flags(5));
    for (const it of INTERACTABLES) {
      const ok = [[0, 0.5], [0, -0.5], [0.5, 0], [-0.5, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => isFree(it.x + dx!, it.z + dz!, R, b));
      expect(ok, it.id).toBe(true);
    }
  });
  it('never places an interactable inside an obstacle', () => {
    for (const it of INTERACTABLES) for (const o of OBSTACLES) {
      const inside = it.x > o.area.x0 && it.x < o.area.x1 && it.z > o.area.z0 && it.z < o.area.z1;
      expect(inside, it.id + ' in ' + o.id).toBe(false);
    }
  });
});

describe('CPU Lab interaction targeting', () => {
  it('selects the console the player faces and ignores things behind', () => {
    expect(findInteractable(0, -2.2, 0)?.id).toBe('workshop');
    expect(findInteractable(0, -2.2, Math.PI)).toBeNull();
  });
  it('prefers the nearest relevant object', () => {
    expect(findInteractable(-1, -12, 0)?.id).toBe('pillar-3');
  });
});
