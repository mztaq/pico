/** Context-sensitive machine interfaces opened with E in the world. */
import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Cpu, X } from 'lucide-react';
import { binary4, binary8, BUS_LINKS, CORE_SLOTS, CORE_TARGET, EXTERNAL_BUSES, traceBus, VAULT_TARGET, type PuzzleId } from '../sim/puzzles';
import type { GameState, GameStore, PanelId } from '../state/store';
import { LOGS } from '../story/script';
import { BUS_CLASS, ByteEditor, Controls, HintBox, InstructionEditor, MicroOp, RamTable, Registers, StageTrack, VerdictBox } from './MachineUI';

export function PanelHost({ store, s }: { store: GameStore; s: GameState }) {
  const panel = s.panel!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,select,textarea')) return;
      const id = panel as PuzzleId;
      if (!['workshop', 'vault', 'bus', 'chamber', 'core'].includes(panel) || !store.isUnlocked(id)) return;
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); store.stepMachine(id); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); if (store.get().running) store.stop(); else store.run(id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel, store]);
  if (panel.startsWith('log:')) return <LogPanel store={store} id={panel.slice(4)} />;
  if (panel.startsWith('pillar:')) return <PillarPanel store={store} s={s} address={Number(panel.slice(7))} />;
  const id = panel as PuzzleId;
  if (!store.isUnlocked(id)) return <Shell store={store} title="No power" kicker="Machine offline"><p className="cl-lede">This machine has no power yet. Something upstream still needs repairing.</p></Shell>;
  switch (id) {
    case 'workshop': return <WorkshopPanel store={store} s={s} />;
    case 'vault': return <VaultPanel store={store} s={s} />;
    case 'bus': return <BusPanel store={store} s={s} />;
    case 'chamber': return <ChamberPanel store={store} s={s} />;
    case 'core': return <CorePanel store={store} s={s} />;
  }
}

function Shell({ store, title, kicker, children, wide, onBack }: { store: GameStore; title: string; kicker: string; children: ReactNode; wide?: boolean; onBack?: () => void }) {
  return <div className="cl-overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => { if (e.target === e.currentTarget) store.closePanel(); }}>
    <section className={'cl-panel' + (wide ? ' is-wide' : '')}>
      <header className="cl-panel-head">
        {onBack && <button className="cl-icon" onClick={onBack} aria-label="Back"><ArrowLeft size={18} /></button>}
        <div><span className="cl-kicker">{kicker}</span><h2>{title}</h2></div>
        <button className="cl-icon" onClick={() => store.closePanel()} aria-label="Close (Esc)"><X size={18} /></button>
      </header>
      <div className="cl-panel-body">{children}</div>
    </section>
  </div>;
}

function Prediction({ store, s }: { store: GameStore; s: GameState }) {
  if (s.prediction) return <div className="cl-predict" role="alertdialog" aria-label="Predict">
    <span className="cl-kicker">Predict before you step</span>
    <p>{s.prediction.question}</p>
    <div className="cl-predict-options">{s.prediction.options.map((o, i) => <button key={i} className="cl-btn" onClick={() => store.answer(i)}>{o}</button>)}</div>
  </div>;
  if (s.predictionResult) return <div className={'cl-predict ' + (s.predictionResult.correct ? 'is-good' : 'is-bad')}>
    <b>{s.predictionResult.correct ? 'Correct — now watch it happen.' : 'Not quite — step on and watch what really happens.'}</b>
    <p>{s.predictionResult.explain}</p>
    <button className="cl-link" onClick={() => store.dismissPrediction()}>Got it</button>
  </div>;
  return null;
}

function MachineView({ store, s, id, children, ram }: { store: GameStore; s: GameState; id: PuzzleId; children?: ReactNode; ram?: ReactNode }) {
  const m = s.machines[id];
  return <div className="cl-machine">
    <div className="cl-machine-main">
      <StageTrack m={m} />
      <MicroOp m={m} />
      <Prediction store={store} s={s} />
      <Registers m={m} />
      <Controls store={store} id={id} m={m} running={s.running === id} />
      <VerdictBox v={s.verdicts[id]} />
      {children}
      <HintBox store={store} id={id} />
    </div>
    <aside className="cl-machine-side">{ram}</aside>
  </div>;
}

