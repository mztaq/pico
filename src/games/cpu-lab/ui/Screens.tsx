/** Menus, saves, settings, journal, map, HUD and ending. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Copy, Download, FolderOpen, Gamepad2, Home, Keyboard, Map as MapIcon, Pause, Pencil, Play, Plus, Save, Settings2, Trash2, X } from 'lucide-react';
import type { GameState, GameStore } from '../state/store';
import { summarize, MAX_SLOTS, type SaveSlot } from '../state/save';
import { CONCEPTS, LOGS, OBJECTIVES, OPENING } from '../story/script';
import { PUZZLE_ORDER } from '../sim/puzzles';
import { CORRIDORS, DOORS, ROOMS, INTERACTABLES } from '../world/layout';

const ago = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return new Date(t).toLocaleDateString();
};

function Modal({ title, kicker, onClose, children, wide }: { title: string; kicker?: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="cl-overlay is-menu" role="dialog" aria-modal="true" aria-label={title}>
    <section className={'cl-panel' + (wide ? ' is-wide' : '')}>
      <header className="cl-panel-head">
        <div>{kicker && <span className="cl-kicker">{kicker}</span>}<h2>{title}</h2></div>
        {onClose && <button className="cl-icon" onClick={onClose} aria-label="Close (Esc)"><X size={18} /></button>}
      </header>
      <div className="cl-panel-body">{children}</div>
    </section>
  </div>;
}

/* ───────── main menu ───────── */
export function MainMenu({ store, s, onHome, webgl }: { store: GameStore; s: GameState; onHome: () => void; webgl: boolean }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const recent = s.slots.find(x => x.id === s.activeSlot) ?? s.slots[0];
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return <div className="cl-menu">
    <div className="cl-menu-card">
      <span className="cl-kicker">Pico Games · 01</span>
      <h1 className="cl-title">CPU LAB<small>The Last Instruction</small></h1>
      <p className="cl-tagline">The Archive's Core froze mid-instruction. Explore the facility, repair its processor, and finish what it started.</p>
      {!webgl && <p className="cl-warn" role="alert">Your browser could not start WebGL, so the 3D facility can't run here. Try another browser or enable hardware acceleration.</p>}
      {naming ? <form className="cl-name" onSubmit={e => { e.preventDefault(); store.newGame(name || 'Apprentice run'); }}>
        <label htmlFor="cl-save-name">Name this save</label>
        <input id="cl-save-name" autoFocus maxLength={40} placeholder="Apprentice run" value={name} onChange={e => setName(e.target.value)} />
        <div className="cl-row"><button type="button" className="cl-btn" onClick={() => setNaming(false)}>Cancel</button><button className="cl-btn is-primary" disabled={!webgl}><Play size={16} /> Begin</button></div>
      </form> : <nav className="cl-menu-list" aria-label="Main menu">
        {recent && <button ref={first} className="cl-menu-item is-primary" onClick={() => store.continueGame()} disabled={!webgl}><Play size={18} /><span>Continue<small>{recent.name} · {summarize(recent.progress).room} · {ago(recent.updatedAt)}</small></span></button>}
        <button ref={recent ? undefined : first} className={'cl-menu-item' + (recent ? '' : ' is-primary')} onClick={() => setNaming(true)} disabled={!webgl}><Plus size={18} /><span>New game</span></button>
        <button className="cl-menu-item" onClick={() => store.setPhase('saves')} disabled={!s.slots.length}><FolderOpen size={18} /><span>Load game<small>{s.slots.length} save{s.slots.length === 1 ? '' : 's'}</small></span></button>
        <button className="cl-menu-item" onClick={() => store.setPhase('settings')}><Settings2 size={18} /><span>Settings</span></button>
        <button className="cl-menu-item" onClick={() => store.setPhase('controls')}><Keyboard size={18} /><span>Controls</span></button>
        <button className="cl-menu-item" onClick={onHome}><Home size={18} /><span>Back to Pico</span></button>
      </nav>}
      <p className="cl-foot">Uses the same 8-bit teaching CPU as CPU Studio · Cambridge IGCSE Computer Science</p>
    </div>
  </div>;
}

/* ───────── opening ───────── */
export function Intro({ store }: { store: GameStore }) {
  const [i, setI] = useState(0);
  const next = () => { if (i < OPENING.length - 1) setI(i + 1); else store.beginPlay(); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); next(); } if (e.key === 'Escape') store.beginPlay(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });
  return <div className="cl-intro" onClick={next}>
    <p key={i} className="cl-intro-line">{OPENING[i]}</p>
    <div className="cl-intro-foot"><span>{i + 1} / {OPENING.length}</span><button className="cl-link" onClick={e => { e.stopPropagation(); store.beginPlay(); }}>Skip</button><span>Click or press Space</span></div>
  </div>;
}

