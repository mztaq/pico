import { useEffect, useRef } from 'react';
import { CircleX, Code2, SkipBack, SkipForward, Terminal } from 'lucide-react';
import type { Program } from '../../language/ast';
import type { CompilerLanguage } from '../../storage/projects';
import type { RunResult, TraceStep } from '../../runtime/interpreter';
import type { PendingInput } from '../../runtime/worker';
import { FlowchartPanel } from './FlowchartPanel';

export type PanelKey = 'console' | 'debugger' | 'flowchart';
export interface ConsoleEntry { kind: 'output' | 'input' | 'note' | 'error'; text: string; }
interface ConsoleProps {
  entries: ConsoleEntry[];
  error?: { message: string; line?: number; column?: number; tip?: string; diagnostic?: string } | null;
  pendingInput: PendingInput | null;
  inputValue: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  running: boolean;
  ran: boolean;
  status?: string;
  outputTruncated?: boolean;
}
export function ConsolePanel({ entries, error, pendingInput, inputValue, onInput, onSubmit, running, ran, status, outputTruncated, onErrorClick }: ConsoleProps & { onErrorClick?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pendingInput) inputRef.current?.focus(); }, [pendingInput?.id]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [entries, pendingInput?.id, error]);
  return <div className="console-panel">
    <div className="console-output-area">
      {entries.length > 0 && <div className="output-list" role="log" aria-label="Console transcript" aria-live="polite">{entries.map((entry, index) => <div className={entry.kind === 'error' ? 'console-entry-error' : entry.kind === 'note' ? 'console-entry-note' : `output-line ${entry.kind === 'input' ? 'console-entry-input' : ''}`} key={index}><span className="output-prompt" aria-hidden="true">{entry.kind === 'error' ? 'Error' : entry.kind === 'note' ? '✦' : entry.kind === 'input' ? '❯' : '›'}</span><span>{entry.text || <span className="muted">{entry.kind === 'input' ? '(empty input)' : 'empty line'}</span>}</span></div>)}</div>}
      {error && <div className="runtime-error-card" role="alert" onClick={onErrorClick} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onErrorClick?.(); }} tabIndex={onErrorClick ? 0 : undefined} title={onErrorClick ? 'Jump to the error in the editor' : undefined}><div className="error-heading"><CircleX size={15} /> <strong>{error.line ? `Error · line ${error.line}` : 'Error'}</strong></div>{error.diagnostic ? <pre className="diagnostic-message">{error.diagnostic}</pre> : <p>{error.message}</p>}{error.tip && <div className="error-tip">Tip · {error.tip}</div>}</div>}
      {pendingInput && <div className="console-input-line">
        <form className="console-input-form" aria-label="Console input" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
          <span className="output-prompt" aria-hidden="true">❯</span>
          <input ref={inputRef} aria-label={`Value for ${pendingInput.variable}`} aria-describedby="console-input-hint" autoComplete="off" spellCheck={false} value={inputValue} onChange={event => onInput(event.target.value)} placeholder={`Enter ${pendingInput.dataType} value`} />
          <button className="console-input-submit" type="submit">Send</button>
        </form>
        <p className="console-input-hint" id="console-input-hint" role="status">Waiting for {pendingInput.variable} ({pendingInput.dataType}) · line {pendingInput.line}. Press Enter to continue.</p>
      </div>}
      {running && !pendingInput && <p className="console-running" role="status">{status || 'Running…'}</p>}
      {!entries.length && !error && !pendingInput && !running && <div className="console-placeholder"><div className="console-placeholder-mark"><Terminal size={18} /></div><div><strong>{ran ? 'Program finished without output' : 'Your output will appear here'}</strong><p>Run your program. Enter values here when it asks for input.</p></div></div>}
      {outputTruncated && <p className="console-truncated" role="status">Showing the most recent output.</p>}
      <div ref={endRef} />
    </div>
  </div>;
}