function WorkshopPanel({ store, s }: { store: GameStore; s: GameState }) {
  const m = s.machines.workshop;
  return <Shell store={store} title="Door controller" kicker="Workshop · frozen mid-fetch" wide>
    <p className="cl-lede">The controller stopped three micro-operations into fetching its first instruction. Step it forward one micro-operation at a time and follow the values on the wall boards.</p>
    <MachineView store={store} s={s} id="workshop" ram={<RamTable m={m} caption="Controller RAM" highlight={[14, 15]} />} />
  </Shell>;
}

function VaultPanel({ store, s }: { store: GameStore; s: GameState }) {
  const m = s.machines.vault;
  return <Shell store={store} title="Vault controller" kicker="Memory Vault" wide>
    <p className="cl-lede">The lock opens when address <code>1110</code> holds <code>{binary8(VAULT_TARGET)}</code> ({VAULT_TARGET}). The controller program runs every time you press Run. You can edit RAM here or at each pillar.</p>
    <MachineView store={store} s={s} id="vault" ram={<>
      <RamTable m={m} caption="Vault RAM" editable={() => !s.running} onEdit={(a, v) => store.editVault(a, v)} highlight={[12, 13, 14]} />
      <button className="cl-btn is-ghost" onClick={() => store.restoreVault()}>Restore factory image</button>
    </>} />
  </Shell>;
}

function PillarPanel({ store, s, address }: { store: GameStore; s: GameState; address: number }) {
  if (!store.isUnlocked('vault')) return <Shell store={store} title={'RAM ' + binary4(address)} kicker="Memory pillar"><p className="cl-lede">The pillar is dark. The vault has no power until the workshop controller finishes.</p></Shell>;
  const m = s.machines.vault, kind = m.kind[address]!, v = m.memory[address]!;
  const solved = s.progress.solved.vault;
  return <Shell store={store} title={'Address ' + binary4(address)} kicker={'Memory pillar · ' + kind}>
    <div className="cl-pillar">
      <div className="cl-pillar-id"><span>Address (which box)</span><code>{binary4(address)}</code><small>= {address} — fixed, never changes</small></div>
      <div className="cl-pillar-id"><span>Contents (what is in the box)</span><code>{kind === 'empty' ? '········' : binary8(v)}</code><small>{kind === 'instruction' ? 'instruction: ' + (m.initial.memory[address]?.text || '') : kind === 'data' ? '= ' + v : 'empty'}</small></div>
    </div>
    {kind === 'data' && !solved && <><p className="cl-note">Change the bits stored here. The address stays the same — only the data changes.</p><ByteEditor value={v} onChange={x => store.editVault(address, x)} /></>}
    {kind === 'instruction' && <><p className="cl-note">This pillar stores part of the program. Changing it changes what the CPU will do. Edit with care.</p>{!solved && <InstructionEditor word={v} onChange={w => store.editVault(address, w)} />}</>}
    {solved && <p className="cl-note is-good">Vault sealed in its repaired state.</p>}
    <div className="cl-controls"><button className="cl-btn is-primary" onClick={() => store.openPanel('vault')}><Cpu size={16} /> Open vault controller</button></div>
  </Shell>;
}

