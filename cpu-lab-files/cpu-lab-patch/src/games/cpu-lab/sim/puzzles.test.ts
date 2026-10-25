import { describe, expect, it } from 'vitest';
import { boot, step } from '../../../cpu/engine';
import {
  BUS_LINKS, chamberImage, coreImage, defaultCoreProgram, disassemble, emptyRouting, encode, judgeBus, judgeChamber, judgeCore,
  judgeVault, judgeWorkshop, registerValue, runMachine, traceBus, vaultImage, workshopMachine, type Routing,
} from './puzzles';

describe('CPU Lab · fetch micro-operations (shared engine)', () => {
  it('copies PC→MAR, reads RAM→MDR, loads CIR and increments PC in IGCSE order', () => {
    let m = boot(vaultImage());
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) { m = step(m); seen.push(m.frame.description); }
    expect(seen[1]).toMatch(/Copy PC into MAR/);
    expect(seen[3]).toMatch(/READ/);
    expect(seen[4]).toMatch(/to MDR/);
    expect(seen[5]).toMatch(/Copy MDR into CIR/);
    expect(seen[6]).toMatch(/Increment/);
    expect(m.frame.phase).toBe('decode');
    expect(m.pc).toBe(1); expect(m.mar).toBe(0); expect(disassemble(m.cir)).toBe('LDA 1100');
  });
  it('is deterministic for identical inputs', () => {
    const a = runMachine(boot(chamberImage())), b = runMachine(boot(chamberImage()));
    expect(a).toEqual(b);
  });
  it('exposes register displays that match the machine state', () => {
    const m = runMachine(boot(vaultImage()));
    expect(registerValue(m, 'ACC')).toBe('00000100');
    expect(registerValue(m, 'PC')).toBe('0100');
  });
});

describe('Workshop puzzle', () => {
  it('starts frozen mid-fetch and opens the latch when stepped to HLT', () => {
    const start = workshopMachine();
    expect(start.micro).toBe(3);
    expect(start.frame.transfer?.bus).toBe('address');
    expect(judgeWorkshop(start).ok).toBe(false);
    expect(judgeWorkshop(runMachine(start)).ok).toBe(true);
  });
});

describe('Memory Vault puzzle', () => {
  it('fails with the factory corruption and explains the arithmetic', () => {
    const v = judgeVault(runMachine(boot(vaultImage())));
    expect(v.ok).toBe(false); expect(v.detail).toMatch(/4 \+ 0/);
  });
  it('opens when the calibration data cell holds 5', () => {
    const image = vaultImage(); image.memory[13]!.value = 5;
    expect(judgeVault(runMachine(boot(image))).ok).toBe(true);
  });
  it('cannot be faked by writing the lock cell directly (STA overwrites it)', () => {
    const image = vaultImage(); image.memory[14]!.value = 9;
    expect(judgeVault(runMachine(boot(image))).ok).toBe(false);
  });
  it('reports a recoverable fault when an instruction cell is corrupted', () => {
    const image = vaultImage(); image.memory[1]!.value = 0b1111_0000;
    const v = judgeVault(runMachine(boot(image)));
    expect(v.ok).toBe(false); expect(v.detail).toMatch(/Unknown opcode/);
  });
});

describe('Bus Bridge puzzle', () => {
  const correct: Routing = { 'MAR→RAM': 'address', 'CU→RAM': 'control', 'RAM→MDR': 'data', 'MDR→RAM': 'data' };
  it('fails at the very first external transfer when nothing is wired', () => {
    const t = traceBus(emptyRouting());
    expect(t.failure?.link).toBe('MAR→RAM');
    expect(judgeBus(t).ok).toBe(false);
  });
  it('rejects sending READ along the data bus', () => {
    const t = traceBus({ ...correct, 'CU→RAM': 'data' });
    expect(t.failure).toMatchObject({ link: 'CU→RAM', needed: 'control', got: 'data' });
    expect(judgeBus(t).detail).toMatch(/control bus/);
  });
  it('rejects a write without a data path back to RAM', () => {
    const t = traceBus({ ...correct, 'MDR→RAM': 'address' });
    expect(t.failure).toMatchObject({ link: 'MDR→RAM', needed: 'data' });
  });
  it('extends the bridge with correct routing and uses every link', () => {
    const t = traceBus(correct);
    expect(judgeBus(t).ok).toBe(true);
    const used = new Set(t.frames.map(f => f.frame.transfer).filter(x => x && x.bus !== 'internal').map(x => x!.from + '→' + x!.to));
    expect([...used].sort()).toEqual([...BUS_LINKS].sort());
  });
});

describe('Processor Chamber puzzle', () => {
  it('crashes because the corrupted BRA sends the PC into a data cell', () => {
    const m = runMachine(boot(chamberImage()));
    expect(m.error).toMatch(/data value at 1100/);
    expect(judgeChamber(m).detail).toMatch(/CIR/);
  });
  it('completes the loop once the branch target is repaired', () => {
    const image = chamberImage(); image.memory[4]!.value = encode('BRA', 0);
    const m = runMachine(boot(image));
    expect(m.error).toBeNull(); expect(m.memory[12]).toBe(0);
    expect(judgeChamber(m).ok).toBe(true); expect(judgeChamber(m).title).toBe('Turbines online');
  });
  it('detects an infinite loop', () => {
    const image = chamberImage(); image.memory[3]!.value = encode('BRA', 0);
    expect(runMachine(boot(image), 300).error).toMatch(/Execution limit/);
  });
});

describe('Core puzzle', () => {
  const prog = (...ops: [Parameters<typeof encode>[0], number][]) => { const p = defaultCoreProgram(); ops.forEach(([m, o], i) => { p[i] = encode(m, o); }); return p; };
  it('accepts LDA 1100 / SUB 1101 / STA 1111 / HLT', () => {
    const m = runMachine(boot(coreImage(prog(['LDA', 12], ['SUB', 13], ['STA', 15], ['HLT', 0]))));
    expect(m.memory[15]).toBe(40); expect(judgeCore(m).ok).toBe(true);
  });
  it('explains adding instead of subtracting', () => {
    const v = judgeCore(runMachine(boot(coreImage(prog(['LDA', 12], ['ADD', 13], ['STA', 15], ['HLT', 0])))));
    expect(v.ok).toBe(false); expect(v.detail).toMatch(/120 \+ 80/);
  });
  it('explains confusing an address with its contents', () => {
    const v = judgeCore(runMachine(boot(coreImage(prog(['LDI', 12], ['STA', 15], ['HLT', 0])))));
    expect(v.detail).toMatch(/address, not the data/);
  });
  it('explains reversed operands (8-bit wrap-around)', () => {
    const v = judgeCore(runMachine(boot(coreImage(prog(['LDA', 13], ['SUB', 12], ['STA', 15], ['HLT', 0])))));
    expect(v.detail).toMatch(/wrapped/);
  });
  it('resets to the identical initial state after boot', () => {
    const image = coreImage(defaultCoreProgram());
    const ran = runMachine(boot(image));
    expect(boot(ran.initial)).toEqual(boot(image));
  });
});