interface DebuggerProps { language?: CompilerLanguage; trace: TraceStep[]; index: number; onIndex: (index: number) => void; truncated?: boolean; error?: string; }
export function DebuggerPanel({ language = 'pseudocode', trace, index, onIndex, truncated, error }: DebuggerProps) {
  const current = trace[index];
  if (!trace.length) return <div className="panel-empty"><div className="empty-icon"><Code2 size={18} /></div><strong>See your program one step at a time</strong><p>Press Debug to build an execution trace. Each step shows the current line and the values that exist at that moment.</p></div>;
  const variables = Object.entries(current?.variables ?? {});
  return <div className="debugger-panel">
    {error && <p role="alert">{error}</p>}{truncated && <p role="status">History recording stopped at its storage limit. Execution continued.</p>}
    <div className="debugger-controls"><div className="step-indicator"><span className="step-dot" /> Step <strong>{index + 1}</strong><span className="muted">of {trace.length}</span></div><div className="step-actions"><button className="icon-button" aria-label="Previous step" disabled={index <= 0} onClick={() => onIndex(Math.max(0, index - 1))}><SkipBack size={15} /></button><button className="step-next" disabled={index >= trace.length - 1} onClick={() => onIndex(Math.min(trace.length - 1, index + 1))}><SkipForward size={15} /> Step</button></div></div>
    <div className="debugger-content"><div className="debug-current"><span className="mini-label">CURRENT LINE</span><div className="debug-line-chip">{current?.line ?? '—'}</div><div className="debug-action-name">{current?.label ?? 'Ready'}</div></div><div className="debug-vars"><div className="mini-label">VARIABLES <span>{variables.length}</span></div>{variables.length ? <div className="variable-list">{variables.map(([name, value]) => <div className="variable-row" key={name}><span className="variable-name">{name}</span><code>{formatValue(value, language)}</code></div>)}</div> : <div className="debug-empty">No variables have been declared yet.</div>}</div><div className="debug-stdout"><div className="mini-label">OUTPUT <span>{current?.output.length ?? 0}</span></div>{current?.output.length ? current.output.slice(-3).map((line, i) => <code key={`${i}-${line}`}>{line}</code>) : <span className="debug-empty">Nothing printed yet</span>}</div></div>
    <div className="trace-strip" aria-label="Execution history">{trace.slice(Math.max(0, index - 3), Math.min(trace.length, index + 9)).map((step, offset) => { const actualIndex = Math.max(0, index - 3) + offset; return <button key={`${actualIndex}-${step.line}`} className={`trace-chip ${actualIndex === index ? 'active' : ''}`} onClick={() => onIndex(actualIndex)}><span>{String(actualIndex + 1).padStart(2, '0')}</span><b>L{step.line}</b></button>; })}</div>
  </div>;
}

interface FlowProps { ast: Program | null; error?: string; }
export function FlowchartDock({ ast, error }: FlowProps) { return <FlowchartPanel ast={ast} error={error} />; }

export function panelIcon(key: PanelKey) {
  switch (key) {
    case 'console': return <Terminal size={14} />;
    case 'debugger': return <Code2 size={14} />;
    case 'flowchart': return <span className="flowchart-tab-icon">◇</span>;
  }
}

export function DebugSummary({ result }: { result: RunResult | null }) { return <span>{result ? `${result.steps} steps` : 'Ready to debug'}</span>; }
function formatValue(value: unknown, language: CompilerLanguage = 'pseudocode'): string { if (language === 'python') return value === null ? 'None' : value === true ? 'True' : value === false ? 'False' : typeof value === 'string' ? JSON.stringify(value) : typeof value === 'object' ? JSON.stringify(value) : String(value); return value === null ? 'UNASSIGNED' : value === true ? 'TRUE' : value === false ? 'FALSE' : Array.isArray(value) ? JSON.stringify(value) : String(value); }