/* ───────── pause ───────── */
export function PauseMenu({ store, s, onHome }: { store: GameStore; s: GameState; onHome: () => void }) {
  const slot = s.slots.find(x => x.id === s.activeSlot);
  return <Modal title="Paused" kicker={slot ? 'Playing “' + slot.name + '”' : undefined} onClose={() => store.setPhase('playing')}>
    <nav className="cl-menu-list" aria-label="Pause menu">
      <button autoFocus className="cl-menu-item is-primary" onClick={() => store.setPhase('playing')}><Play size={18} /><span>Resume</span></button>
      <button className="cl-menu-item" onClick={() => store.saveGame()}><Save size={18} /><span>Save<small>{s.lastSaved ? 'Last saved ' + ago(s.lastSaved) : 'Autosaves as you play'}</small></span></button>
      <button className="cl-menu-item" onClick={() => store.setPhase('saves')}><FolderOpen size={18} /><span>Save as / Load</span></button>
      <button className="cl-menu-item" onClick={() => store.setPhase('journal')}><BookOpen size={18} /><span>Journal</span></button>
      <button className="cl-menu-item" onClick={() => store.setPhase('map')}><MapIcon size={18} /><span>Map</span></button>
      <button className="cl-menu-item" onClick={() => store.setPhase('settings')}><Settings2 size={18} /><span>Settings</span></button>
      <button className="cl-menu-item" onClick={() => store.setPhase('controls')}><Keyboard size={18} /><span>Controls</span></button>
      <button className="cl-menu-item" onClick={() => store.quitToMenu()}><Gamepad2 size={18} /><span>Save &amp; quit to title</span></button>
      <button className="cl-menu-item" onClick={() => { store.saveNow(); onHome(); }}><Home size={18} /><span>Exit to Pico</span></button>
    </nav>
  </Modal>;
}

