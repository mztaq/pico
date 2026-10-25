/**
 * Central game state. Explicit transitions only — the 3D world and the React
 * overlays both read this store, so they can never show contradictory values.
 */
import {
  boot, chamberImage, coreImage, judgeBus, judgeChamber, judgeCore, judgeVault, judgeWorkshop, PUZZLE_ORDER, step, traceBus,
  vaultImage, workshopMachine, type BusLink, type ExternalBus, type Machine, type PuzzleId, type Verdict, runMachine,
} from '../sim/puzzles';
import type { AssemblyImage } from '../../../cpu/assembler';
import { BIT_LINES, CONCEPTS_BY_PUZZLE, HINTS, LOGS, PREDICTIONS, type Line, type Prediction } from '../story/script';
import {
  loadActiveSlotId, loadGameSettings, loadSlots, MAX_SLOTS, newProgress, newSlotId, normalizeSlotName, saveActiveSlotId, saveGameSettings, uniqueSlotName,
  upsertSlot, writeSlots, defaultSettings, type GameSettings, type Progress, type SaveSlot,
} from './save';

export type Phase = 'menu' | 'intro' | 'playing' | 'paused' | 'panel' | 'journal' | 'map' | 'settings' | 'saves' | 'controls' | 'ending';
export type PanelId = PuzzleId | `log:${string}` | `pillar:${number}`;
export type WorldEvent = { type: 'solved'; id: PuzzleId } | { type: 'fail'; id: PuzzleId } | { type: 'step'; id: PuzzleId } | { type: 'reset' };

export interface GameState {
  phase: Phase;
  returnPhase: Phase;
  progress: Progress;
  settings: GameSettings;
  panel: PanelId | null;
  machines: Record<PuzzleId, Machine>;
  verdicts: Partial<Record<PuzzleId, Verdict>>;
  running: PuzzleId | null;
  dialogue: Line[];
  toast: { text: string; tone: 'info' | 'good' | 'bad'; id: number } | null;
  prediction: Prediction | null;
  predictionResult: { correct: boolean; explain: string } | null;
  slots: SaveSlot[];
  activeSlot: string | null;
  lastSaved: number | null;
  saveError: boolean;
  room: string;
  prompt: string | null;
}

type Listener = () => void;
const SPEED_MS = 260;

