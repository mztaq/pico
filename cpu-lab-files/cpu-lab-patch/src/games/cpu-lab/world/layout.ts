/**
 * Facility layout and collision — pure data and maths, no three.js.
 * Coordinates are metres on the floor plane (x, z); the facility runs toward −z.
 */
import type { PuzzleId } from '../sim/puzzles';
import type { PanelId } from '../state/store';
import type { Register } from '../../../cpu/engine';

export interface Rect { x0: number; x1: number; z0: number; z1: number; }
export const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

export interface Room { name: string; area: Rect; light: number; }
export const ROOMS: Room[] = [
  { name: 'Workshop', area: rect(-7, 7, -6, 6), light: 0xffb36b },
  { name: 'Memory Vault', area: rect(-9, 9, -23, -9), light: 0x7fd3ff },
  { name: 'Bus Bridge', area: rect(-6, 6, -38, -26), light: 0xb69cff },
  { name: 'Processor Chamber', area: rect(-11, 11, -61, -41), light: 0x9fe3c0 },
  { name: 'Core', area: rect(-8, 8, -80, -64), light: 0xfff1d6 },
];
export const CORRIDORS: Rect[] = [rect(-1.6, 1.6, -9, -6), rect(-1.6, 1.6, -26, -23), rect(-1.6, 1.6, -41, -38), rect(-1.6, 1.6, -64, -61)];
export const WALKABLE: Rect[] = [...ROOMS.map(r => r.area), ...CORRIDORS];

export interface Door { id: string; area: Rect; opensWhen: PuzzleId; z: number; }
export const DOORS: Door[] = [
  { id: 'door-workshop', area: rect(-1.6, 1.6, -6.35, -5.65), opensWhen: 'workshop', z: -6 },
  { id: 'door-vault', area: rect(-1.6, 1.6, -23.35, -22.65), opensWhen: 'vault', z: -23 },
  { id: 'door-bus', area: rect(-1.6, 1.6, -38.35, -37.65), opensWhen: 'bus', z: -38 },
  { id: 'door-chamber', area: rect(-1.6, 1.6, -61.35, -60.65), opensWhen: 'chamber', z: -61 },
];
/** The gap in the Bus Bridge; only the extended bridge (x −1.4…1.4) is walkable once the bus puzzle is solved. */
export const CHASM = rect(-6, 6, -35, -29.5);
export const BRIDGE = rect(-1.4, 1.4, -35, -29.5);

export const CHAMBER_CENTER = { x: 0, z: -52 };
export const CORE_CENTER = { x: 0, z: -74 };
export const CHAMBER_RIG: Record<Register, { x: number; z: number }> = {
  PC: { x: -7, z: -47 }, MAR: { x: -2.4, z: -46.5 }, CU: { x: -7.5, z: -53 }, CIR: { x: -3.2, z: -51.5 },
  ACC: { x: 3.2, z: -51.5 }, ALU: { x: 7.5, z: -53 }, MDR: { x: 2.4, z: -46.5 }, RAM: { x: 0, z: -58.5 },
};
const ring = (cx: number, cz: number, r: number, i: number, n: number) => ({ x: cx + Math.sin((i / n) * Math.PI * 2) * r, z: cz + Math.cos((i / n) * Math.PI * 2) * r });
export const CORE_RIG: Record<Register, { x: number; z: number }> = Object.fromEntries(
  (['PC', 'MAR', 'MDR', 'CIR', 'CU', 'ACC', 'ALU', 'RAM'] as Register[]).map((r, i) => [r, ring(CORE_CENTER.x, CORE_CENTER.z, 5.4, i + 0.5, 8)]),
) as Record<Register, { x: number; z: number }>;

export interface Obstacle { area: Rect; id: string; }
const box = (x: number, z: number, w: number, d: number, id: string): Obstacle => ({ id, area: rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2) });
export const VAULT_PILLARS = Array.from({ length: 16 }, (_, i) => ({ address: i, x: -7 + (i % 8) * 2, z: i < 8 ? -13 : -18.5 }));
export const OBSTACLES: Obstacle[] = [
  box(0, -4.4, 3.4, 1.0, 'workshop-console'), box(-5.4, 2.4, 2.4, 1.2, 'workbench'), box(5.2, 3.6, 1.6, 1.6, 'crates'), box(5.6, -2.0, 1.2, 2.4, 'cabinet'),
  ...VAULT_PILLARS.map(p => box(p.x, p.z, 0.9, 0.9, 'pillar-' + p.address)), box(3.6, -21.6, 1.8, 0.8, 'vault-console'),
  box(-3.6, -28.6, 2.0, 0.9, 'bus-junction'),
  box(0, -43.2, 2.6, 0.9, 'chamber-console'), ...Object.entries(CHAMBER_RIG).map(([r, p]) => box(p.x, p.z, r === 'RAM' ? 4.2 : 1.4, r === 'RAM' ? 1.2 : 1.4, 'rig-' + r)),
  box(0, -67.4, 2.6, 0.9, 'core-console'), box(CORE_CENTER.x, CORE_CENTER.z, 3.4, 3.4, 'core'),
  ...Object.entries(CORE_RIG).map(([r, p]) => box(p.x, p.z, 1, 1, 'core-rig-' + r)),
];

