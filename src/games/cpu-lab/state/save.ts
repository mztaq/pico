/** Local save data for CPU Lab. Browser storage is a convenience, not a backup. */
import type { QualitySetting } from '../world/quality';
import { CORE_SLOTS, defaultCoreProgram, emptyRouting, BUS_LINKS, EXTERNAL_BUSES, PUZZLE_ORDER, type PuzzleId, type Routing } from '../sim/puzzles';

export const SLOTS_KEY = 'pico.games.cpuLab.slots.v1';
export const ACTIVE_KEY = 'pico.games.cpuLab.activeSlot.v1';
export const SETTINGS_KEY = 'pico.games.cpuLab.settings.v1';

export interface Progress {
  version: 1;
  solved: Record<PuzzleId, boolean>;
  logs: string[];
  concepts: string[];
  dialogueSeen: string[];
  predictions: Record<string, number>;
  hintsUsed: Record<PuzzleId, number>;
  mistakes: number;
  cycles: number;
  player: { x: number; z: number; yaw: number };
  vaultMemory: number[] | null;
  busRouting: Routing;
  chamberProgram: number[] | null;
  coreProgram: number[];
  visited: string[];
  startedAt: number;
  completedAt: number | null;
}
export interface GameSettings { sensitivity: number; invertY: boolean; volume: number; reducedMotion: boolean; fov: number; quality: QualitySetting; showFps: boolean; }
export const defaultSettings: GameSettings = { sensitivity: 1, invertY: false, volume: 0.7, reducedMotion: false, fov: 65, quality: 'auto', showFps: false };
export const SPAWN = { x: 0, z: 3.5, yaw: 0 };

const flags = <T>(value: T) => Object.fromEntries(PUZZLE_ORDER.map(id => [id, value])) as Record<PuzzleId, T>;
export function newProgress(now = Date.now()): Progress {
  return {
    version: 1, solved: flags(false), logs: [], concepts: [], dialogueSeen: [], predictions: {}, hintsUsed: flags(0),
    mistakes: 0, cycles: 0, player: { ...SPAWN }, vaultMemory: null, busRouting: emptyRouting(), chamberProgram: null,
    coreProgram: defaultCoreProgram(), visited: ['Workshop'], startedAt: now, completedAt: null,
  };
}

const isByte = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 255;
const bytes = (v: unknown, length: number) => Array.isArray(v) && v.length === length && v.every(isByte) ? v as number[] : null;
const strings = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
const num = (v: unknown, fallback: number, min = -1e6, max = 1e6) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Validate untrusted JSON into a Progress; anything malformed falls back to defaults field by field. */
export function parseProgress(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  const base = newProgress(num(r.startedAt, Date.now()));
  const solved = flags(false), hints = flags(0);
  for (const id of PUZZLE_ORDER) {
    solved[id] = !!(r.solved as Record<string, unknown> | undefined)?.[id];
    hints[id] = Math.round(num((r.hintsUsed as Record<string, unknown> | undefined)?.[id], 0, 0, 3));
  }
  // Progress must be contiguous: a later room cannot be solved before an earlier one.
  let gate = true;
  for (const id of PUZZLE_ORDER) { solved[id] = gate && solved[id]; gate = solved[id]; }
  const routing = emptyRouting();
  const rr = r.busRouting as Record<string, unknown> | undefined;
  for (const link of BUS_LINKS) { const v = rr?.[link]; routing[link] = EXTERNAL_BUSES.includes(v as never) ? v as Routing[typeof link] : null; }
  const player = r.player as Record<string, unknown> | undefined;
  const predictions: Record<string, number> = {};
  for (const [k, v] of Object.entries((r.predictions as Record<string, unknown>) ?? {})) if (typeof v === 'number' && Number.isInteger(v)) predictions[k] = v;
  return {
    ...base, solved, hintsUsed: hints, logs: strings(r.logs), concepts: strings(r.concepts), dialogueSeen: strings(r.dialogueSeen), predictions,
    mistakes: Math.round(num(r.mistakes, 0, 0)), cycles: Math.round(num(r.cycles, 0, 0, 1e9)),
    player: { x: num(player?.x, SPAWN.x, -60, 60), z: num(player?.z, SPAWN.z, -80, 20), yaw: num(player?.yaw, SPAWN.yaw, -100, 100) },
    vaultMemory: bytes(r.vaultMemory, 16), busRouting: routing, chamberProgram: bytes(r.chamberProgram, 16),
    coreProgram: bytes(r.coreProgram, CORE_SLOTS) ?? defaultCoreProgram(), visited: strings(r.visited).length ? strings(r.visited) : ['Workshop'],
    completedAt: typeof r.completedAt === 'number' ? r.completedAt : null,
  };
}
export function parseSettings(raw: unknown): GameSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    sensitivity: num(r.sensitivity, defaultSettings.sensitivity, 0.2, 3), invertY: r.invertY === true,
    volume: num(r.volume, defaultSettings.volume, 0, 1), reducedMotion: r.reducedMotion === true,
    fov: num(r.fov, defaultSettings.fov, 50, 90), quality: (['auto', 'high', 'balanced', 'low'] as const).find(q => q === r.quality) ?? 'auto', showFps: r.showFps === true,
  };
}

