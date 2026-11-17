import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, GitBranch, Play, RotateCcw } from 'lucide-react';
import { compile } from '../language';
import type { ExecutionJob } from '../runtime/runner';
import type { RunResult } from '../runtime/interpreter';
import { runCode } from './execute';
import { FlowchartPreview } from './FlowchartPreview';

const samples = [
  {
    name: 'Loop',
    code: ['DECLARE Total : INTEGER', 'DECLARE I : INTEGER',
      'Total <- 0', 'FOR I <- 1 TO 4', '    Total <- Total + I',
      '    OUTPUT Total', 'NEXT I'].join('\n'),
  },
  {
    name: 'Decision',
    code: ['DECLARE Mark : INTEGER', 'INPUT Mark',
      'IF Mark >= 50 THEN', '    OUTPUT "Pass"', 'ELSE',
      '    OUTPUT "Try again"', 'ENDIF'].join('\n'),
  },
  {
    name: 'Array',
    code: ['DECLARE Scores : ARRAY[1:3] OF INTEGER',
      'Scores[1] <- 12', 'Scores[2] <- 17', 'Scores[3] <- 14',
      'OUTPUT Scores[1] + Scores[2] + Scores[3]'].join('\n'),
  },
];

const key = 'pico.studio.code.v1';
function initialCode() {
  try { return localStorage.getItem(key)?.slice(0, 12000) || samples[0]!.code; }
  catch { return samples[0]!.code; }
}

function valueText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return '[value]'; }
  }
  return String(value);
}

