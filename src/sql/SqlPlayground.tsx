import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { ArrowLeft, Database, Download, Play, Upload, Settings2, X } from 'lucide-react';
import { cssVariables, getTheme } from '../app/themes';
import { loadSettings, saveSettings } from '../storage/settings';
import { ThemePicker } from '../app/components/ThemePicker';
import { MAX_CSV_BYTES, quoteIdentifier, toCsv } from './csv';
import type { SqlRequest, SqlResponse, WorkerReply } from './engine';
import './sql-playground.css';

const SAMPLE = 'id,name,score,subject\n1,Ada,92,Computing\n2,Sam,76,Maths\n3,Alex,88,Computing\n4,Robin,65,Maths';
let session: SqlResponse | undefined;
let sessionQuery = 'SELECT * FROM students;';

export function SqlPlayground({ onHome }: { onHome: () => void }) {
  const [themeId, setThemeId] = useState(() => loadSettings().theme);
  const theme = getTheme(themeId);
  const [themeOpen, setThemeOpen] = useState(false);
  const [state, setState] = useState<SqlResponse | undefined>(session);
  const [sql, setSql] = useState(sessionQuery);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState(session ? 'SQLite ready' : 'Loading SQLite…');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const running = useRef(false);
  const alive = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const database = useRef(session?.database);
  const disabled = busy || reading;

  useEffect(() => {
    try { saveSettings({ ...loadSettings(), theme: themeId }); } catch { /* Theme remains active. */ }
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme, themeId]);
  useEffect(() => {
    if (!themeOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setThemeOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [themeOpen]);

  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined; };
  const dispose = () => { clearTimer(); worker.current?.terminate(); worker.current = null; running.current = false; };
  const stop = (message = 'Query stopped. Previous database kept.') => {
    dispose(); setBusy(false); setStatus(message);
  };
  function execute(request: Omit<SqlRequest, 'database'>) {
    if (running.current || !alive.current) return;
    running.current = true; setBusy(true); setError(''); setStatus(request.action === 'import' ? 'Importing CSV…' : request.action === 'init' ? 'Loading SQLite…' : 'Running…');
    const fail = (message: string) => { dispose(); setBusy(false); setError(message); setStatus('Previous database kept'); };
    try {
      worker.current ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const current = worker.current;
      current.onmessage = (event: MessageEvent<WorkerReply>) => {
        if (!alive.current || worker.current !== current) return;
        const reply = event.data;
        if ('ready' in reply) {
          clearTimer();
          timer.current = setTimeout(() => fail('Operation exceeded the 12-second limit.'), 12_000);
          return;
        }
        clearTimer(); running.current = false; setBusy(false);
        if (!reply.ok) { setError(reply.error); setStatus('Previous database kept'); return; }
        const value = reply.value;
        session = value; database.current = value.database; setState(value); setStatus(value.message);
        if (value.suggestedQuery) { setSql(value.suggestedQuery); sessionQuery = value.suggestedQuery; }
      };
      current.onerror = () => fail('SQLite failed to start. Try again or reload Pico.');
      timer.current = setTimeout(() => fail('SQLite took too long to load. Try again.'), 35_000);
      current.postMessage({ ...request, database: database.current });
    } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }
  useEffect(() => {
    alive.current = true;
    if (!session) execute({ action: 'init' });
    return () => { alive.current = false; dispose(); };
  }, []);
  function updateQuery(value: string) { setSql(value); sessionQuery = value; }
  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length || running.current || reading) return;
    if (files.length > 10 || files.some(file => !/\.csv$/i.test(file.name) || file.size > MAX_CSV_BYTES) || files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) {
      setError('Choose up to 10 CSV files, at most 5 MB each and 20 MB total.'); return;
    }
    setReading(true); setError('');
    try {
      const loaded = await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() })));
      if (alive.current) execute({ action: 'import', files: loaded });
    } catch { if (alive.current) setError('Unable to read the selected CSV files.'); }
    finally { if (alive.current) setReading(false); }
  }
  const result = state?.result;
  function downloadResults() {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([toCsv(result.columns, result.rows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pico-query-results.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="sql-app" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as CSSProperties}>
    <header className="sql-header pico-appbar">
      <div className="sql-header-brand"><button type="button" aria-label="Back to Pico" onClick={onHome}><ArrowLeft size={18} /></button><button type="button" className="brand-lockup pico-brand-home" aria-label="Pico, back to Workspaces" onClick={onHome}><img src="/pico-logo.svg" alt="" width="24" height="24"/><span>Pico<span className="brand-period">.</span></span></button><h1>SQL Playground</h1></div>
      <button type="button" aria-label="Choose theme" onClick={() => setThemeOpen(true)}><Settings2 size={18}/></button>
    </header>
    <div className="sql-layout">
      <aside className="sql-sidebar">
        <div className="sql-panel-heading"><h2><Database size={17}/> Tables</h2><button type="button" disabled={disabled} onClick={() => fileInput.current?.click()}><Upload size={15}/> Import CSV</button></div>
        <input ref={fileInput} type="file" accept=".csv,text/csv" multiple hidden onChange={importFiles} />
        <p className="sql-muted">First row contains column names. Up to 5 MB per file.</p>
        <button type="button" disabled={disabled} onClick={() => execute({ action: 'import', files: [{ name: 'students.csv', text: SAMPLE }] })}>Load example</button>
        <div className="sql-tables">
          {state?.tables.map(table => <div className="sql-table-item" key={table.name}><button type="button" disabled={disabled} onClick={() => { const query = 'SELECT * FROM ' + quoteIdentifier(table.name) + ';'; updateQuery(query); execute({ action: 'query', sql: query }); }}><Database size={15}/>{table.name}</button>
            <ul>{table.columns.map((column, i) => <li key={i}><span>{column.name}</span><small>{column.type}</small></li>)}</ul>
          </div>)}
          {!state?.tables.length && <p className="sql-muted">No tables yet.</p>}
        </div>
        <div className="sql-sidebar-bottom"><p className="sql-muted">Files stay on this device. Tables are kept for this tab until you reload.</p><button type="button" disabled={disabled || !state?.tables.length} onClick={() => { if (window.confirm('Clear all tables in this SQL session?')) execute({ action: 'reset' }); }}>Clear database</button></div>
      </aside>
      <section className="sql-main">
        <section className="sql-editor-panel">
          <div className="sql-panel-heading"><h2>SQL editor</h2><div className="sql-actions">{busy ? <button type="button" onClick={() => stop()}>Stop</button> : <button type="button" className="sql-run" onClick={() => execute({ action: 'query', sql })} disabled={reading || !sql.trim()}><Play size={16}/> Run query</button>}</div></div>
          <textarea aria-label="SQL query" spellCheck={false} value={sql} onChange={event => updateQuery(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!disabled) execute({ action: 'query', sql }); } }} />
          <div className="sql-editor-footer"><span>SQLite</span><span>Ctrl / ⌘ + Enter to run</span></div>
        </section>
        <section className="sql-results-panel">
          <div className="sql-panel-heading"><h2>Results</h2><button type="button" disabled={!result || disabled} onClick={downloadResults}><Download size={15}/> Export CSV</button></div>
          <div className="sql-result-status" role="status">{reading ? 'Reading files…' : status}</div>
          {error && <p className="sql-error" role="alert">{error}</p>}
          {result ? <><div className="sql-result-scroll"><table><thead><tr><th scope="col">#</th>{result.columns.map((column, i) => <th scope="col" key={i}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, i) => <tr key={i}><td>{i + 1}</td>{row.map((cell, j) => <td key={j}>{cell === null ? <i>NULL</i> : String(cell)}</td>)}</tr>)}</tbody></table></div>{result.truncated && <p className="sql-muted">Preview limited to 500 rows or 1 MB of displayed text. Export contains this preview.</p>}</> : <p className="sql-empty">{state?.tables.length ? 'No result table. Run a SELECT query to display rows.' : 'Import a CSV or load the example, then run a query.'}</p>}
        </section>
      </section>
    </div>
    {themeOpen && <div className="sql-theme-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setThemeOpen(false); }}><div className="sql-theme-dialog" role="dialog" aria-modal="true" aria-label="Choose SQL Playground theme"><div className="sql-theme-head"><strong>Theme</strong><button type="button" aria-label="Close themes" onClick={() => setThemeOpen(false)}><X size={17}/></button></div><ThemePicker value={themeId} onChange={setThemeId}/></div></div>}
  </main>;
}
