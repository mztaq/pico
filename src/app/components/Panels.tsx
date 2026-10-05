import { useEffect, useRef } from 'react';
import { Braces, CircleCheck, CircleX, Code2, Play, Plus, SkipBack, SkipForward, Terminal, Trash2 } from 'lucide-react';
import type { Program, Token } from '../../language/ast';
import type { RunResult, TraceStep } from '../../runtime/interpreter';
import type { PendingInput } from '../../runtime/worker';
import type { TestCase } from '../../storage/projects';
import { executableLines } from '../../visual/execution';
import { FlowchartPanel } from './FlowchartPanel';

export type PanelKey = 'console' | 'debugger' | 'tests' | 'flowchart' | 'coverage' | 'ast' | 'tokens';
export interface TestOutcome { passed: boolean; actual: string[]; error?: string; }
export interface ConsoleEntry { kind: 'output' | 'input'; text: string; }
interface ConsoleProps {
  entries: ConsoleEntry[];
  error?: { message: string; line?: number; column?: number; tip?: string } | null;
  pendingInput: PendingInput | null;
  inputValue: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  running: boolean;
  ran: boolean;
}
export function ConsolePanel({ entries, error, pendingInput, inputValue, onInput, onSubmit, running, ran }: ConsoleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (pendingInput) inputRef.current?.focus(); }, [pendingInput?.id]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [entries, pendingInput?.id, error]);
  return <div className="console-panel">
    <div className="console-output-area">
      {entries.length > 0 && <div className="output-list" role="log" aria-label="Console transcript" aria-live="polite">{entries.map((entry, index) => <div className={`output-line ${entry.kind === 'input' ? 'console-entry-input' : ''}`} key={index}><span className="output-prompt" aria-hidden="true">{entry.kind === 'input' ? '❯' : '›'}</span><span>{entry.text || <span className="muted">{entry.kind === 'input' ? '(empty input)' : 'empty line'}</span>}</span></div>)}</div>}
      {error && <div className="runtime-error-card" role="alert"><div className="error-heading"><CircleX size={15} /> <strong>{error.line ? `Line ${error.line}` : 'Program error'}</strong></div><p>{error.message}</p>{error.tip && <div className="error-tip">Tip · {error.tip}</div>}</div>}
      {pendingInput && <div className="console-input-line">
        <form className="console-input-form" aria-label="Console input" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
          <span className="output-prompt" aria-hidden="true">❯</span>
          <input ref={inputRef} aria-label={`Value for ${pendingInput.variable}`} aria-describedby="console-input-hint" autoComplete="off" spellCheck={false} value={inputValue} onChange={event => onInput(event.target.value)} placeholder={`Enter ${pendingInput.dataType} value`} />
          <button className="console-input-submit" type="submit">Send</button>
        </form>
        <p className="console-input-hint" id="console-input-hint" role="status">Waiting for {pendingInput.variable} ({pendingInput.dataType}) · line {pendingInput.line}. Press Enter to continue.</p>
        {pendingInput.error && <p className="console-input-error" role="alert">{pendingInput.error} Try again.</p>}
      </div>}
      {running && !pendingInput && <p className="console-running" role="status">Running…</p>}
      {!entries.length && !error && !pendingInput && !running && <div className="console-placeholder"><div className="console-placeholder-mark"><Terminal size={18} /></div><div><strong>{ran ? 'Program finished without output' : 'Your output will appear here'}</strong><p>Run your program. Enter values here when it reaches INPUT.</p></div></div>}
      <div ref={endRef} />
    </div>
  </div>;
}