function read(key: string): unknown { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key: string, value: unknown): boolean { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
export const loadGameSettings = () => parseSettings(read(SETTINGS_KEY));
export const saveGameSettings = (s: GameSettings) => write(SETTINGS_KEY, s);

/* ───────────── named save slots ───────────── */
export const MAX_SLOTS = 12;
export interface SaveSlot { id: string; name: string; createdAt: number; updatedAt: number; auto: boolean; progress: Progress; }
export interface SlotSummary { room: string; solved: number; total: number; percent: number; complete: boolean; }
export function summarize(p: Progress): SlotSummary {
  const solved = PUZZLE_ORDER.filter(id => p.solved[id]).length;
  return { room: p.visited.at(-1) ?? 'Workshop', solved, total: PUZZLE_ORDER.length, percent: Math.round((solved / PUZZLE_ORDER.length) * 100), complete: p.completedAt !== null };
}
export function normalizeSlotName(name: string, fallback = 'Untitled save'): string {
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return clean || fallback;
}
export function parseSlots(raw: unknown): SaveSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: SaveSlot[] = [];
  for (const item of raw.slice(0, MAX_SLOTS * 2)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const progress = parseProgress(r.progress);
    if (!progress || typeof r.id !== 'string' || !/^[a-z0-9-]{1,40}$/i.test(r.id)) continue;
    if (out.some(s => s.id === r.id)) continue;
    out.push({ id: r.id, name: normalizeSlotName(typeof r.name === 'string' ? r.name : ''), createdAt: num(r.createdAt, Date.now()), updatedAt: num(r.updatedAt, Date.now()), auto: r.auto === true, progress });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SLOTS);
}
export const newSlotId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const loadSlots = () => parseSlots(read(SLOTS_KEY));
export const writeSlots = (slots: SaveSlot[]) => write(SLOTS_KEY, slots.slice(0, MAX_SLOTS));
export function upsertSlot(slots: SaveSlot[], slot: SaveSlot): SaveSlot[] { return [slot, ...slots.filter(s => s.id !== slot.id)].sort((a, b) => b.updatedAt - a.updatedAt); }
export function uniqueSlotName(slots: SaveSlot[], base: string): string {
  const name = normalizeSlotName(base);
  if (!slots.some(s => s.name === name)) return name;
  for (let i = 2; ; i++) { const n = normalizeSlotName(name.slice(0, 34) + ' (' + i + ')'); if (!slots.some(s => s.name === n)) return n; }
}
export const loadActiveSlotId = () => { const v = read(ACTIVE_KEY); return typeof v === 'string' ? v : null; };
export const saveActiveSlotId = (id: string | null) => write(ACTIVE_KEY, id);
