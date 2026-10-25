// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode } from '../sim/puzzles';
import { loadSlots, MAX_SLOTS, normalizeSlotName, parseProgress, parseSlots, SLOTS_KEY } from './save';
import { GameStore } from './store';

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const solveWorkshop = (s: GameStore) => { for (let i = 0; i < 60 && !s.get().machines.workshop.halted; i++) { s.stepMachine('workshop'); if (s.get().prediction) s.answer(1); } };

describe('CPU Lab store · progression', () => {
  it('pauses at prediction prompts and resumes after an answer', () => {
    const s = new GameStore(); s.newGame('Test');
    s.stepMachine('workshop'); s.stepMachine('workshop'); s.stepMachine('workshop');
    expect(s.get().prediction?.id).toBe('pcAfterFetch');
    const pc = s.get().machines.workshop.pc;
    s.stepMachine('workshop');
    expect(s.get().machines.workshop.pc).toBe(pc);
    s.answer(0);
    expect(s.get().predictionResult?.correct).toBe(true);
  });
  it('solves the workshop, unlocks concepts and emits a world event', () => {
    const s = new GameStore(); s.newGame('Test');
    const events: string[] = []; s.onEvent(e => events.push(e.type));
    solveWorkshop(s);
    expect(s.get().progress.solved.workshop).toBe(true);
    expect(s.get().progress.concepts).toContain('fde');
    expect(events).toContain('solved');
    expect(s.isUnlocked('vault')).toBe(true); expect(s.isUnlocked('bus')).toBe(false);
  });
  it('counts a mistake and recovers after a wrong vault edit', () => {
    const s = new GameStore(); s.newGame('Test'); solveWorkshop(s);
    s.editVault(13, 6); s.run('vault'); vi.advanceTimersByTime(20000);
    expect(s.get().verdicts.vault?.ok).toBe(false); expect(s.get().progress.mistakes).toBe(1);
    s.editVault(13, 5); s.run('vault'); vi.advanceTimersByTime(20000);
    expect(s.get().progress.solved.vault).toBe(true);
  });
  it('does not solve a locked puzzle out of order', () => {
    const s = new GameStore(); s.newGame('Test');
    s.route('MAR→RAM', 'address'); s.route('CU→RAM', 'control'); s.route('RAM→MDR', 'data'); s.route('MDR→RAM', 'data');
    s.run('bus'); vi.advanceTimersByTime(20000);
    expect(s.get().verdicts.bus?.ok).toBe(true);
    expect(s.get().progress.solved.bus).toBe(false);
  });
  it('gives escalating hints, capped at three', () => {
    const s = new GameStore(); s.newGame('Test');
    const a = s.hint('workshop'), b = s.hint('workshop'), c = s.hint('workshop'), d = s.hint('workshop');
    expect(new Set([a, b, c]).size).toBe(3); expect(d).toBe(c);
  });
});

describe('CPU Lab store · named save slots', () => {
  it('creates a named slot on New Game and autosaves progress into it', () => {
    const s = new GameStore(); s.newGame('  My   first run ');
    expect(s.get().slots[0]?.name).toBe('My first run');
    solveWorkshop(s); vi.advanceTimersByTime(2000);
    expect(loadSlots()[0]?.progress.solved.workshop).toBe(true);
  });
  it('saves as a new slot, loads an older slot and restores its exact state', () => {
    const s = new GameStore(); s.newGame('Before');
    s.saveAs('Checkpoint A');
    solveWorkshop(s); s.saveGame();
    const a = s.get().slots.find(x => x.name === 'Checkpoint A')!;
    expect(a.progress.solved.workshop).toBe(true);
    const before = s.get().slots.find(x => x.name === 'Before')!;
    s.loadSlot(before.id);
    expect(s.get().progress.solved.workshop).toBe(false);
    expect(s.get().machines.workshop.halted).toBe(false);
    s.loadSlot(a.id);
    expect(s.get().progress.solved.workshop).toBe(true);
  });
  it('persists puzzle edits across a fresh store (reload)', () => {
    const s = new GameStore(); s.newGame('Edits'); solveWorkshop(s);
    s.editVault(13, 5); s.saveGame();
    const t = new GameStore(); t.continueGame();
    expect(t.get().machines.vault.memory[13]).toBe(5);
    expect(t.get().progress.solved.workshop).toBe(true);
  });
  it('renames, duplicates and deletes slots with unique names', () => {
    const s = new GameStore(); s.newGame('Run'); s.newGame('Run');
    expect(s.get().slots.map(x => x.name).sort()).toEqual(['Run', 'Run (2)']);
    const id = s.get().slots[0]!.id;
    s.renameSlot(id, 'Renamed'); expect(s.get().slots.find(x => x.id === id)?.name).toBe('Renamed');
    s.duplicateSlot(id); expect(s.get().slots).toHaveLength(3);
    s.deleteSlot(id); expect(s.get().slots.some(x => x.id === id)).toBe(false);
    expect(s.get().activeSlot).toBeNull();
  });
  it('caps the number of slots', () => {
    const s = new GameStore(); s.newGame('x');
    for (let i = 0; i < MAX_SLOTS + 3; i++) s.saveAs('slot');
    expect(s.get().slots.length).toBeLessThanOrEqual(MAX_SLOTS);
  });
  it('rejects malformed or tampered save data safely', () => {
    localStorage.setItem(SLOTS_KEY, JSON.stringify([{ id: 'bad id!', name: 'x', progress: {} }, { id: 'ok', name: 'y', progress: { version: 1, solved: { core: true }, vaultMemory: [999] } }, 'junk']));
    const slots = parseSlots(JSON.parse(localStorage.getItem(SLOTS_KEY)!));
    expect(slots).toHaveLength(1);
    expect(slots[0]!.progress.solved.core).toBe(false);
    expect(slots[0]!.progress.vaultMemory).toBeNull();
    expect(parseProgress({ version: 2 })).toBeNull();
    expect(normalizeSlotName('\u0007   ')).toBe('Untitled save');
  });
  it('keeps the core program the player wrote', () => {
    const s = new GameStore(); s.newGame('Core');
    s.setCore(0, encode('LDA', 12)); s.saveGame();
    expect(loadSlots()[0]!.progress.coreProgram[0]).toBe(encode('LDA', 12));
  });
});
