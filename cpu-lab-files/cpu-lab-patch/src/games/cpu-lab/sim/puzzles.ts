/**
 * CPU Lab puzzle layer.
 *
 * Every puzzle runs on the *same* educational machine as CPU Studio
 * (src/cpu/engine.ts): an 8-bit accumulator CPU with 16 RAM addresses and
 * 4-bit opcode + 4-bit operand instructions. Nothing here animates values that
 * the engine did not produce; the 3D world only renders `Machine` snapshots.
 */
import { assemble, binary4, binary8, decode, ISA, type AssemblyImage, type Mnemonic } from '../../../cpu/assembler';
import { boot, step, type Bus, type Machine, type Register } from '../../../cpu/engine';

export type PuzzleId = 'workshop' | 'vault' | 'bus' | 'chamber' | 'core';
export const PUZZLE_ORDER: PuzzleId[] = ['workshop', 'vault', 'bus', 'chamber', 'core'];
export type CellKind = AssemblyImage['memory'][number]['kind'];

export interface Verdict { ok: boolean; title: string; detail: string; }

/** Build a machine from raw words + kinds, keeping the original program as its reset image. */
export function imageFrom(words: number[], kinds: CellKind[], entry = 0): AssemblyImage {
  return {
    memory: words.map((value, i) => ({ value: value & 255, kind: kinds[i] ?? 'empty', line: null, text: kinds[i] === 'instruction' ? disassemble(value) : kinds[i] === 'data' ? 'DAT ' + (value & 255) : '' })),
    symbols: {}, entry, code: '',
  };
}

export function disassemble(word: number): string {
  try { const { mnemonic, operand } = decode(word); return mnemonic === 'HLT' ? 'HLT' : mnemonic + ' ' + binary4(operand); }
  catch { return '??? ' + binary8(word); }
}
export function encode(mnemonic: Mnemonic, operand: number): number { return ((ISA[mnemonic] & 15) << 4) | (mnemonic === 'HLT' ? 0 : operand & 15); }
export const MNEMONICS = Object.keys(ISA) as Mnemonic[];

/** Step a machine until it halts (or errors) with a guard against infinite loops. */
export function runMachine(m: Machine, limit = 4000): Machine {
  let current = m;
  for (let i = 0; i < limit && !current.halted; i++) current = step(current);
  if (current.halted) return current;
  const description = 'Execution limit reached: the program never reached HLT (an infinite loop?).';
  return { ...current, halted: true, error: description, frame: { phase: 'error', description, active: [] } };
}

/* ───────────────────────── 1 · Workshop: the frozen door controller ───────────────────────── */
export const WORKSHOP_SOURCE = `; Door controller — copy the unlock code into the latch
LDA 1110
STA 1111
HLT
.ORG 1110
CODE:  DAT 1
LATCH: DAT 0`;
/** The controller froze three micro-operations into its first fetch (just before the READ signal). */
export function workshopMachine(): Machine {
  let m = boot(assemble(WORKSHOP_SOURCE));
  for (let i = 0; i < 3; i++) m = step(m);
  return m;
}
export function judgeWorkshop(m: Machine): Verdict {
  if (m.error) return { ok: false, title: 'Controller fault', detail: m.error };
  if (!m.halted) return { ok: false, title: 'Still running', detail: 'Keep stepping until the controller reaches HLT.' };
  if (m.memory[15] === 1) return { ok: true, title: 'Latch released', detail: 'LDA copied the data stored at address 1110 into the accumulator, and STA wrote it to the latch at 1111. The door reads its latch and opens.' };
  return { ok: false, title: 'Latch still closed', detail: 'The latch at 1111 holds ' + binary8(m.memory[15]!) + ', not 00000001.' };
}

/* ───────────────────────── 2 · Memory Vault: address versus data ───────────────────────── */
export const VAULT_TARGET = 9;
export const VAULT_SOURCE = `; Vault lock — combine base code with calibration offset
LDA 1100
ADD 1101
STA 1110
HLT
.ORG 1100
BASE:   DAT 4
OFFSET: DAT 0
LOCK:   DAT 0`;
export const vaultImage = (): AssemblyImage => assemble(VAULT_SOURCE);
export function judgeVault(m: Machine): Verdict {
  if (m.error) return { ok: false, title: 'Vault controller fault', detail: m.error + ' Check whether you changed an instruction cell instead of a data cell. Restore the factory image to recover.' };
  const lock = m.memory[14]!;
  if (lock === VAULT_TARGET) return { ok: true, title: 'Vault unsealed', detail: 'The program read the data at 1100 (4) and the data at 1101 (5). The ALU added them and STA stored 9 at 1110 — the address the lock reads. The addresses never changed; only the data held in them did.' };
  const base = m.memory[12]!, offset = m.memory[13]!;
  return { ok: false, title: 'Wrong lock value', detail: `The lock at 1110 received ${lock} (${binary8(lock)}). The program computes [1100] + [1101] = ${base} + ${offset}. The lock needs ${VAULT_TARGET}.` };
}

