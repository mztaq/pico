/** Shared machine-interface pieces: registers, stage track, RAM table, controls, hints, verdicts. */
import { useState, type ReactNode } from 'react';
import { Lightbulb, Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import type { Bus } from '../../../cpu/engine';
import { binary4, binary8, currentInstruction, disassemble, encode, MNEMONICS, registerValue, type Machine, type Mnemonic, type PuzzleId, type Register, type Verdict } from '../sim/puzzles';
import { decode } from '../../../cpu/assembler';
import type { GameStore } from '../state/store';
import { HINTS } from '../story/script';

export const BUS_CLASS: Record<Bus, string> = { address: 'bus-address', data: 'bus-data', control: 'bus-control', internal: 'bus-internal' };

export function StageTrack({ m }: { m: Machine }) {
  const phase = m.frame.phase;
  const stages = ['fetch', 'decode', 'execute'] as const;
  return <ol className="cl-stages" aria-label="Execution stage">
    {stages.map(s => <li key={s} className={phase === s ? 'is-on' : ''} aria-current={phase === s ? 'step' : undefined}>{s}</li>)}
    {(phase === 'halted' || phase === 'error') && <li className={phase === 'error' ? 'is-bad' : 'is-done'}>{phase}</li>}
  </ol>;
}

export function MicroOp({ m }: { m: Machine }) {
  const t = m.frame.transfer;
  return <div className={'cl-microop' + (m.error ? ' is-error' : '')} aria-live="polite">
    <p>{m.frame.description}</p>
    {t && <span className={'cl-chip ' + BUS_CLASS[t.bus]}>{t.from} → {t.to} · {t.bus} bus · {t.value}</span>}
    {m.frame.signal && <span className="cl-chip bus-control">signal {m.frame.signal}</span>}
  </div>;
}

const REGS: Register[] = ['PC', 'MAR', 'MDR', 'CIR', 'ACC', 'ALU'];
export function Registers({ m }: { m: Machine }) {
  const active = new Set(m.frame.active);
  return <div className="cl-registers">
    {REGS.map(r => <div key={r} className={'cl-reg' + (active.has(r) ? ' is-active' : '')}>
      <span className="cl-reg-name">{r}</span>
      <code>{registerValue(m, r)}</code>
      {r === 'CIR' && <small>{currentInstruction(m)}</small>}
      {(r === 'ACC' || r === 'ALU' || r === 'MDR') && <small>= {r === 'ACC' ? m.acc : r === 'ALU' ? m.alu : m.mdr}</small>}
    </div>)}
  </div>;
}

export function RamTable({ m, editable, onEdit, highlight, caption, lockData }: { m: Machine; editable?: (address: number) => boolean; onEdit?: (address: number, value: number) => void; highlight?: number[]; caption?: string; lockData?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return <div className="cl-ram" role="table" aria-label={caption ?? 'RAM'}>
    <div className="cl-ram-head" role="row"><span role="columnheader">Addr</span><span role="columnheader">Contents</span><span role="columnheader">Meaning</span></div>
    {m.memory.map((v, i) => {
      const kind = m.kind[i]!, can = !!editable?.(i) && !(lockData && kind === 'data');
      const classes = ['cl-ram-row', 'kind-' + kind, i === m.pc && !m.halted ? 'is-pc' : '', i === m.mar && m.frame.address === i && m.frame.transfer ? 'is-mar' : '', highlight?.includes(i) ? 'is-hl' : ''].join(' ');
      return <div key={i} className={classes} role="row">
        <code role="cell" className="cl-addr">{binary4(i)}</code>
        <code role="cell">{kind === 'empty' ? '········' : binary8(v)}</code>
        <span role="cell" className="cl-meaning">{kind === 'instruction' ? disassemble(v) : kind === 'data' ? 'data ' + v : 'empty'}
          {can && <button className="cl-link" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{open === i ? 'done' : 'edit'}</button>}
        </span>
        {open === i && can && onEdit && <div className="cl-ram-edit" role="cell">{kind === 'instruction' ? <InstructionEditor word={v} onChange={w => onEdit(i, w)} /> : <ByteEditor value={v} onChange={x => onEdit(i, x)} />}</div>}
      </div>;
    })}
  </div>;
}

export function ByteEditor({ value, onChange, label = 'Value' }: { value: number; onChange: (v: number) => void; label?: string }) {
  return <div className="cl-byte" role="group" aria-label={label + ' bits'}>
    {Array.from({ length: 8 }, (_, k) => 7 - k).map(bit => {
      const on = (value >> bit) & 1;
      return <button key={bit} className={'cl-bit' + (on ? ' is-on' : '')} aria-pressed={!!on} aria-label={'bit ' + bit + ' (value ' + (1 << bit) + ')'} onClick={() => onChange(value ^ (1 << bit))}>
        <b>{on}</b><small>{1 << bit}</small>
      </button>;
    })}
    <label className="cl-dec">= <input type="number" min={0} max={255} value={value} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 255) onChange(n); }} aria-label={label + ' in denary'} /></label>
  </div>;
}

