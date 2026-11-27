import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Database, Download, Play, Settings2, X, Table2, FileCode2, Trash2, Plus } from 'lucide-react';
import { cssVariables, getTheme } from '../app/themes';
import { loadSettings, saveSettings } from '../storage/settings';
import { FloatingPanel } from '../app/components/FloatingPanel';
import { ResizeHandle } from '../app/components/ResizeHandle';
import { SqlEditor } from './SqlEditor';
import { CreateDatabaseDialog, CreateTableDialog } from './SqlCreateDialogs';
import { ThemePicker } from '../app/components/ThemePicker';
import { MAX_CSV_BYTES, toCsv } from './csv';
import { formatIdentifier } from './identifiers';
import type { SqlRequest, SqlResponse, WorkerReply } from './engine';
import './sql-playground.css';

interface DatabaseSession { response?: SqlResponse; query: string; }
const databases = new Map<string, DatabaseSession>();
let selectedDatabase: string | null = null;

export function SqlPlayground({ onHome }: { onHome: () => void }) {
  const [settings, setSettings] = useState(loadSettings);
  const themeId = settings.theme;
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [editorRatio, setEditorRatio] = useState(55);
  const mainRef = useRef<HTMLElement>(null);
  const settingsAnchor = useRef<HTMLDivElement>(null);
  const theme = getTheme(themeId);
  const [themeOpen, setThemeOpen] = useState(false);
  const [activeDatabase, setActiveDatabase] = useState<string | null>(selectedDatabase);
  const [databaseNames, setDatabaseNames] = useState(() => [...databases.keys()]);
  const activeRef = useRef(selectedDatabase);
  const [modal, setModal] = useState<'database' | 'manual' | 'csv' | null>(null);
  const [state, setState] = useState<SqlResponse | undefined>(() => selectedDatabase ? databases.get(selectedDatabase)?.response : undefined);
  const [sql, setSql] = useState(() => selectedDatabase ? databases.get(selectedDatabase)?.query ?? '' : '');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState(selectedDatabase ? 'SQLite ready' : '');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const running = useRef(false);
  const alive = useRef(true);
  const database = useRef(state?.database);
  const disabled = busy || reading;

  useEffect(() => {
    try { saveSettings(settings); } catch { /* Theme remains active. */ }
    for (const [property, value] of Object.entries(cssVariables(theme))) document.documentElement.style.setProperty(property, value);
    document.documentElement.style.colorScheme = theme.appearance;
  }, [theme, settings]);
  useEffect(() => {
    if (!themeOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setThemeOpen(false); };
    const outside = (event: PointerEvent) => { if (!settingsAnchor.current?.contains(event.target as Node)) setThemeOpen(false); };
    window.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); };
  }, [themeOpen]);

  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined; };
  const dispose = () => { clearTimer(); worker.current?.terminate(); worker.current = null; running.current = false; };
  const stop = (message = 'Query stopped. Previous database kept.') => {
    dispose(); setBusy(false); setStatus(message);
  };
  function execute(request: Omit<SqlRequest, 'database'>) {
    if (running.current || !alive.current || !activeRef.current) return;
    const databaseName = activeRef.current;
    running.current = true; setBusy(true); setError(''); setStatus(request.action === 'import' ? 'Importing CSV…' : request.action === 'init' ? 'Loading SQLite…' : request.action === 'create' ? 'Creating table…' : 'Running…');
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
        const entry = databases.get(databaseName);
        if (!entry) return;
        entry.response = value; database.current = value.database; setState(value); setStatus(value.message);
        if (request.action === 'create' || request.action === 'import') setModal(null);
      };
      current.onerror = () => fail('SQLite failed to start. Try again or reload Pico.');
      timer.current = setTimeout(() => fail('SQLite took too long to load. Try again.'), 35_000);
      current.postMessage({ ...request, database: database.current });
    } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }
  useEffect(() => {
    alive.current = true;
    if (activeRef.current && !database.current) execute({ action: 'init' });
    return () => { alive.current = false; dispose(); };
  }, []);
  function updateQuery(value: string) {
    setSql(value);
    const entry = activeRef.current ? databases.get(activeRef.current) : undefined;
    if (entry) entry.query = value;
  }
  function selectDatabase(name: string) {
    if (running.current || reading) return;
    const entry = databases.get(name);
    if (!entry) return;
    selectedDatabase = name; activeRef.current = name; setActiveDatabase(name);
    database.current = entry.response?.database; setState(entry.response); setSql(entry.query);
    setError(''); setStatus(entry.response ? 'SQLite ready' : 'Loading SQLite…');
    if (!entry.response) execute({ action: 'init' });
  }
  function createDatabase(name: string) {
    if (databases.has(name) || running.current || reading) return;
    databases.set(name, { query: '' });
    setDatabaseNames([...databases.keys()]); selectDatabase(name); setModal('manual');
  }
  function openTable(mode: 'manual' | 'csv') {
    if (!activeRef.current || running.current || reading) return;
    setError(''); setModal(mode);
  }
  async function importFiles(files: File[]) {
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
  const runQuery = (value: string) => {
    if (activeDatabase && !disabled && value.trim()) execute({ action: 'query', sql: value });
  };
  return <main className="pico-app sql-app" data-pico-theme={theme.id} data-high-contrast={theme.highContrast ? 'true' : undefined} style={cssVariables(theme) as CSSProperties}>
    <header className="topbar pico-appbar sql-header">
      <div className="pico-appbar-lead">
        <button className="toolbar-button home-button" type="button" aria-label="Go to home screen" onClick={onHome}><ArrowLeft size={16}/></button>
        <button type="button" className="brand-lockup pico-brand-home" aria-label="Pico, back to Workspaces" onClick={onHome}><img className="brand-mark" src="/pico-logo.svg" alt="" width="26" height="26"/><span>Pico</span><span className="brand-period">.</span></button>
        <h1 className="sql-workspace-title">SQL Playground</h1>
      </div>
      <div className="topbar-spacer"/>
      <div className="settings-anchor" ref={settingsAnchor}>
        <button type="button" className={`topbar-icon ${themeOpen ? 'active' : ''}`} aria-label="Open settings" aria-expanded={themeOpen} title="Settings" onClick={() => setThemeOpen(open => !open)}><Settings2 size={16}/></button>
        <FloatingPanel anchor={settingsAnchor} open={themeOpen} className="settings-popover">
          <div className="settings-title"><div><Settings2 size={15}/><strong>Editor settings</strong></div><button className="icon-button quiet" aria-label="Close settings" onClick={() => setThemeOpen(false)}><X size={14}/></button></div>
          <label className="sql-setting-toggle"><span>Autocomplete</span><input type="checkbox" checked={settings.autocomplete} onChange={event => setSettings(previous => ({ ...previous, autocomplete: event.target.checked }))}/></label>
          <ThemePicker value={themeId} onChange={id => setSettings(previous => ({ ...previous, theme: id }))}/>
          <label className="font-setting"><span>Editor text size <b>{settings.fontSize}px</b></span><input type="range" min="12" max="24" value={settings.fontSize} onChange={event => setSettings(previous => ({ ...previous, fontSize: Number(event.target.value) }))}/></label>
          <button className="reset-layout-button" onClick={() => { setSidebarWidth(260); setEditorRatio(55); }}>Reset workspace layout</button>
        </FloatingPanel>
      </div>
      <div className="pico-appbar-run sql-actions">
        {busy && <button type="button" className="toolbar-button stop-button" onClick={() => stop()}><X size={15}/> Stop</button>}
        <button type="button" className="run-button sql-run" disabled={disabled || !activeDatabase || !sql.trim()} onClick={() => runQuery(sql)}><Play size={14} fill="currentColor"/> <span>Run query</span><kbd>Ctrl ↵</kbd></button>
      </div>
    </header>
    <div className="sql-layout" style={{ '--sql-sidebar-width': sidebarWidth + 'px' } as CSSProperties}>
      <aside className="sql-sidebar">
        <div className="sql-database-picker">
          <div className="sql-database-heading"><label htmlFor={databaseNames.length ? 'sql-database-select' : undefined}><Database size={16}/> Database</label>{!!databaseNames.length && <button type="button" className="topbar-icon sql-create-database" aria-label="Create database" title="Create database" disabled={disabled} onClick={() => { setError(''); setModal('database'); }}><Plus size={16}/></button>}</div>
          {databaseNames.length ? <select id="sql-database-select" value={activeDatabase ?? ''} disabled={disabled} onChange={event => selectDatabase(event.target.value)}>
            <option value="" disabled>Select a database</option>
            {databaseNames.map(name => <option key={name}>{name}</option>)}
          </select> : <button type="button" className="subtle-button sql-create-database" disabled={disabled} onClick={() => { setError(''); setModal('database'); }}><Plus size={15}/> Create database</button>}
        </div>
        {activeDatabase && <><div className="sql-panel-heading"><h2><Table2 size={16}/> Tables</h2><div className="sql-sidebar-actions"><button type="button" className="topbar-icon sql-create-table" aria-label="Create table" title="Create table" disabled={disabled} onClick={() => openTable('manual')}><Plus size={16}/></button>{!!state?.tables.length && <button type="button" className="topbar-icon" aria-label="Clear database" title="Clear database" disabled={disabled || !state?.tables.length} onClick={() => { if (window.confirm('Clear all tables in this SQL session?')) execute({ action: 'reset' }); }}><Trash2 size={15}/></button>}</div></div>
        <div className="sql-tables">
          {state?.tables.map(table => <details className="sql-table-item" key={table.name} open>
            <summary><Database size={15}/><span>{table.name}</span></summary>
            <button type="button" className="toolbar-button sql-preview-table" disabled={disabled} onClick={() => { const query = 'SELECT * FROM ' + formatIdentifier(table.name) + ';'; execute({ action: 'query', sql: query }); }}><Table2 size={14}/> View data</button>
            <ul>{table.columns.map((column, i) => <li key={i}><span>{column.name}</span><small>{column.type}</small></li>)}</ul>
          </details>)}
          {!state?.tables.length && <div className="sql-empty-state"><span className="console-placeholder-mark"><Table2 size={18}/></span><p>No tables yet</p></div>}
        </div></>}
        {!activeDatabase && <div className="sql-tables"/>}
        <div className="sql-sidebar-bottom">Databases stay on your device for this session.</div>
      </aside>
      <ResizeHandle axis="x" label="Resize table explorer" onResize={delta => setSidebarWidth(value => Math.max(190, Math.min(420, value + delta)))}/>
      <section ref={mainRef} className="sql-main" style={{ '--sql-editor-ratio': editorRatio + '%' } as CSSProperties}>
        <section className="editor-card sql-editor-panel">
          <div className="file-tabs sql-editor-tabs"><div className="file-tab active sql-file-tab"><FileCode2 size={15}/><span>query.sql</span></div></div>
          <SqlEditor key={activeDatabase ?? "no-database"} value={sql} onChange={updateQuery} onRun={runQuery} theme={theme} fontSize={settings.fontSize} autocomplete={settings.autocomplete} tables={state?.tables ?? []}/>
          <div className="editor-card-foot sql-editor-footer"><span>SQLite</span><span>{sql.split('\n').length} {sql.split('\n').length === 1 ? 'line' : 'lines'}</span></div>
        </section>
        <ResizeHandle axis="y" label="Resize query results" onResize={delta => setEditorRatio(value => Math.max(25, Math.min(75, value + delta / Math.max(1, mainRef.current?.clientHeight ?? 600) * 100)))}/>
        <section className="tool-dock sql-results-panel">
          <div className="dock-tab-row sql-dock-head"><div className="dock-tab active"><Table2 size={16}/> Results</div><span className="sql-result-status" role="status">{reading ? 'Reading files…' : status}</span><button type="button" className="toolbar-button" disabled={!result || disabled} onClick={downloadResults}><Download size={15}/> Export CSV</button></div>
          {error && <p className="sql-error" role="alert">{error}</p>}
          {result ? <><div className="sql-result-scroll"><table><thead><tr><th scope="col">#</th>{result.columns.map((column, i) => <th scope="col" key={i}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, i) => <tr key={i}><td>{i + 1}</td>{row.map((cell, j) => <td key={j}>{cell === null ? <i>NULL</i> : String(cell)}</td>)}</tr>)}</tbody></table></div>{result.truncated && <p className="sql-muted">Preview limited to 500 rows or 1 MB of displayed text. Export contains this preview.</p>}</> : <div className="sql-empty-state sql-empty-results"><span className="console-placeholder-mark"><Table2 size={20}/></span><p>{activeDatabase ? 'No results to display' : 'Create a database to begin'}</p></div>}
        </section>
      </section>
    </div>
    {modal === 'database' && <CreateDatabaseDialog names={databaseNames} onCreate={createDatabase} onClose={() => setModal(null)}/>}
    {(modal === 'manual' || modal === 'csv') && activeDatabase && <CreateTableDialog databaseName={activeDatabase} initialMode={modal} busy={disabled} stoppable={busy && !reading} error={error} onClose={() => { setModal(null); setError(''); }} onStop={() => { if (!reading) stop(); }} onCreate={table => execute({ action:'create', table })} onImport={files => { void importFiles(files); }}/>}
  </main>;
}