/* ───────────────────────── 3 · Bus Bridge: routing three different buses ───────────────────────── */
export type BusLink = 'MAR→RAM' | 'CU→RAM' | 'RAM→MDR' | 'MDR→RAM';
export const BUS_LINKS: BusLink[] = ['MAR→RAM', 'CU→RAM', 'RAM→MDR', 'MDR→RAM'];
export type ExternalBus = Exclude<Bus, 'internal'>;
export const EXTERNAL_BUSES: ExternalBus[] = ['address', 'data', 'control'];
export type Routing = Record<BusLink, ExternalBus | null>;
export const emptyRouting = (): Routing => ({ 'MAR→RAM': null, 'CU→RAM': null, 'RAM→MDR': null, 'MDR→RAM': null });
export const BUS_SOURCE = `; Bridge controller — read the extend flag and latch it
LDA 1110
STA 1111
HLT
.ORG 1110
FLAG:  DAT 1
LATCH: DAT 0`;
export interface BusTrace { frames: Machine[]; failure: { at: number; link: BusLink; needed: ExternalBus; got: ExternalBus | null } | null; machine: Machine; }
/** Run the bridge program; every external transfer must travel on the bus the player wired to that link. */
export function traceBus(routing: Routing): BusTrace {
  let m = boot(assemble(BUS_SOURCE));
  const frames: Machine[] = [];
  for (let i = 0; i < 200 && !m.halted; i++) {
    m = step(m);
    frames.push(m);
    const t = m.frame.transfer;
    if (t && t.bus !== 'internal') {
      const link = (t.from + '→' + t.to) as BusLink;
      if (routing[link] !== t.bus) return { frames, failure: { at: frames.length - 1, link, needed: t.bus, got: routing[link] ?? null }, machine: m };
    }
  }
  return { frames, failure: null, machine: m };
}
const busRole: Record<ExternalBus, string> = {
  address: 'the address bus carries a memory location from the MAR to RAM — one direction only',
  data: 'the data bus carries the contents of a memory location, and is bidirectional (RAM→MDR on a read, MDR→RAM on a write)',
  control: 'the control bus carries signals such as READ and WRITE from the control unit',
};
export function judgeBus(trace: BusTrace): Verdict {
  if (trace.failure) {
    const { link, needed, got } = trace.failure;
    const frame = trace.frames[trace.failure.at]!.frame;
    return { ok: false, title: 'Transfer lost on ' + link, detail: `${frame.description} That transfer is a ${needed} transfer, but the ${link} socket is ${got ? 'wired to the ' + got + ' bus' : 'not connected'}. Remember: ${busRole[needed]}.` };
  }
  if (trace.machine.error) return { ok: false, title: 'Controller fault', detail: trace.machine.error };
  if (trace.machine.memory[15] === 1) return { ok: true, title: 'Bridge extended', detail: 'Every transfer reached RAM on the right bus: addresses on the address bus, values on the data bus in both directions, and READ/WRITE on the control bus.' };
  return { ok: false, title: 'Bridge latch empty', detail: 'The program halted without storing 1 in the latch.' };
}