interface DebuggerProps { trace: TraceStep[]; index: number; onIndex: (index: number) => void; truncated?: boolean; error?: string; }
export function DebuggerPanel({ trace, index, onIndex, truncated, error }: DebuggerProps) {
  const current = trace[index];
  if (!trace.length) return <div className="panel-empty"><div className="empty-icon"><Code2 size={18} /></div><strong>See your program one step at a time</strong><p>Press Debug to build an execution trace. Each step shows the current line and the values that exist at that moment.</p></div>;
  const variables = Object.entries(current?.variables ?? {});
  return <div className="debugger-panel">
    {error && <p role="alert">{error}</p>}{truncated && <p role="status">History recording stopped at its storage limit. Execution continued.</p>}
    <div className="debugger-controls"><div className="step-indicator"><span className="step-dot" /> Step <strong>{index + 1}</strong><span className="muted">of {trace.length}</span></div><div className="step-actions"><button className="icon-button" aria-label="Previous step" disabled={index <= 0} onClick={() => onIndex(Math.max(0, index - 1))}><SkipBack size={15} /></button><button className="step-next" disabled={index >= trace.length - 1} onClick={() => onIndex(Math.min(trace.length - 1, index + 1))}><SkipForward size={15} /> Step</button></div></div>
    <div className="debugger-content"><div className="debug-current"><span className="mini-label">CURRENT LINE</span><div className="debug-line-chip">{current?.line ?? '—'}</div><div className="debug-action-name">{current?.label ?? 'Ready'}</div></div><div className="debug-vars"><div className="mini-label">VARIABLES <span>{variables.length}</span></div>{variables.length ? <div className="variable-list">{variables.map(([name, value]) => <div className="variable-row" key={name}><span className="variable-name">{name}</span><code>{formatValue(value)}</code></div>)}</div> : <div className="debug-empty">No variables have been declared yet.</div>}</div><div className="debug-stdout"><div className="mini-label">OUTPUT <span>{current?.output.length ?? 0}</span></div>{current?.output.length ? current.output.slice(-3).map((line, i) => <code key={`${i}-${line}`}>{line}</code>) : <span className="debug-empty">Nothing printed yet</span>}</div></div>
    <div className="trace-strip" aria-label="Execution history">{trace.slice(Math.max(0, index - 3), Math.min(trace.length, index + 9)).map((step, offset) => { const actualIndex = Math.max(0, index - 3) + offset; return <button key={`${actualIndex}-${step.line}`} className={`trace-chip ${actualIndex === index ? 'active' : ''}`} onClick={() => onIndex(actualIndex)}><span>{String(actualIndex + 1).padStart(2, '0')}</span><b>L{step.line}</b></button>; })}</div>
  </div>;
}

interface TestsProps { tests: TestCase[]; outcomes: Record<string, TestOutcome>; onRun: () => void; onUpdate: (id: string, patch: Partial<TestCase>) => void; onAdd: () => void; onRemove: (id: string) => void; running?: boolean; }
export function TestsPanel({ tests, outcomes, onRun, onUpdate, onAdd, onRemove, running }: TestsProps) {
  return <div className="tests-panel">
    <div className="tests-toolbar"><div><strong>{tests.length} test case{tests.length === 1 ? '' : 's'}</strong><span className="muted"> · Compare your program with the result you expect</span></div><div className="tests-actions"><button className="subtle-button" onClick={onAdd}><Plus size={14} /> Add case</button><button className="primary-small" disabled={running} onClick={onRun}><Play size={13} fill="currentColor" /> Run tests</button></div></div>
    {!tests.length ? <div className="panel-empty compact"><strong>No test cases yet</strong><p>Add a case to check expected output against what your program produces.</p></div> : <div className="test-list">{tests.map(test => {
      const outcome = outcomes[test.id];
      return <article className="test-card" key={test.id}>
        <div className="test-card-head"><div className="test-name-wrap"><span className={`test-status ${outcome ? outcome.passed ? 'pass' : 'fail' : ''}`}>{outcome ? outcome.passed ? <CircleCheck size={13} /> : <CircleX size={13} /> : <span />}</span><input aria-label="Test case name" value={test.name} onChange={event => onUpdate(test.id, { name: event.target.value })} /></div><span className={`result-chip ${outcome ? outcome.passed ? 'pass' : 'fail' : ''}`}>{outcome ? outcome.passed ? 'Passed' : 'Failed' : 'Not run'}</span><button className="icon-button quiet" aria-label={`Remove ${test.name}`} onClick={() => onRemove(test.id)}><Trash2 size={14} /></button></div>
        <div className="test-columns"><label><span>INPUT <small>one value per line</small></span><textarea aria-label={`${test.name} input`} value={test.inputs.join('\n')} onChange={event => onUpdate(test.id, { inputs: splitLines(event.target.value) })} placeholder="No input required" rows={2} /></label><label><span>EXPECTED OUTPUT <small>one line per output</small></span><textarea aria-label={`${test.name} expected output`} value={test.expected.join('\n')} onChange={event => onUpdate(test.id, { expected: splitLines(event.target.value) })} placeholder="Expected output" rows={2} /></label><div className="actual-output"><span>ACTUAL OUTPUT</span>{outcome?.error ? <div className="actual-error">{outcome.error}</div> : outcome?.actual.length ? <code>{outcome.actual.join('\n')}</code> : <span className="actual-pending">{outcome ? '(no output)' : 'Run the test to compare'}</span>}</div></div>
      </article>;
    })}</div>}
  </div>;
}