export function LiveStudio() {
  const [code, setCode] = useState(initialCode);
  const [inputs, setInputs] = useState('65');
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [view, setView] = useState<'trace' | 'flow'>('trace');
  const job = useRef<ExecutionJob | null>(null);
  const sourceLines = code.split('\n');

  const analysis = useMemo(() => {
    try { return { diagnostic: '', program: compile(code).ast }; }
    catch (reason) { return { diagnostic: reason instanceof Error ? reason.message : 'Invalid pseudocode', program: null }; }
  }, [code]);
  const parsed = analysis.diagnostic;

  useEffect(() => {
    try { localStorage.setItem(key, code.slice(0, 12000)); } catch { /* storage optional */ }
    job.current?.cancel();
    job.current = null;
    setRunning(false);
    setResult(null);
    setStep(0);
    setError('');
  }, [code]);

  useEffect(() => () => { job.current?.cancel(); }, []);

  async function run() {
    job.current?.cancel();
    setResult(null);
    setError('');
    setStep(0);
    if (parsed) { setError(parsed); return; }
    if (code.length > 12000) { setError('Limit code to 12,000 characters.'); return; }
    setRunning(true);
    let execution: ExecutionJob | null = null;
    try {
      execution = runCode(code, inputs.split(/\r?\n/).filter(line => line.length > 0).slice(0, 32));
      job.current = execution;
      const [reply] = await execution.promise;
      if (job.current !== execution) return;
      job.current = null;
      if (reply?.result) {
        setResult(reply.result);
        if (reply.result.trace.length) setStep(0);
      }
      if (reply?.error) setError(reply.error.message);
      if (!reply?.error && !reply?.result) setError('No result returned.');
    } catch (reason) {
      if (execution === null || job.current === execution)
        setError(reason instanceof Error ? reason.message : 'Unable to run pseudocode.');
    } finally {
      if (job.current === execution) { job.current = null; setRunning(false); }
      if (execution === null) setRunning(false);
    }
  }

  const trace = result?.trace ?? [];
  const active = trace[Math.min(step, trace.length - 1)];
  const lineText = (line: number) => sourceLines[line - 1]?.trim() || 'End';

  function selectSample(next: string) {
    const sample = samples.find(item => item.name === next);
    if (sample) { setCode(sample.code); setInputs(sample.name === 'Decision' ? '65' : ''); }
  }

  return <section className="suite-studio" aria-label="Live Studio">
    <div className="suite-studio-editor suite-surface">
      <div className="suite-section-header">
        <h2>Live Studio</h2>
        <select aria-label="Load example" defaultValue="Loop" onChange={event => selectSample(event.target.value)}>
          {samples.map(item => <option key={item.name}>{item.name}</option>)}
        </select>
      </div>
      <label className="suite-label" htmlFor="suite-pseudocode">Pseudocode</label>
      <textarea id="suite-pseudocode" className="suite-code" spellCheck={false} value={code}
        onChange={event => setCode(event.target.value)} aria-describedby="suite-code-diagnostic" />
      <p className={parsed ? 'suite-error' : 'suite-hint'} id="suite-code-diagnostic" role="status">
        {parsed || 'Cambridge-style pseudocode. Run to inspect each executed step.'}
      </p>
      <label className="suite-label" htmlFor="suite-inputs">Inputs (one per line)</label>
      <textarea className="suite-inputs" rows={2} id="suite-inputs" spellCheck={false}
        value={inputs} onChange={event => setInputs(event.target.value)} />
      <div className="suite-actions">
        <button className="suite-primary" onClick={run} disabled={running || Boolean(parsed)} type="button"><Play size={15} /> {running ? 'Running…' : 'Run'}</button>
        <button className="suite-secondary" onClick={() => { job.current?.cancel(); job.current = null; setCode(samples[0]!.code); setInputs(''); }} type="button"><RotateCcw size={15} /> Reset</button>
      </div>
    </div>
    <div className="suite-studio-side">
      <section className="suite-surface suite-studio-output" aria-label="Program output">
        <h2>Output</h2>
        {error && <p className="suite-error" role="alert">{error}</p>}
        <pre aria-live="polite">{result?.output.length ? result.output.join('\n') : error ? '' : 'Run your code to see the output.'}</pre>
        {result?.traceTruncated && <p className="suite-hint">Trace shortened to protect performance.</p>}
      </section>
      <section className="suite-surface suite-studio-trace" aria-label="Program execution">
        <div className="suite-section-header">
          <h2>{view === 'trace' ? 'Trace table' : 'Flowchart'}</h2>
          <div className="suite-switch" role="group" aria-label="Execution view">
            <button type="button" aria-pressed={view === 'trace'} onClick={() => setView('trace')}>Trace</button>
            <button type="button" aria-pressed={view === 'flow'} onClick={() => setView('flow')}><GitBranch size={14} /> Flowchart</button>
          </div>
        </div>
        {view === 'flow' ? (analysis.program
          ? <FlowchartPreview program={analysis.program} lines={sourceLines} activeLine={active?.line} />
          : <p className="suite-error">Correct the pseudocode to display its flowchart.</p>)
          : trace.length ? <>
            <div className="suite-step-controls">
              <button type="button" aria-label="Previous execution step" disabled={step === 0} onClick={() => setStep(current => current - 1)}><ArrowLeft size={16} /></button>
              <span>Step {step + 1} / {trace.length} · Line {active?.line ?? '—'}</span>
              <button type="button" aria-label="Next execution step" disabled={step >= trace.length - 1} onClick={() => setStep(current => current + 1)}><ArrowRight size={16} /></button>
            </div>
            <div className="suite-trace-scroll">
              <table className="suite-trace-table">
                <thead><tr><th>Variable</th><th>Value at step {step + 1}</th></tr></thead>
                <tbody>{Object.entries(active?.variables ?? {}).length
                  ? Object.entries(active?.variables ?? {}).map(([name, value]) => <tr key={name}><th>{name}</th><td>{valueText(value)}</td></tr>)
                  : <tr><td colSpan={2}>No variables yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="suite-hint">Line {active?.line}: {lineText(active?.line ?? 0)}</p>
          </> : <p className="suite-hint">Run a program to inspect its variables step by step.</p>}
      </section>
    </div>
  </section>;
}