/* ───────────────────────── 4 · Processor Chamber: the corrupted branch ───────────────────────── */
export const CHAMBER_SOURCE = `; Turbine sequencer — spin once per count, then stop
LOOP: LDA 1100
      SUB 1101
      STA 1100
      BRZ 0101
      BRA 1100
DONE: HLT
.ORG 1100
COUNT: DAT 3
ONE:   DAT 1`;
export const chamberImage = (): AssemblyImage => assemble(CHAMBER_SOURCE);
export function judgeChamber(m: Machine, initialCount = 3): Verdict {
  if (m.error) {
    const pcHint = /data value at (\d{4})/.exec(m.error);
    return { ok: false, title: 'Sequencer crashed', detail: m.error + (pcHint ? ` The PC was sent to ${pcHint[1]}, which holds data, not an instruction. Look at the CIR to see which instruction changed the PC.` : '') };
  }
  if (!m.halted) return { ok: false, title: 'Still running', detail: 'The sequencer has not reached HLT yet.' };
  if (m.memory[12] === 0 && m.instructions > initialCount * 2) return { ok: true, title: 'Turbines online', detail: 'Each pass loads COUNT, subtracts 1, stores it, and BRZ checks for zero. The repaired BRA now sends the PC back to 0000 — an instruction — instead of 1100, a data cell.' };
  if (m.memory[12] === 0) return { ok: true, title: 'Turbines online (unorthodox)', detail: 'COUNT reached zero, though not by looping. It works — but the original design spins the turbine once per pass. Try restoring the loop to see why BRA needs an instruction address.' };
  return { ok: false, title: 'Turbines stalled', detail: 'The program halted but COUNT is still ' + m.memory[12] + '. The loop must run until COUNT reaches 0.' };
}

/* ───────────────────────── 5 · The Core: write the restart program ───────────────────────── */
export const CORE_TARGET = 40;
export const CORE_SLOTS = 6;
/** RAM 1100..1111 are fixed by the Core; the player owns 0000..0101. */
export function coreImage(program: number[]): AssemblyImage {
  const words = Array.from({ length: 16 }, () => 0);
  const kinds: CellKind[] = Array.from({ length: 16 }, () => 'empty');
  program.slice(0, CORE_SLOTS).forEach((w, i) => { words[i] = w; kinds[i] = 'instruction'; });
  words[12] = 120; kinds[12] = 'data';
  words[13] = 80; kinds[13] = 'data';
  words[14] = 0; kinds[14] = 'data';
  words[15] = 0; kinds[15] = 'data';
  return imageFrom(words, kinds, 0);
}
export const defaultCoreProgram = (): number[] => Array.from({ length: CORE_SLOTS }, () => encode('HLT', 0));
export function judgeCore(m: Machine): Verdict {
  if (m.error) return { ok: false, title: 'Core rejected the program', detail: m.error };
  if (!m.halted) return { ok: false, title: 'Still running', detail: 'The Core is still executing.' };
  const ignition = m.memory[15]!;
  if (ignition === CORE_TARGET) return { ok: true, title: 'IGNITION accepted', detail: 'Your program fetched each instruction, decoded it in the control unit, used the ALU to compute 120 − 80 and stored 40 at 1111. The Core is executing again.' };
  const hints: string[] = [];
  if (ignition === 0) hints.push('Nothing was stored in 1111 — is there an STA 1111?');
  if (ignition === 200) hints.push('200 is 120 + 80. Which operation gives 40?');
  if (ignition === 12 || ignition === 13) hints.push('The value ' + ignition + ' is an address, not the data stored there. LDA/ADD/SUB fetch the contents of their operand address.');
  if (ignition === (256 - 40)) hints.push('216 is 80 − 120 wrapped around 8 bits. Which value should be in the ACC first?');
  return { ok: false, title: 'IGNITION refused', detail: `1111 holds ${ignition} (${binary8(ignition)}); the Core needs ${CORE_TARGET} (${binary8(CORE_TARGET)}). ${hints.join(' ')}`.trim() };
}

/* ───────────────────────── shared helpers ───────────────────────── */
export const REGISTERS: Register[] = ['PC', 'MAR', 'MDR', 'CIR', 'ACC', 'ALU', 'CU', 'RAM'];
export function registerValue(m: Machine, r: Register): string {
  switch (r) {
    case 'PC': return binary4(m.pc);
    case 'MAR': return binary4(m.mar);
    case 'MDR': return binary8(m.mdr);
    case 'CIR': return binary8(m.cir);
    case 'ACC': return binary8(m.acc);
    case 'ALU': return binary8(m.alu);
    case 'CU': return m.frame.phase.toUpperCase();
    case 'RAM': return m.frame.signal ?? '—';
  }
}
export function currentInstruction(m: Machine): string {
  if (m.micro >= 7 || m.frame.phase === 'decode' || m.frame.phase === 'execute' || m.frame.phase === 'halted') return disassemble(m.cir);
  return '—';
}
export { binary4, binary8, boot, step };
export type { Machine, Register, Mnemonic };