export type InteractKind = 'machine' | 'log' | 'pillar' | 'inspect';
export interface Interactable { id: string; panel?: PanelId; inspect?: string; kind: InteractKind; label: string; x: number; z: number; y: number; room: string; requires?: PuzzleId; }
export const INTERACTABLES: Interactable[] = [
  { id: 'workshop', panel: 'workshop', kind: 'machine', label: 'Operate door controller', x: 0, z: -3.6, y: 1.2, room: 'Workshop' },
  { id: 'log-ws-1', panel: 'log:log-ws-1', kind: 'log', label: 'Read shift note', x: -5.4, z: 1.7, y: 1, room: 'Workshop' },
  { id: 'log-ws-2', panel: 'log:log-ws-2', kind: 'log', label: 'Read controller sticker', x: 1.9, z: -3.8, y: 1, room: 'Workshop' },
  { id: 'vault', panel: 'vault', kind: 'machine', label: 'Operate vault controller', x: 3.6, z: -21.0, y: 1.2, room: 'Memory Vault' },
  ...VAULT_PILLARS.map(p => ({ id: 'pillar-' + p.address, panel: `pillar:${p.address}` as PanelId, kind: 'pillar' as const, label: 'Inspect RAM ' + p.address.toString(2).padStart(4, '0'), x: p.x, z: p.z + (p.address < 8 ? 0.7 : -0.7), y: 1.4, room: 'Memory Vault' })),
  { id: 'log-vault-1', panel: 'log:log-vault-1', kind: 'log', label: 'Read calibration record', x: -8.4, z: -10.5, y: 1.4, room: 'Memory Vault' },
  { id: 'log-vault-2', panel: 'log:log-vault-2', kind: 'log', label: 'Read incident monitor', x: 8.4, z: -21.5, y: 1.4, room: 'Memory Vault' },
  { id: 'bus', panel: 'bus', kind: 'machine', label: 'Open bus junction', x: -3.6, z: -27.8, y: 1.1, room: 'Bus Bridge' },
  { id: 'log-bus-1', panel: 'log:log-bus-1', kind: 'log', label: 'Read conduit tags', x: 5.4, z: -27.5, y: 1.4, room: 'Bus Bridge' },
  { id: 'chamber', panel: 'chamber', kind: 'machine', label: 'Operate turbine sequencer', x: 0, z: -42.6, y: 1.2, room: 'Processor Chamber' },
  { id: 'log-chamber-1', panel: 'log:log-chamber-1', kind: 'log', label: 'Read sequencer listing', x: -10.4, z: -43.5, y: 1.4, room: 'Processor Chamber' },
  { id: 'log-chamber-2', panel: 'log:log-chamber-2', kind: 'log', label: 'Read final entry', x: 10.2, z: -59.5, y: 0.8, room: 'Processor Chamber' },
  ...(Object.entries(CHAMBER_RIG) as [Register, { x: number; z: number }][]).map(([r, p]) => ({ id: 'reg-' + r, inspect: r, kind: 'inspect' as const, label: 'Inspect ' + r, x: p.x, z: p.z + (r === 'RAM' ? 1 : 0.9), y: 1.5, room: 'Processor Chamber' })),
  { id: 'core', panel: 'core', kind: 'machine', label: 'Program the Core', x: 0, z: -66.8, y: 1.2, room: 'Core' },
  { id: 'log-core-1', panel: 'log:log-core-1', kind: 'log', label: 'Read ignition spec', x: -7.4, z: -65.5, y: 1.4, room: 'Core' },
];

/* ── geometry helpers ── */
export const inside = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
function circleHitsRect(r: Rect, x: number, z: number, radius: number) {
  const cx = Math.max(r.x0, Math.min(x, r.x1)), cz = Math.max(r.z0, Math.min(z, r.z1));
  return (x - cx) ** 2 + (z - cz) ** 2 < radius * radius;
}
export interface WorldFlags { solved: Record<PuzzleId, boolean>; }
export function blockers(flags: WorldFlags): Rect[] {
  const list = OBSTACLES.map(o => o.area);
  for (const d of DOORS) if (!flags.solved[d.opensWhen]) list.push(d.area);
  if (!flags.solved.bus) list.push(CHASM);
  else list.push(rect(CHASM.x0, BRIDGE.x0, CHASM.z0, CHASM.z1), rect(BRIDGE.x1, CHASM.x1, CHASM.z0, CHASM.z1));
  return list;
}
/** A circle is free if 8 rim samples and its centre are on walkable floor and it overlaps no blocker. */
export function isFree(x: number, z: number, radius: number, blocks: Rect[]): boolean {
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2, px = i === 8 ? x : x + Math.cos(a) * radius, pz = i === 8 ? z : z + Math.sin(a) * radius;
    if (!WALKABLE.some(r => inside(r, px, pz))) return false;
  }
  return !blocks.some(b => circleHitsRect(b, x, z, radius));
}
/** Axis-separated movement so the player slides along walls instead of sticking. */
export function moveWithCollision(x: number, z: number, dx: number, dz: number, radius: number, blocks: Rect[]): { x: number; z: number } {
  let nx = x, nz = z;
  if (isFree(nx + dx, nz, radius, blocks)) nx += dx;
  if (isFree(nx, nz + dz, radius, blocks)) nz += dz;
  return { x: nx, z: nz };
}
export function roomAt(x: number, z: number): string | null { return ROOMS.find(r => inside(r.area, x, z))?.name ?? null; }

/** Nearest interactable within reach and roughly in front of the player. `yaw` is the facing angle (0 = −z). */
export function findInteractable(x: number, z: number, yaw: number, list: Interactable[] = INTERACTABLES, reach = 2.1): Interactable | null {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let best: Interactable | null = null, bestScore = Infinity;
  for (const it of list) {
    const dx = it.x - x, dz = it.z - z, dist = Math.hypot(dx, dz);
    if (dist > reach) continue;
    const facing = dist < 0.35 ? 1 : (dx * fx + dz * fz) / dist;
    if (facing < 0.35) continue;
    const score = dist - facing * 0.8;
    if (score < bestScore) { best = it; bestScore = score; }
  }
  return best;
}
