import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
import { loadSettings } from '../storage/settings';
import { cssVariables, getTheme } from '../app/themes';
import { WorkspaceFluidBackground } from '../app/components/WorkspaceFluidBackground';
import { createRandomValues, createSortFrames, SORT_ALGORITHMS, type SortAlgorithm } from './sorting';
import './algorithm-visualizer.css';

export function AlgorithmVisualizer({ onHome }: { onHome: () => void }) {
  const theme = getTheme(loadSettings().theme);
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>('bubble');
  const [values, setValues] = useState(() => createRandomValues());
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const frames = useMemo(() => createSortFrames(values, algorithm), [values, algorithm]);
  const frame = frames[Math.min(step, frames.length - 1)]!;
  const done = step === frames.length - 1;

  useEffect(() => { setStep(0); setPlaying(false); }, [algorithm, values]);
  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (done) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStep(current => Math.min(current + 1, frames.length - 1)), 1050 - speed * 190);
    return () => window.clearTimeout(timer);
  }, [playing, step, frames.length, speed, done]);

  function reset(nextValues = values) { setPlaying(false); setValues(nextValues); setStep(0); }
  function advance(amount: number) { setPlaying(false); setStep(current => Math.max(0, Math.min(current + amount, frames.length - 1))); }

  return <div className="pico-app algorithm-app workspace-fluid-surface" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as React.CSSProperties}>
    <WorkspaceFluidBackground theme={theme}/>
    <header className="topbar pico-appbar algorithm-topbar">
      <div className="pico-appbar-lead">
        <button className="toolbar-button home-button" type="button" aria-label="Go to home screen" onClick={onHome}><ArrowLeft size={16}/></button>
        <button type="button" className="brand-lockup pico-brand-home" aria-label="Pico, back to Workspaces" onClick={onHome}><img className="brand-mark" src="/pico-logo.svg" alt="" width="26" height="26"/><span>Pico<span className="brand-period">.</span></span></button>
        <span className="pico-appbar-sep">/</span><span className="pico-appbar-tool">Algorithm Visualizer</span>
      </div>
      <div className="topbar-spacer"/>
      <div className="pico-appbar-run"><button type="button" className="run-button" aria-label={playing ? 'Pause sorting' : 'Run sorting'} onClick={() => done ? reset() : setPlaying(value => !value)}>{playing ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}<span>{playing ? 'Pause' : done ? 'Run again' : 'Run'}</span></button></div>
    </header>
    <main className="algorithm-page-scroll">
    <div className="algorithm-content">
      <header className="algorithm-heading"><span className="algorithm-eyebrow">VISUAL LAB</span><h1>See how sorting works.</h1><p>Follow each comparison and swap. Change the algorithm, then step through it at your own pace.</p></header>
      <section className="algorithm-card" aria-label="Sorting visualizer">
        <div className="algorithm-toolbar">
          <label className="algorithm-select-label">Algorithm<select aria-label="Sorting algorithm" value={algorithm} onChange={event => setAlgorithm(event.target.value as SortAlgorithm)}>{Object.entries(SORT_ALGORITHMS).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></label>
          <div className="algorithm-toolbar-actions"><button type="button" className="algorithm-quiet-button" onClick={() => reset(createRandomValues())}><Shuffle size={15}/> New values</button><button type="button" className="algorithm-quiet-button" onClick={() => reset()}><RotateCcw size={15}/> Reset</button></div>
        </div>
        <div className="algorithm-chart" role="img" aria-label={`Sorting values. Step ${step + 1} of ${frames.length}. ${frame.label}`}>
          <div className="algorithm-bars">{frame.values.map((value, index) => <div className={`algorithm-bar${frame.active.includes(index) ? ' is-active' : ''}${frame.sorted.includes(index) ? ' is-sorted' : ''}`} key={index} style={{ height: `${value}%`, '--bar-index': index } as React.CSSProperties}><span>{value}</span></div>)}</div>
          <div className="algorithm-indexes" aria-hidden="true">{frame.values.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
        </div>
        <div className="algorithm-caption" aria-live="polite"><span className="algorithm-step-count">Step {step + 1} <span>of {frames.length}</span></span><p>{done && <Check size={16}/>} {frame.label}</p></div>
        <div className="algorithm-controls"><div className="algorithm-step-buttons"><button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => advance(-1)}><ChevronLeft size={18}/></button><button type="button" className="algorithm-play" onClick={() => done ? reset() : setPlaying(value => !value)}>{playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}{playing ? 'Pause' : done ? 'Run again' : step ? 'Resume' : 'Play'}</button><button type="button" aria-label="Next step" disabled={done} onClick={() => advance(1)}><ChevronRight size={18}/></button></div><label className="algorithm-speed">Speed <input aria-label="Animation speed" type="range" min="1" max="5" value={speed} onChange={event => setSpeed(Number(event.target.value))}/><span>{['Slow','', 'Normal','','Fast'][speed - 1]}</span></label></div>
      </section>
      <section className="algorithm-explainer"><div><span className="algorithm-eyebrow">HOW IT WORKS</span><h2>{SORT_ALGORITHMS[algorithm].name}</h2><p>{SORT_ALGORITHMS[algorithm].description}</p></div><div className="algorithm-complexity"><span>Complexity</span><strong>{SORT_ALGORITHMS[algorithm].complexity}</strong></div></section>
    </div>
    </main>
  </div>;
}