interface CoverageProps { source: string; lines: number[]; ast: Program | null; }
export function CoveragePanel({ source, lines, ast }: CoverageProps) {
  const codeLines = source.split('\n');
  const eligible = new Set(ast ? executableLines(ast) : []);
  const executable = codeLines.map((text,index)=>({text,line:index+1})).filter(({line})=>eligible.has(line));
  const covered = executable.filter(item => lines.includes(item.line));
  const percent = executable.length ? Math.round((covered.length / executable.length) * 100) : 0;
  return <div className="coverage-panel"><div className="coverage-summary"><div className="coverage-ring" style={{ '--coverage': `${percent}%` } as React.CSSProperties}><span>{percent}<small>%</small></span></div><div><strong>Code coverage</strong><p>{lines.length ? `${covered.length} of ${executable.length} executable lines reached` : 'Run your program to see which lines execute.'}</p></div></div><div className="coverage-lines">{codeLines.map((text, index) => { const line = index + 1; const coveredLine = lines.includes(line); const structural = !eligible.has(line); return <div className={`coverage-row ${coveredLine ? 'covered' : !structural && text.trim() ? 'uncovered' : ''}`} key={line}><span className="coverage-mark">{coveredLine ? '✓' : text.trim() && !structural ? '○' : '·'}</span><span className="coverage-number">{line}</span><code>{text || ' '}</code></div>; })}</div></div>;
}

interface AstProps { ast: Program | null; error?: string; }
export function AstPanel({ ast, error }: AstProps) { return <div className="code-inspector">{ast ? <pre className="json-view"><code>{JSON.stringify(ast, null, 2)}</code></pre> : <div className="panel-empty"><Braces size={18} /><strong>AST appears after parsing</strong><p>{error ?? 'Write a Cambridge pseudocode program to inspect its Abstract Syntax Tree.'}</p></div>}</div>; }
interface TokensProps { tokens: Token[]; error?: string; }
export function TokensPanel({ tokens, error }: TokensProps) {
  return <div className="token-panel">{error ? <div className="panel-empty"><strong>Tokens are waiting for valid syntax</strong><p>{error}</p></div> : !tokens.length ? <div className="panel-empty"><strong>No tokens yet</strong><p>Start typing a Cambridge statement and its tokens will appear here.</p></div> : <div className="token-table-wrap"><table className="token-table"><thead><tr><th>TYPE</th><th>VALUE</th><th>LINE</th><th>COLUMN</th></tr></thead><tbody>{tokens.map((token, index) => <tr key={`${token.line}-${token.column}-${index}`}><td><span className={`token-type ${token.type === 'IDENTIFIER' ? 'identifier' : token.type === 'NUMBER' ? 'number' : token.type === 'STRING' ? 'string' : 'keyword'}`}>{token.type}</span></td><td><code>{token.value || <span className="muted">empty</span>}</code></td><td>{token.line}</td><td>{token.column}</td></tr>)}</tbody></table></div>}</div>;
}

interface FlowProps { ast: Program | null; error?: string; }
export function FlowchartDock({ ast, error }: FlowProps) { return <FlowchartPanel ast={ast} error={error} />; }

export function panelIcon(key: PanelKey) {
  switch (key) {
    case 'console': return <Terminal size={14} />;
    case 'debugger': return <Code2 size={14} />;
    case 'tests': return <CircleCheck size={14} />;
    case 'flowchart': return <span className="flowchart-tab-icon">◇</span>;
    case 'coverage': return <span className="coverage-tab-icon">◒</span>;
    case 'ast': return <Braces size={14} />;
    case 'tokens': return <span className="token-tab-icon">▤</span>;
  }
}

export function DebugSummary({ result }: { result: RunResult | null }) { return <span>{result ? `${result.steps} steps` : 'Ready to debug'}</span>; }
function formatValue(value: unknown): string { return value === null ? 'UNASSIGNED' : value === true ? 'TRUE' : value === false ? 'FALSE' : Array.isArray(value) ? JSON.stringify(value) : String(value); }
function splitLines(value: string): string[] { return value === '' ? [] : value.split(/\r?\n/); }