export class GameStore {
  private state: GameState;
  private listeners = new Set<Listener>();
  private eventListeners = new Set<(e: WorldEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private busQueue: Machine[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private toastId = 0;

  constructor(private readonly persist = true) {
    const slots = persist ? loadSlots() : [];
    const progress = newProgress();
    this.state = {
      phase: 'menu', returnPhase: 'playing', progress, settings: persist ? loadGameSettings() : { ...defaultSettings },
      panel: null, machines: this.buildMachines(progress), verdicts: {}, running: null, dialogue: [], toast: null,
      prediction: null, predictionResult: null, slots, activeSlot: persist ? loadActiveSlotId() : null, lastSaved: null, saveError: false, room: 'Workshop', prompt: null,
    };
  }

  /* ── subscription ── */
  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  onEvent(l: (e: WorldEvent) => void) { this.eventListeners.add(l); return () => { this.eventListeners.delete(l); }; }
  get = () => this.state;
  private set(patch: Partial<GameState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l()); }
  private emit(e: WorldEvent) { this.eventListeners.forEach(l => l(e)); }
  private patchProgress(patch: Partial<Progress>) { this.set({ progress: { ...this.state.progress, ...patch } }); this.scheduleSave(); }

  /* ── lifecycle & save slots ── */
  /** Start a fresh run in a new named slot. */
  newGame(name = 'Apprentice run') {
    this.stop();
    const progress = newProgress();
    const slot: SaveSlot = { id: newSlotId(), name: uniqueSlotName(this.state.slots, name), createdAt: Date.now(), updatedAt: Date.now(), auto: false, progress };
    this.load(progress, slot.id, 'intro');
    this.commitSlot(slot);
  }
  /** Resume the most recently played slot. */
  continueGame() {
    const recent = this.state.slots.find(s => s.id === this.state.activeSlot) ?? this.state.slots[0];
    if (recent) this.loadSlot(recent.id); else this.newGame();
  }
  loadSlot(id: string) {
    const slot = this.state.slots.find(s => s.id === id);
    if (!slot) { this.toast('That save no longer exists', 'bad'); return; }
    this.stop();
    this.load(structuredClone(slot.progress), slot.id, 'playing');
    if (this.persist) saveActiveSlotId(slot.id);
    this.toast('Loaded “' + slot.name + '”', 'info');
    if (!slot.progress.dialogueSeen.includes('wake')) this.sayOnce('wake');
  }
  private load(progress: Progress, slotId: string, phase: Phase) {
    this.set({ progress, activeSlot: slotId, machines: this.buildMachines(progress), verdicts: {}, phase, panel: null, dialogue: [], prediction: null, predictionResult: null, room: progress.visited.at(-1) ?? 'Workshop', prompt: null });
    this.emit({ type: 'reset' });
  }
  /** Manual save into the current slot. */
  saveGame(): boolean { return this.saveNow(true); }
  /** Save a copy of the current run under a new name; it becomes the active slot. */
  saveAs(name: string): boolean {
    if (this.state.slots.length >= MAX_SLOTS) { this.toast('Save limit reached (' + MAX_SLOTS + '). Delete a save first.', 'bad'); return false; }
    const slot: SaveSlot = { id: newSlotId(), name: uniqueSlotName(this.state.slots, name), createdAt: Date.now(), updatedAt: Date.now(), auto: false, progress: structuredClone(this.state.progress) };
    this.set({ activeSlot: slot.id });
    const ok = this.commitSlot(slot);
    if (ok) this.toast('Saved as “' + slot.name + '”', 'good');
    return ok;
  }
  renameSlot(id: string, name: string) {
    const slot = this.state.slots.find(s => s.id === id); if (!slot) return;
    const others = this.state.slots.filter(s => s.id !== id);
    this.writeAll(this.state.slots.map(s => s.id === id ? { ...s, name: uniqueSlotName(others, normalizeSlotName(name, s.name)) } : s));
  }
  duplicateSlot(id: string) {
    const slot = this.state.slots.find(s => s.id === id); if (!slot) return;
    if (this.state.slots.length >= MAX_SLOTS) { this.toast('Save limit reached (' + MAX_SLOTS + ')', 'bad'); return; }
    this.writeAll(upsertSlot(this.state.slots, { ...structuredClone(slot), id: newSlotId(), name: uniqueSlotName(this.state.slots, slot.name + ' copy'), updatedAt: Date.now(), createdAt: Date.now() }));
  }
  deleteSlot(id: string) {
    this.writeAll(this.state.slots.filter(s => s.id !== id));
    if (this.state.activeSlot === id) { this.set({ activeSlot: null }); if (this.persist) saveActiveSlotId(null); }
  }
  private commitSlot(slot: SaveSlot): boolean {
    if (this.persist) saveActiveSlotId(slot.id);
    return this.writeAll(upsertSlot(this.state.slots, slot));
  }
  private writeAll(slots: SaveSlot[]): boolean {
    const ok = this.persist ? writeSlots(slots) : true;
    this.set({ slots, saveError: !ok, lastSaved: ok ? Date.now() : this.state.lastSaved });
    if (!ok) this.toast('Could not save — browser storage is full or blocked', 'bad');
    return ok;
  }
  beginPlay() { this.set({ phase: 'playing' }); this.sayOnce('wake'); }
  setPhase(phase: Phase) {
    if (phase === 'settings' || phase === 'journal' || phase === 'map' || phase === 'saves' || phase === 'controls') {
      const from = this.state.phase;
      this.set({ returnPhase: from === 'menu' ? 'menu' : from === 'paused' ? 'paused' : 'playing' });
    }
    this.set({ phase });
  }
  back() { this.set({ phase: this.state.returnPhase, returnPhase: 'playing' }); }
  pause() { if (this.state.phase === 'playing') this.set({ phase: 'paused' }); }
  quitToMenu() { this.stop(); this.saveNow(); this.set({ phase: 'menu', panel: null, prompt: null }); }
  setPrompt(prompt: string | null) { if (prompt !== this.state.prompt) this.set({ prompt }); }
  updateSettings(patch: Partial<GameSettings>) { const settings = { ...this.state.settings, ...patch }; this.set({ settings }); if (this.persist) saveGameSettings(settings); }

  /* ── world bookkeeping ── */
  setPlayer(x: number, z: number, yaw: number) { this.state.progress.player = { x, z, yaw }; this.scheduleSave(); }
  enterRoom(room: string) {
    if (room === this.state.room) return;
    this.set({ room });
    if (!this.state.progress.visited.includes(room)) this.patchProgress({ visited: [...this.state.progress.visited, room] });
    const intro: Record<string, string> = { 'Memory Vault': 'vaultEnter', 'Bus Bridge': 'busEnter', 'Processor Chamber': 'chamberEnter', Core: 'coreEnter' };
    if (intro[room]) this.sayOnce(intro[room]!);
  }
  toast(text: string, tone: 'info' | 'good' | 'bad' = 'info') { this.set({ toast: { text, tone, id: ++this.toastId } }); }
  clearToast(id: number) { if (this.state.toast?.id === id) this.set({ toast: null }); }

  /* ── dialogue ── */
  sayOnce(key: string) {
    if (this.state.progress.dialogueSeen.includes(key)) return;
    this.patchProgress({ dialogueSeen: [...this.state.progress.dialogueSeen, key] });
    this.say(BIT_LINES[key] ?? []);
  }
  say(lines: Line[]) { this.set({ dialogue: [...this.state.dialogue, ...lines] }); }
  advanceDialogue() { this.set({ dialogue: this.state.dialogue.slice(1) }); }

  /* ── panels & logs ── */
  openPanel(panel: PanelId) {
    if (panel.startsWith('log:')) {
      const id = panel.slice(4);
      if (LOGS.some(l => l.id === id) && !this.state.progress.logs.includes(id)) { this.patchProgress({ logs: [...this.state.progress.logs, id] }); this.toast('Record recovered — added to your journal', 'info'); }
    }
    this.set({ panel, phase: 'panel' });
  }
  closePanel() { this.stop(); this.set({ panel: null, phase: 'playing', predictionResult: null }); }
  isUnlocked(id: PuzzleId) { const i = PUZZLE_ORDER.indexOf(id); return i === 0 || this.state.progress.solved[PUZZLE_ORDER[i - 1]!]; }

  /* ── hints ── */
  hint(id: PuzzleId): string {
    const used = Math.min(3, this.state.progress.hintsUsed[id] + 1);
    this.patchProgress({ hintsUsed: { ...this.state.progress.hintsUsed, [id]: used } });
    return HINTS[id][used - 1]!;
  }

  /* ── machines ── */
  private images(p: Progress): Record<Exclude<PuzzleId, 'workshop' | 'bus'>, AssemblyImage> {
    const vault = vaultImage(); if (p.vaultMemory) p.vaultMemory.forEach((v, i) => { vault.memory[i]!.value = v; });
    const chamber = chamberImage(); if (p.chamberProgram) p.chamberProgram.forEach((v, i) => { chamber.memory[i]!.value = v; });
    return { vault, chamber, core: coreImage(p.coreProgram) };
  }
  private buildMachines(p: Progress): Record<PuzzleId, Machine> {
    const img = this.images(p);
    const solvedBus = traceBus(p.busRouting);
    return {
      workshop: p.solved.workshop ? runMachine(workshopMachine()) : workshopMachine(),
      vault: p.solved.vault ? runMachine(boot(img.vault)) : boot(img.vault),
      bus: p.solved.bus ? solvedBus.machine : boot(solvedBus.machine.initial),
      chamber: p.solved.chamber ? runMachine(boot(img.chamber)) : boot(img.chamber),
      core: p.solved.core ? runMachine(boot(img.core)) : boot(img.core),
    };
  }
  private setMachine(id: PuzzleId, m: Machine) {
    this.set({ machines: { ...this.state.machines, [id]: m } });
    this.state.progress.cycles++;
    this.emit({ type: 'step', id });
  }

  /** One micro-operation. Prediction prompts pause the workshop at teaching moments. */
  stepMachine(id: PuzzleId) {
    if (this.state.prediction) return;
    if (id === 'bus') { this.runBusFrame(); return; }
    const before = this.state.machines[id];
    if (before.halted) return;
    const m = step(before);
    this.setMachine(id, m);
    if (id === 'workshop') {
      if (m.micro === 6 && !this.seenPrediction('pcAfterFetch')) this.ask('pcAfterFetch');
      else if (m.frame.phase === 'decode' && m.frame.description.includes('LDA') && !this.seenPrediction('ldaAddress')) this.ask('ldaAddress');
    }
    if (m.halted) this.finish(id);
  }
  run(id: PuzzleId) {
    if (this.state.running) return;
    if (id === 'bus') {
      const trace = traceBus(this.state.progress.busRouting);
      this.busQueue = [...trace.frames];
      this.set({ machines: { ...this.state.machines, bus: boot(trace.machine.initial) }, verdicts: { ...this.state.verdicts, bus: undefined } });
    } else if (this.state.machines[id].halted) this.resetMachine(id);
    this.set({ running: id, verdicts: { ...this.state.verdicts, [id]: undefined } });
    const speed = this.state.settings.reducedMotion ? SPEED_MS * 0.6 : SPEED_MS;
    this.timer = setInterval(() => {
      if (this.state.prediction) return;
      if (this.state.running !== id) { this.stop(); return; }
      this.stepMachine(id);
      const m = this.state.machines[id];
      if (m.halted || (id === 'bus' && !this.busQueue.length)) this.stop();
    }, id === 'core' || id === 'chamber' ? speed * 0.55 : speed);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; if (this.state.running) this.set({ running: null }); }
  resetMachine(id: PuzzleId) {
    this.stop();
    const fresh = this.buildMachines({ ...this.state.progress, solved: { ...this.state.progress.solved, [id]: false } })[id];
    this.set({ machines: { ...this.state.machines, [id]: id === 'workshop' ? boot(fresh.initial) : fresh }, verdicts: { ...this.state.verdicts, [id]: undefined } });
    if (id === 'bus') this.busQueue = [];
    this.emit({ type: 'step', id });
  }
  private runBusFrame() {
    if (!this.busQueue.length) {
      const trace = traceBus(this.state.progress.busRouting);
      this.busQueue = [...trace.frames];
      this.set({ machines: { ...this.state.machines, bus: boot(trace.machine.initial) } });
      return;
    }
    const m = this.busQueue.shift()!;
    this.setMachine('bus', m);
    if (!this.busQueue.length) this.finish('bus');
  }

  /* ── puzzle edits ── */
  editVault(address: number, value: number) {
    const memory = this.state.machines.vault.initial.memory.map(c => c.value);
    memory[address] = value & 255;
    this.patchProgress({ vaultMemory: memory });
    this.set({ machines: { ...this.state.machines, vault: boot(this.images(this.state.progress).vault) }, verdicts: { ...this.state.verdicts, vault: undefined } });
    this.emit({ type: 'step', id: 'vault' });
  }
  restoreVault() { this.patchProgress({ vaultMemory: null }); this.resetMachine('vault'); this.toast('Vault restored to its factory image'); }
  route(link: BusLink, bus: ExternalBus | null) {
    this.patchProgress({ busRouting: { ...this.state.progress.busRouting, [link]: bus } });
    this.busQueue = [];
    this.set({ verdicts: { ...this.state.verdicts, bus: undefined } });
    this.emit({ type: 'step', id: 'bus' });
  }
  editChamber(address: number, word: number) {
    const program = this.state.machines.chamber.initial.memory.map(c => c.value);
    program[address] = word & 255;
    this.patchProgress({ chamberProgram: program });
    this.set({ machines: { ...this.state.machines, chamber: boot(this.images(this.state.progress).chamber) }, verdicts: { ...this.state.verdicts, chamber: undefined } });
    this.emit({ type: 'step', id: 'chamber' });
  }
  restoreChamber() { this.patchProgress({ chamberProgram: null }); this.resetMachine('chamber'); }
  setCore(slot: number, word: number) {
    const coreProgram = [...this.state.progress.coreProgram]; coreProgram[slot] = word & 255;
    this.patchProgress({ coreProgram });
    this.set({ machines: { ...this.state.machines, core: boot(coreImage(coreProgram)) }, verdicts: { ...this.state.verdicts, core: undefined } });
    this.emit({ type: 'step', id: 'core' });
  }

  /* ── predictions ── */
  private seenPrediction(id: string) { return id in this.state.progress.predictions; }
  private ask(id: string) { this.set({ prediction: PREDICTIONS[id] ?? null, predictionResult: null }); }
  answer(choice: number) {
    const p = this.state.prediction; if (!p) return;
    this.patchProgress({ predictions: { ...this.state.progress.predictions, [p.id]: choice } });
    this.set({ prediction: null, predictionResult: { correct: choice === p.answer, explain: p.explain } });
  }
  dismissPrediction() { this.set({ predictionResult: null }); }

  /* ── outcomes ── */
  judge(id: PuzzleId): Verdict {
    const m = this.state.machines[id];
    switch (id) {
      case 'workshop': return judgeWorkshop(m);
      case 'vault': return judgeVault(m);
      case 'bus': return judgeBus(traceBus(this.state.progress.busRouting));
      case 'chamber': return judgeChamber(m);
      case 'core': return judgeCore(m);
    }
  }
  private finish(id: PuzzleId) {
    const verdict = this.judge(id);
    this.set({ verdicts: { ...this.state.verdicts, [id]: verdict } });
    if (!verdict.ok) { this.patchProgress({ mistakes: this.state.progress.mistakes + 1 }); this.emit({ type: 'fail', id }); return; }
    if (this.state.progress.solved[id]) return;
    if (!this.isUnlocked(id)) return;
    const concepts = [...new Set([...this.state.progress.concepts, ...CONCEPTS_BY_PUZZLE[id]])];
    const solved = { ...this.state.progress.solved, [id]: true };
    this.patchProgress({ solved, concepts, completedAt: id === 'core' ? Date.now() : this.state.progress.completedAt });
    this.emit({ type: 'solved', id });
    this.sayOnce(id + 'Solved');
    this.saveNow();
  }
  enterEnding() { this.closePanel(); this.set({ phase: 'ending' }); }

  /* ── persistence ── */
  private scheduleSave() {
    if (!this.persist || this.saveTimer) return;
    this.saveTimer = setTimeout(() => { this.saveTimer = null; this.saveNow(); }, 1500);
  }
  /** Autosave (and manual save) into the active slot. */
  saveNow(manual = false): boolean {
    if (!this.persist || this.state.phase === 'menu' || !this.state.activeSlot) return false;
    const existing = this.state.slots.find(s => s.id === this.state.activeSlot);
    const slot: SaveSlot = existing
      ? { ...existing, updatedAt: Date.now(), progress: structuredClone(this.state.progress) }
      : { id: this.state.activeSlot, name: uniqueSlotName(this.state.slots, 'Recovered run'), createdAt: Date.now(), updatedAt: Date.now(), auto: false, progress: structuredClone(this.state.progress) };
    const ok = this.writeAll(upsertSlot(this.state.slots, slot));
    if (ok && manual) this.toast('Game saved to “' + slot.name + '”', 'good');
    return ok;
  }
  dispose() { this.stop(); if (this.saveTimer) clearTimeout(this.saveTimer); this.saveNow(); }
  get slotName() { return this.state.slots.find(s => s.id === this.state.activeSlot)?.name ?? null; }
}