export function InstructionEditor({ word, onChange }: { word: number; onChange: (w: number) => void }) {
  let mnemonic: Mnemonic = 'HLT', operand = 0, valid = true;
  try { const d = decode(word); mnemonic = d.mnemonic; operand = d.operand; } catch { valid = false; }
  return <div className="cl-instr">
    {!valid && <span className="cl-bad">Unknown opcode {binary4(word >> 4)}</span>}
    <select aria-label="Opcode" value={mnemonic} onChange={e => onChange(encode(e.target.value as Mnemonic, operand))}>
      {MNEMONICS.map(m => <option key={m} value={m}>{m} ({binary4(encode(m, 0) >> 4)})</option>)}
    </select>
    {mnemonic !== 'HLT' && <select aria-label="Operand" value={operand} onChange={e => onChange(encode(mnemonic, Number(e.target.value)))}>
      {Array.from({ length: 16 }, (_, i) => <option key={i} value={i}>{binary4(i)}{mnemonic === 'LDI' ? ' (value ' + i + ')' : ' (address)'}</option>)}
    </select>}
    <code className="cl-word">{binary8(word)}</code>
  </div>;
}

export function Controls({ store, id, m, running, extra }: { store: GameStore; id: PuzzleId; m: Machine; running: boolean; extra?: ReactNode }) {
  return <div className="cl-controls">
    <button className="cl-btn" onClick={() => store.stepMachine(id)} disabled={running || (m.halted && id !== 'bus')}><StepForward size={16} /> Step <kbd>S</kbd></button>
    {running
      ? <button className="cl-btn is-primary" onClick={() => store.stop()}><Pause size={16} /> Pause</button>
      : <button className="cl-btn is-primary" onClick={() => store.run(id)}><Play size={16} /> {m.halted ? 'Run again' : 'Run'} <kbd>R</kbd></button>}
    <button className="cl-btn" onClick={() => store.resetMachine(id)} disabled={running}><RotateCcw size={16} /> Reset</button>
    {extra}
  </div>;
}

export function HintBox({ store, id }: { store: GameStore; id: PuzzleId }) {
  const [shown, setShown] = useState<string[]>(() => HINTS[id].slice(0, store.get().progress.hintsUsed[id]));
  const labels = ['Where should I look?', 'What principle applies?', 'Walk me through it'];
  return <div className="cl-hints">
    <button className="cl-btn is-ghost" onClick={() => { const h = store.hint(id); setShown(s => s.includes(h) ? s : [...s, h]); }} disabled={shown.length >= 3}>
      <Lightbulb size={15} /> {shown.length >= 3 ? 'All hints shown' : labels[shown.length]}
    </button>
    {shown.map((h, i) => <p key={i} className="cl-hint"><b>Hint {i + 1}</b> {h}</p>)}
  </div>;
}

export function VerdictBox({ v }: { v?: Verdict }) {
  if (!v) return null;
  return <div className={'cl-verdict ' + (v.ok ? 'is-good' : 'is-bad')} role="status"><b>{v.title}</b><p>{v.detail}</p></div>;
}