/* ───────── saves ───────── */
export function SavesScreen({ store, s }: { store: GameStore; s: GameState }) {
  const inGame = s.returnPhase !== 'menu';
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const exportSlot = (slot: SaveSlot) => {
    const blob = new Blob([JSON.stringify({ kind: 'pico-cpu-lab-save', slot }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = slot.name.replace(/[^\w-]+/g, '_') + '.cpulab.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return <Modal title={inGame ? 'Save & load' : 'Load game'} kicker={`${s.slots.length} / ${MAX_SLOTS} saves · stored in this browser`} onClose={() => store.back()} wide>
    {inGame && <form className="cl-name is-inline" onSubmit={e => { e.preventDefault(); if (store.saveAs(newName || 'Checkpoint')) setNewName(''); }}>
      <label htmlFor="cl-saveas">Save current game as a new save</label>
      <div className="cl-row"><input id="cl-saveas" maxLength={40} placeholder="e.g. Before the Core" value={newName} onChange={e => setNewName(e.target.value)} /><button className="cl-btn is-primary"><Save size={16} /> Save as</button></div>
    </form>}
    <ul className="cl-slots">
      {s.slots.map(slot => {
        const sum = summarize(slot.progress), active = slot.id === s.activeSlot;
        return <li key={slot.id} className={'cl-slot' + (active ? ' is-active' : '')}>
          <div className="cl-slot-meter" aria-hidden="true"><span style={{ width: sum.percent + '%' }} /></div>
          <div className="cl-slot-main">
            {editing === slot.id
              ? <form onSubmit={e => { e.preventDefault(); store.renameSlot(slot.id, draft); setEditing(null); }} className="cl-row"><input autoFocus aria-label="Save name" maxLength={40} value={draft} onChange={e => setDraft(e.target.value)} /><button className="cl-btn is-primary">Rename</button><button type="button" className="cl-btn" onClick={() => setEditing(null)}>Cancel</button></form>
              : <><b>{slot.name}</b>{active && <span className="cl-tag">current</span>}{sum.complete && <span className="cl-tag is-good">complete</span>}</>}
            <small>{sum.room} · {sum.solved}/{sum.total} systems restored · {slot.progress.logs.length}/{LOGS.length} records · saved {ago(slot.updatedAt)}</small>
          </div>
          <div className="cl-slot-actions">
            {confirm === slot.id
              ? <><span className="cl-muted">Delete forever?</span><button className="cl-btn is-danger" onClick={() => { store.deleteSlot(slot.id); setConfirm(null); }}>Delete</button><button className="cl-btn" onClick={() => setConfirm(null)}>Keep</button></>
              : <>
                <button className="cl-btn is-primary" onClick={() => store.loadSlot(slot.id)}><Play size={15} /> Load</button>
                <button className="cl-icon" title="Rename" aria-label={'Rename ' + slot.name} onClick={() => { setEditing(slot.id); setDraft(slot.name); }}><Pencil size={15} /></button>
                <button className="cl-icon" title="Duplicate" aria-label={'Duplicate ' + slot.name} onClick={() => store.duplicateSlot(slot.id)}><Copy size={15} /></button>
                <button className="cl-icon" title="Export" aria-label={'Export ' + slot.name} onClick={() => exportSlot(slot)}><Download size={15} /></button>
                <button className="cl-icon" title="Delete" aria-label={'Delete ' + slot.name} onClick={() => setConfirm(slot.id)}><Trash2 size={15} /></button>
              </>}
          </div>
        </li>;
      })}
      {!s.slots.length && <li className="cl-muted">No saves yet.</li>}
    </ul>
    <p className="cl-foot">Saves live in this browser's storage. Clearing site data removes them — export a save to keep a copy.</p>
  </Modal>;
}

/* ───────── settings & controls ───────── */
export function SettingsScreen({ store, s }: { store: GameStore; s: GameState }) {
  const st = s.settings;
  return <Modal title="Settings" onClose={() => store.back()}>
    <div className="cl-settings">
      <label>Mouse sensitivity <output>{st.sensitivity.toFixed(1)}×</output><input type="range" min={0.2} max={3} step={0.1} value={st.sensitivity} onChange={e => store.updateSettings({ sensitivity: Number(e.target.value) })} /></label>
      <label>Field of view <output>{st.fov}°</output><input type="range" min={50} max={90} step={1} value={st.fov} onChange={e => store.updateSettings({ fov: Number(e.target.value) })} /></label>
      <label>Volume <output>{Math.round(st.volume * 100)}%</output><input type="range" min={0} max={1} step={0.05} value={st.volume} onChange={e => store.updateSettings({ volume: Number(e.target.value) })} /></label>
      <label className="cl-check"><input type="checkbox" checked={st.invertY} onChange={e => store.updateSettings({ invertY: e.target.checked })} /> Invert vertical look</label>
      <label className="cl-check"><input type="checkbox" checked={st.reducedMotion} onChange={e => store.updateSettings({ reducedMotion: e.target.checked })} /> Reduce motion (no camera shake, calmer animation)</label>
      <fieldset className="cl-check-group"><legend>Graphics quality</legend>
        {([['auto', 'Auto — detect this computer and adapt resolution'], ['high', 'High — shadows, reflections, antialiasing'], ['balanced', 'Balanced — no shadows'], ['low', 'Low — for school / older computers']] as const).map(([q, label]) => <label key={q} className="cl-check"><input type="radio" name="cl-quality" checked={st.quality === q} onChange={() => store.updateSettings({ quality: q })} /> {label}</label>)}
        <small className="cl-muted">Resolution also lowers itself automatically if the frame rate drops.</small>
      </fieldset>
      <label className="cl-check"><input type="checkbox" checked={st.showFps} onChange={e => store.updateSettings({ showFps: e.target.checked })} /> Show frame rate</label>
      <p className="cl-muted">Sound follows Pico's sound toggle on the home screen.</p>
    </div>
  </Modal>;
}
export function ControlsScreen({ store }: { store: GameStore }) {
  const rows: [string, string][] = [['W A S D / arrows', 'Move (arrows ←→ turn)'], ['Mouse / drag', 'Look around (click the view to capture the mouse)'], ['Shift', 'Sprint'], ['E', 'Interact / inspect'], ['V', 'Toggle first-person view'], ['J or Tab', 'Journal'], ['M', 'Map'], ['F5', 'Quick save'], ['Esc', 'Pause / close'], ['S · R (in machines)', 'Step one micro-operation · Run / pause'], ['Space', 'Next line of dialogue']];
  return <Modal title="Controls" onClose={() => store.back()}>
    <dl className="cl-keys">{rows.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
  </Modal>;
}

/* ───────── journal ───────── */
export function Journal({ store, s }: { store: GameStore; s: GameState }) {
  const [tab, setTab] = useState<'objective' | 'records' | 'concepts' | 'model'>('objective');
  const current = PUZZLE_ORDER.find(id => !s.progress.solved[id]) ?? 'done';
  const obj = OBJECTIVES[current];
  return <Modal title="Journal" onClose={() => store.back()} wide>
    <div className="cl-tabs" role="tablist">{(['objective', 'records', 'concepts', 'model'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{t === 'model' ? 'CPU model' : t[0]!.toUpperCase() + t.slice(1)}</button>)}</div>
    {tab === 'objective' && <div className="cl-journal">
      <h3>{obj.title}</h3><p>{obj.detail}</p>
      <ol className="cl-progress">{PUZZLE_ORDER.map(id => <li key={id} className={s.progress.solved[id] ? 'is-done' : id === current ? 'is-now' : ''}>{OBJECTIVES[id].title}</li>)}</ol>
      <p className="cl-muted">Mistakes are part of debugging: {s.progress.mistakes} failed run{s.progress.mistakes === 1 ? '' : 's'} so far.</p>
    </div>}
    {tab === 'records' && <div className="cl-journal">
      {LOGS.filter(l => s.progress.logs.includes(l.id)).map(l => <article key={l.id} className="cl-record"><span className="cl-kicker">{l.room}</span><h3>{l.title}</h3><p>{l.text}</p><footer>— {l.author}</footer>{l.reveals && <aside className="cl-reveal"><BookOpen size={14} /> {l.reveals}</aside>}</article>)}
      <p className="cl-muted">{s.progress.logs.length} of {LOGS.length} records recovered.</p>
    </div>}
    {tab === 'concepts' && <div className="cl-journal">
      {CONCEPTS.filter(c => s.progress.concepts.includes(c.id)).map(c => <details key={c.id} className="cl-concept"><summary><b>{c.term}</b> — {c.short}</summary><p>{c.detail}</p></details>)}
      {!s.progress.concepts.length && <p className="cl-muted">Concepts appear here as you repair each system.</p>}
    </div>}
    {tab === 'model' && <div className="cl-journal">
      <h3>The teaching CPU</h3>
      <p>The same simplified machine as Pico's CPU Studio: an 8-bit accumulator CPU with 16 RAM addresses (<code>0000</code>–<code>1111</code>). Every instruction is one byte — a 4-bit opcode and a 4-bit operand.</p>
      <table className="cl-isa"><tbody>
        {[['LDA a', '0000', 'ACC ← contents of address a'], ['STA a', '0001', 'address a ← ACC'], ['ADD a', '0010', 'ACC ← ACC + contents of a'], ['HLT', '0011', 'stop'], ['SUB a', '0100', 'ACC ← ACC − contents of a'], ['BRA a', '0101', 'PC ← a'], ['BRZ a', '0110', 'if ACC = 0 then PC ← a'], ['LDI n', '0111', 'ACC ← n (the operand itself)']].map(r => <tr key={r[0]}><td><code>{r[0]}</code></td><td><code>{r[1]}</code></td><td>{r[2]}</td></tr>)}
      </tbody></table>
      <p className="cl-muted">Simplifications: one bus transfer per micro-step, no cache or clock speed, and arithmetic wraps at 8 bits. Fetch follows the IGCSE order: PC → MAR, address bus + READ, data bus → MDR, MDR → CIR, PC incremented.</p>
    </div>}
  </Modal>;
}

/* ───────── map ───────── */
export function MapScreen({ store, s }: { store: GameStore; s: GameState }) {
  const xs = [-12, 12], zs = [-81, 7], scale = 6;
  const X = (x: number) => (x - xs[0]!) * scale, Z = (z: number) => (z - zs[0]!) * scale;
  const p = s.progress.player;
  return <Modal title="Facility map" kicker="Only places you have visited are charted" onClose={() => store.back()}>
    <svg className="cl-map" viewBox={`0 0 ${(xs[1]! - xs[0]!) * scale} ${(zs[1]! - zs[0]!) * scale}`} role="img" aria-label="Map of visited rooms">
      {CORRIDORS.map((c, i) => <rect key={i} x={X(c.x0)} y={Z(c.z0)} width={(c.x1 - c.x0) * scale} height={(c.z1 - c.z0) * scale} className="cl-map-corridor" />)}
      {ROOMS.map(r => { const seen = s.progress.visited.includes(r.name); return <g key={r.name} opacity={seen ? 1 : 0.18}>
        <rect x={X(r.area.x0)} y={Z(r.area.z0)} width={(r.area.x1 - r.area.x0) * scale} height={(r.area.z1 - r.area.z0) * scale} rx={4} className={'cl-map-room' + (s.room === r.name ? ' is-here' : '')} />
        <text x={X((r.area.x0 + r.area.x1) / 2)} y={Z((r.area.z0 + r.area.z1) / 2)}>{seen ? r.name : '?'}</text>
      </g>; })}
      {DOORS.map(d => <rect key={d.id} x={X(-1.6)} y={Z(d.z) - 3} width={3.2 * scale} height={6} className={s.progress.solved[d.opensWhen] ? 'cl-map-door is-open' : 'cl-map-door'} />)}
      {INTERACTABLES.filter(i => i.kind === 'log' && s.progress.visited.includes(i.room) && !s.progress.logs.includes(i.id)).map(i => <circle key={i.id} cx={X(i.x)} cy={Z(i.z)} r={4} className="cl-map-log" />)}
      <g transform={`translate(${X(p.x)} ${Z(p.z)}) rotate(${-p.yaw * 180 / Math.PI})`}><path d="M0 -9 L6 6 L0 3 L-6 6 Z" className="cl-map-you" /></g>
    </svg>
    <p className="cl-muted"><span className="cl-dot is-log" /> unread record nearby · <span className="cl-dot is-door" /> sealed door</p>
  </Modal>;
}

/* ───────── HUD ───────── */
export function Hud({ store, s, locked, stats }: { store: GameStore; s: GameState; locked: boolean; stats: () => { fps: number; scale: number; profile: string; calls: number } | null }) {
  const [perf, setPerf] = useState<ReturnType<typeof stats>>(null);
  useEffect(() => { if (!s.settings.showFps) return; const t = setInterval(() => setPerf(stats()), 500); return () => clearInterval(t); }, [s.settings.showFps, stats]);
  const current = PUZZLE_ORDER.find(id => !s.progress.solved[id]) ?? 'done';
  const obj = OBJECTIVES[current];
  const line = s.dialogue[0];
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => store.advanceDialogue(), Math.max(4500, line.text.length * 70));
    const onKey = (e: KeyboardEvent) => { if (e.key === ' ' && s.phase === 'playing') { e.preventDefault(); store.advanceDialogue(); } };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [line, store, s.phase]);
  useEffect(() => { if (!s.toast) return; const id = s.toast.id; const t = setTimeout(() => store.clearToast(id), 4200); return () => clearTimeout(t); }, [s.toast, store]);
  return <div className="cl-hud" aria-live="polite">
    <div className="cl-objective"><span className="cl-kicker">{s.room}</span><b>{obj.title}</b><small>{obj.detail}</small></div>
    <div className="cl-hud-actions">
      <button className="cl-icon" onClick={() => store.setPhase('journal')} title="Journal (J)" aria-label="Journal"><BookOpen size={17} /></button>
      <button className="cl-icon" onClick={() => store.setPhase('map')} title="Map (M)" aria-label="Map"><MapIcon size={17} /></button>
      <button className="cl-icon" onClick={() => store.pause()} title="Pause (Esc)" aria-label="Pause"><Pause size={17} /></button>
    </div>
    {s.settings.showFps && perf && <div className="cl-fps">{perf.fps} fps · {perf.profile} · {Math.round(perf.scale * 100)}%</div>}
    <div className="cl-crosshair" aria-hidden="true" />
    {!locked && s.phase === 'playing' && !s.prompt && <div className="cl-clickhint">Click the view to look around · WASD to move</div>}
    {s.prompt && <div className="cl-prompt"><kbd>E</kbd> {s.prompt}</div>}
    {line && <div className="cl-dialogue" onClick={() => store.advanceDialogue()}>
      <span className={'cl-speaker is-' + line.speaker.toLowerCase()}>{line.speaker}</span>
      <p>{line.text}</p>
      <small>{s.dialogue.length > 1 ? 'Space ▸' : 'Space ✕'}</small>
    </div>}
    {s.toast && <div className={'cl-toast is-' + s.toast.tone} role="status">{s.toast.text}</div>}
  </div>;
}

/* ───────── ending ───────── */
export function Ending({ store, s, onHome }: { store: GameStore; s: GameState; onHome: () => void }) {
  const p = s.progress, mins = Math.max(1, Math.round(((p.completedAt ?? Date.now()) - p.startedAt) / 60000));
  const hints = PUZZLE_ORDER.reduce((n, id) => n + p.hintsUsed[id], 0);
  return <div className="cl-ending">
    <div className="cl-ending-card">
      <span className="cl-kicker">The Archive is running</span>
      <h1>Every machine is executing again.</h1>
      <p>The Core never suffered a hardware fault. A power dip interrupted a single store instruction, and every system that shared its memory inherited the damage: a zeroed offset, a branch into data, a bridge waiting for signals that never came. You didn't replace a part. You traced the evidence, repaired the program, and let the processor finish what it started.</p>
      <ul className="cl-stats">
        <li><b>{p.cycles.toLocaleString()}</b><span>micro-operations executed</span></li>
        <li><b>{p.mistakes}</b><span>failed runs debugged</span></li>
        <li><b>{hints}</b><span>hints used</span></li>
        <li><b>{p.logs.length}/{LOGS.length}</b><span>records recovered</span></li>
        <li><b>{mins}</b><span>minutes</span></li>
      </ul>
      <h3>What you used</h3>
      <p className="cl-muted">{CONCEPTS.filter(c => p.concepts.includes(c.id)).map(c => c.term).join(' · ')}</p>
      <div className="cl-row">
        <button className="cl-btn is-primary" onClick={() => store.setPhase('playing')}><Play size={16} /> Keep exploring</button>
        <button className="cl-btn" onClick={() => store.quitToMenu()}><ArrowLeft size={16} /> Title screen</button>
        <button className="cl-btn" onClick={onHome}><Home size={16} /> Back to Pico</button>
      </div>
    </div>
  </div>;
}