function BusPanel({ store, s }: { store: GameStore; s: GameState }) {
  const routing = s.progress.busRouting;
  const preview = traceBus(routing);
  const shown = s.machines.bus.cycles;
  const transfers = preview.frames.slice(0, Math.max(shown, 0)).map(f => f.frame).filter(f => f.transfer && f.transfer.bus !== 'internal');
  return <Shell store={store} title="Bus junction" kicker="Bus Bridge" wide>
    <p className="cl-lede">The bridge controller runs <code>LDA 1110 · STA 1111 · HLT</code>. Every transfer between the CPU and RAM passes through one of these four sockets. Wire each socket to a bus, then run the controller.</p>
    <div className="cl-sockets">
      {BUS_LINKS.map(link => <div key={link} className="cl-socket">
        <span className="cl-socket-name">{link}</span>
        <div className="cl-seg" role="radiogroup" aria-label={link + ' bus'}>
          {EXTERNAL_BUSES.map(b => <button key={b} role="radio" aria-checked={routing[link] === b} className={(routing[link] === b ? 'is-on ' : '') + BUS_CLASS[b]} onClick={() => store.route(link, routing[link] === b ? null : b)} disabled={!!s.running || s.progress.solved.bus}>{b}</button>)}
        </div>
      </div>)}
    </div>
    <div className="cl-machine">
      <div className="cl-machine-main">
        <StageTrack m={s.machines.bus} />
        <MicroOp m={s.machines.bus} />
        <Registers m={s.machines.bus} />
        <Controls store={store} id="bus" m={s.machines.bus} running={s.running === 'bus'} />
        <VerdictBox v={s.verdicts.bus} />
        <HintBox store={store} id="bus" />
      </div>
      <aside className="cl-machine-side">
        <h3 className="cl-sub">Transfer log</h3>
        <ol className="cl-log">{transfers.length ? transfers.map((f, i) => <li key={i}><span className={'cl-chip ' + BUS_CLASS[f.transfer!.bus]}>{f.transfer!.bus}</span> {f.transfer!.from} → {f.transfer!.to} <code>{f.transfer!.value}</code></li>) : <li className="cl-muted">No external transfers yet.</li>}</ol>
      </aside>
    </div>
  </Shell>;
}

function ChamberPanel({ store, s }: { store: GameStore; s: GameState }) {
  const m = s.machines.chamber;
  return <Shell store={store} title="Turbine sequencer" kicker="Processor Chamber" wide>
    <p className="cl-lede">The sequencer should spin the turbines once per count until <code>COUNT</code> (address <code>1100</code>) reaches zero. Every run ends in a fault. Watch the PC and the CIR in the chamber — then repair the program.</p>
    <MachineView store={store} s={s} id="chamber" ram={<>
      <RamTable m={m} caption="Sequencer RAM" editable={a => a < 6 && !s.running && !s.progress.solved.chamber} lockData onEdit={(a, w) => store.editChamber(a, w)} />
      <button className="cl-btn is-ghost" onClick={() => store.restoreChamber()} disabled={s.progress.solved.chamber}>Restore original listing</button>
    </>} />
  </Shell>;
}

function CorePanel({ store, s }: { store: GameStore; s: GameState }) {
  const m = s.machines.core, solved = s.progress.solved.core;
  return <Shell store={store} title="Core ignition" kicker="The Core" wide>
    <p className="cl-lede">Program memory <code>0000–0101</code> is yours. Data memory is sealed: <b>FUEL</b> <code>1100</code> = 120, <b>DAMPER</b> <code>1101</code> = 80. Store <b>{CORE_TARGET}</b> in <b>IGNITION</b> <code>1111</code>, then halt.</p>
    <div className="cl-core-prog">
      {Array.from({ length: CORE_SLOTS }, (_, i) => <div key={i} className={'cl-core-slot' + (i === m.pc && !m.halted ? ' is-pc' : '')}>
        <code className="cl-addr">{binary4(i)}</code>
        {solved ? <code>{m.initial.memory[i]?.text}</code> : <InstructionEditor word={s.progress.coreProgram[i]!} onChange={w => store.setCore(i, w)} />}
      </div>)}
    </div>
    <MachineView store={store} s={s} id="core" ram={<RamTable m={m} caption="Core RAM" highlight={[12, 13, 15]} />} />
  </Shell>;
}

function LogPanel({ store, id }: { store: GameStore; id: string }) {
  const log = LOGS.find(l => l.id === id);
  if (!log) return null;
  return <Shell store={store} title={log.title} kicker={'Recovered record · ' + log.room}>
    <article className="cl-record">
      <p>{log.text}</p>
      <footer>— {log.author}</footer>
      {log.reveals && <aside className="cl-reveal"><BookOpen size={15} /> <span>{log.reveals}</span></aside>}
    </article>
  </Shell>;
}

export type { PanelId };
