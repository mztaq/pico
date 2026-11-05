import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, RotateCcw, StepForward, X } from 'lucide-react';
import { compile } from '../language';
import { startExecution, type ExecutionJob } from '../runtime/runner';
import type { ExecutionReply } from '../runtime/worker';
import { HighlightedCode } from '../app/components/HighlightedCode';
import type { Challenge } from './challenges';
import './helper.css';

/** Align lines so an insertion does not mark every following line as changed. */
export function changedLines(source: string, fixed: string): Set<number> {
  const a = source.split('\n'), b = fixed.split('\n');
  if (a.length > 300 || b.length > 300) return new Set(a.flatMap((line, i) => line.trim() !== b[i]?.trim() ? [i + 1] : []));
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i].trim() === b[j].trim() ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const changed = new Set<number>(); let i = 0, j = 0;
  while (i < a.length) {
    if (j < b.length && a[i].trim() === b[j].trim()) { i++; j++; }
    else if (j < b.length && table[i][j + 1] > table[i + 1][j]) j++;
    else { changed.add(++i); }
  }
  return changed;
}
const printed = (reply?: ExecutionReply) => reply?.result?.output.length ? reply.result.output.map(line => line || '⟨blank line⟩').join('\n') : '(no output)';
export function SolutionHelper({ challenge, code, onApply, onClose }: { challenge: Challenge; code: string; onApply: () => void; onClose: () => void }) {
  const [results, setResults] = useState<ExecutionReply[] | null>(null);
  const [test, setTest] = useState(0);
  const [mode, setMode] = useState<'yours' | 'fixed'>('yours');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failure, setFailure] = useState('');
  const activeLine = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
    let alive = true; let job: ExecutionJob | undefined;
    try {
      let current;
      let syntaxError: string | undefined;
      try { current = compile(code).ast; } catch (error) { syntaxError = error instanceof Error ? error.message : 'Code could not compile.'; }
      const fixed = compile(challenge.solution).ast;
      // Each source has its own AST; two jobs keep traces independent.
      const ownJob = current ? startExecution({ ast: current, runs: challenge.tests.map(item => ({ inputs: item.inputs, options: { trace: true, limit: 2000 } })) }) : undefined;
      job = startExecution({ ast: fixed, runs: challenge.tests.map(item => ({ inputs: item.inputs, options: { trace: true, limit: 2000 } })) });
      Promise.all([ownJob?.promise ?? Promise.resolve<ExecutionReply[]>(challenge.tests.map(() => ({ error: { message: syntaxError! } }))), job.promise]).then(([own, corrected]) => {
        if (!alive) return;
        setResults(own.flatMap((reply, i) => [reply, corrected[i]]));
        const first = own.findIndex((reply, i) => reply.error || JSON.stringify(reply.result?.output) !== JSON.stringify(challenge.tests[i].expected));
        setTest(Math.max(0, first));
      }).catch(error => { if (alive) setFailure(String(error)); });
      return () => { alive = false; ownJob?.cancel(); job?.cancel(); };
    } catch (error) { setFailure(error instanceof Error ? error.message : 'The walkthrough could not start.'); }
    return () => { alive = false; job?.cancel(); };
  }, [challenge, code]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select, summary') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === title.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onClose]);
  const own = results?.[test * 2], fixed = results?.[test * 2 + 1];
  const reply = mode === 'yours' ? own : fixed;
  const trace = reply?.result?.trace ?? [];
  const step = trace[index];
  const previous = trace[index - 1];
  const source = mode === 'yours' ? code : challenge.solution;
  const differences = changedLines(source, mode === 'yours' ? challenge.solution : code);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index >= trace.length - 1) setPlaying(false);
      else setIndex(value => value + 1);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [playing, index, trace.length]);
  useEffect(() => { activeLine.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' }); }, [index, mode, test]);
  function reset() { setPlaying(false); setIndex(0); }
  function play() {
    if (index >= trace.length - 1) setIndex(0);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setIndex(value => Math.min(value + 1, trace.length - 1)); return; }
    setPlaying(value => !value);
  }
  return <section ref={panel} role="dialog" aria-modal="true" className="bf-helper" aria-labelledby="bf-helper-title">
    <header><div><span className="bf-eyebrow">GUIDED SOLUTION</span><h3 id="bf-helper-title" ref={title} tabIndex={-1}>Let’s follow the code.</h3></div><button onClick={onClose} aria-label="Close solution helper"><X size={18} /></button></header>
    <p>{challenge.explanation}</p>
    <p className="bf-helper-note">Highlighted lines differ from the reference solution; a different approach can also be correct. Each snapshot shows the state at that execution point. The final comparison shows the effect on output.</p>
    {failure ? <p role="alert">{failure}</p> : !results ? <p role="status">Tracing your code and the reference fix…</p> : <>
      <label>Test case <select value={test} onChange={event => { reset(); setTest(Number(event.target.value)); }}>{challenge.tests.map((item, i) => <option key={i} value={i}>{item.name}</option>)}</select></label>
      <div className="bf-helper-tabs" role="group" aria-label="Walkthrough source"><button aria-pressed={mode === 'yours'} onClick={() => { reset(); setMode('yours'); }}>Your code</button><button aria-pressed={mode === 'fixed'} onClick={() => { reset(); setMode('fixed'); }}>Reference fix</button></div>
      <div className="bf-helper-controls"><button disabled={!trace.length} onClick={play}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play walkthrough'}</button><button disabled={index >= trace.length - 1} onClick={() => { setPlaying(false); setIndex(value => value + 1); }}><StepForward size={15} />Step</button><button onClick={reset}><RotateCcw size={15} />Replay</button><span>{trace.length ? `Step ${index + 1} / ${trace.length} · ${step?.label}` : 'No execution trace'}</span></div>
      <div className="bf-helper-grid"><div className="bf-helper-code" aria-label="Traced code">{source.split('\n').map((line, i) => <div key={i} ref={step?.line === i + 1 ? activeLine : undefined} className={`${step?.line === i + 1 ? 'is-current' : ''} ${differences.has(i + 1) ? 'is-different' : ''}`}><span>{i + 1}</span><HighlightedCode code={line || ' '} />{differences.has(i + 1) && <small>Changed</small>}</div>)}</div><div className="bf-helper-state"><h4>Variables at this step</h4>{Object.entries(step?.variables ?? {}).map(([name, value]) => <p className={JSON.stringify(previous?.variables[name]) !== JSON.stringify(value) ? 'is-changed' : ''} key={name}><strong>{name}</strong><code>{JSON.stringify(value)}</code></p>)}<h4>Output so far</h4><pre>{step?.output.length ? step.output.map(line => line || '⟨blank line⟩').join('\n') : '(nothing printed yet)'}</pre></div></div>
      {reply?.error && <p className="bf-output-error">Execution stopped: {reply.error.message}</p>}{reply?.result?.traceTruncated && <p>Trace recording reached its limit. Final output is shown below.</p>}
      <h4>How it affects the output</h4><p>Test input: <code>{challenge.tests[test].inputs.join(', ') || '(no input)'}</code></p><div className="bf-helper-comparison"><div><strong>Your code printed</strong><pre>{printed(own)}</pre>{own?.error && <p className="bf-output-error">{own.error.message}</p>}</div><div><strong>The reference fix printed</strong><pre>{printed(fixed)}</pre>{fixed?.error && <p className="bf-output-error">{fixed.error.message}</p>}</div></div>
      <details><summary>Show the complete answer</summary><pre><HighlightedCode code={challenge.solution} /></pre></details>
      <button className="bf-primary" onClick={onApply}>Apply reference fix to editor<ArrowRight size={15} /></button><p className="bf-helper-note">Applying the answer does not mark it solved. Run the checks to verify it.</p>
    </>}
  </section>;
}
