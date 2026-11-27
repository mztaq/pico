import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Database, Download, Play, Settings2, X, Table2, FileCode2, Trash2, Plus, PencilRuler, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { cssVariables, getTheme } from '../app/themes';
import { loadSettings, saveSettings } from '../storage/settings';
import { FloatingPanel } from '../app/components/FloatingPanel';
import { ResizeHandle } from '../app/components/ResizeHandle';
import { SqlEditor } from './SqlEditor';
import { CreateDatabaseDialog, CreateTableDialog } from './SqlCreateDialogs';
import { Modal } from './SqlDialog';
import { DesignView } from './SqlTableDesign';
import { ThemePicker } from '../app/components/ThemePicker';
import { toCsv } from './csv';
import { formatIdentifier } from './identifiers';
import { diagnoseSqlError, type SqlDiagnostic } from './diagnostics';
import type { SqlRequest, SqlResponse, WorkerReply, TableInfo } from './engine';
import { loadSqlState, saveDatabase, saveSelection, saveQuery, saveLayout, saveNamedQueries, type SavedQuery, type DatabaseSession, type SqlLayout } from './storage';
import './sql-playground.css';

const databases = new Map<string, DatabaseSession>();
let selectedDatabase: string | null = null;
let savedLayout: SqlLayout = { sidebarWidth:260, editorRatio:55 };
let restored = false;
let storageAvailable = false;
let restoration: Promise<void> | undefined;
function restoreWorkspace() {
  restoration ??= loadSqlState().then(saved => {
    databases.clear();
    for (const [name, entry] of saved.databases) databases.set(name,entry);
    selectedDatabase=saved.selected; savedLayout=saved.layout; storageAvailable=true;
  }).catch(()=>{ storageAvailable=false; }).finally(()=>{ restored=true; });
  return restoration;
}

export function SqlPlayground({ onHome }: { onHome: () => void }) {
  const [settings, setSettings] = useState(loadSettings);
  const themeId = settings.theme;
  const [sidebarWidth, setSidebarWidth] = useState(savedLayout.sidebarWidth);
  const [editorRatio, setEditorRatio] = useState(savedLayout.editorRatio);
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
  const [loading, setLoading] = useState(!restored);
  const [storageError, setStorageError] = useState(restored && !storageAvailable ? 'Local storage is unavailable. Changes will not survive a refresh.' : '');
  const [tablesOpen,setTablesOpen] = useState(true);
  const [queriesOpen,setQueriesOpen] = useState(true);
  const [selectedTable,setSelectedTable] = useState<string|null>(null);
  const [savedQueries,setSavedQueries] = useState<SavedQuery[]>(()=>selectedDatabase?databases.get(selectedDatabase)?.savedQueries??[]:[]);
  const [selectedQuery,setSelectedQuery] = useState<string|null>(null);
  const [queryName,setQueryName] = useState<string|null>(null);
  const [nameError,setNameError] = useState('');
  const [designTable, setDesignTable] = useState<TableInfo | null>(null);
  const [status, setStatus] = useState(selectedDatabase ? 'SQLite ready' : '');
  const [error, setError] = useState('');
  const [queryError, setQueryError] = useState<{ diagnostic: SqlDiagnostic; source: string } | null>(null);
  const worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const running = useRef(false);
  const alive = useRef(true);
  const database = useRef(state?.database);
  const disabled = busy || loading;

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

  function reportStorageError() {
    if (alive.current) setStorageError('Local save failed. Your latest changes might be lost after refreshing. Export important data or free browser storage.');
  }
  function persist(promise: Promise<void>) { void promise.catch(reportStorageError); }
  useEffect(() => {
    if (loading) return;
    savedLayout = { sidebarWidth, editorRatio };
    if (storageAvailable) persist(saveLayout(savedLayout));
  }, [loading, sidebarWidth, editorRatio]);
  const clearTimer = () => { clearTimeout(timer.current); timer.current = undefined; };
  const dispose = () => { clearTimer(); worker.current?.terminate(); worker.current = null; running.current = false; };
  const [saving, setSaving] = useState(false);
  const stop = (message = 'Query stopped. Previous database kept.') => {
    if (saving) return;
    dispose(); setBusy(false); setStatus(message);
  };
  function execute(request: Omit<SqlRequest, 'database'>) {
    if (running.current || !alive.current || !activeRef.current) return;
    const databaseName = activeRef.current;
    running.current = true; setBusy(true); setError(''); setQueryError(null); setStatus(request.action === 'import' ? 'Importing CSV…' : request.action === 'init' ? 'Loading SQLite…' : request.action === 'create' ? 'Creating table…' : request.action === 'design' ? 'Saving design…' : 'Running…');
    const fail = (message: string) => { dispose(); setBusy(false); setError(message); setStatus('Previous database kept'); };
    try {
      worker.current ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      const current = worker.current;
      current.onmessage = async (event: MessageEvent<WorkerReply>) => {
        if (!alive.current || worker.current !== current) return;
        const reply = event.data;
        if ('ready' in reply) {
          clearTimer();
          timer.current = setTimeout(() => fail('Operation exceeded the 12-second limit.'), 12_000);
          return;
        }
        clearTimer();
        if (!reply.ok) {
          running.current = false; setBusy(false);
          if (request.action === 'query' && request.sql) setQueryError({ diagnostic: diagnoseSqlError(reply.error, request.sql), source: request.sql });
          else setError(reply.error);
          setStatus('Previous database kept'); return;
        }
        const value = reply.value;
        const entry = databases.get(databaseName);
        if (!entry) { running.current=false; setBusy(false); return; }
        entry.response = value;
        if (storageAvailable) {
          setSaving(true); setStatus('Saving…');
          try { await saveDatabase(databaseName,entry); } catch { reportStorageError(); }
        }
        if (!alive.current || worker.current !== current) return;
        running.current = false; setSaving(false); setBusy(false);
        database.current = value.database; setState(value); setStatus(value.message);
        if (request.action === 'create' || request.action === 'import') setModal(null);
        if (request.action === 'design') setDesignTable(null);
      };
      current.onerror = () => fail('SQLite failed to start. Try again or reload Pico.');
      timer.current = setTimeout(() => fail('SQLite took too long to load. Try again.'), 35_000);
      current.postMessage({ ...request, database: database.current });
    } catch (err) { fail(err instanceof Error ? err.message : String(err)); }
  }
  useEffect(() => {
    alive.current = true;
    let cancelled=false;
    void restoreWorkspace().then(()=>{
      if(cancelled) return;
      const name=selectedDatabase;
      const entry=name?databases.get(name):undefined;
      activeRef.current=name; setActiveDatabase(name); setDatabaseNames([...databases.keys()]);
      setSavedQueries(entry?.savedQueries??[]); setSelectedTable(null); setSelectedQuery(null);
      database.current=entry?.response?.database; setState(entry?.response); setSql(entry?.query??'');
      setSidebarWidth(savedLayout.sidebarWidth); setEditorRatio(savedLayout.editorRatio);
      setStatus(entry?.response?.message??(name?'SQLite ready':''));
      if (!storageAvailable) setStorageError('Local storage is unavailable. Changes will not survive a refresh.');
      setLoading(false);
      if(name&&!entry?.response) execute({action:'init'});
    });
    return () => { cancelled=true; alive.current=false; dispose(); };
  }, []);
  function updateQuery(value: string) {
    setSql(value);
    setQueryError(previous => previous?.source === value ? previous : null);
    const entry = activeRef.current ? databases.get(activeRef.current) : undefined;
    if (entry && activeRef.current) {
      entry.query = value;
      if (storageAvailable) persist(saveQuery(activeRef.current,value));
    }
  }
  function selectDatabase(name: string) {
    if (running.current || loading) return;
    const entry = databases.get(name);
    if (!entry) return;
    selectedDatabase = name; activeRef.current = name; setActiveDatabase(name);
    if (storageAvailable) persist(saveSelection(name));
    setSavedQueries(entry.savedQueries??[]); setSelectedTable(null); setSelectedQuery(null);
    database.current = entry.response?.database; setState(entry.response); setSql(entry.query);
    setError(''); setQueryError(null); setStatus(entry.response ? 'SQLite ready' : 'Loading SQLite…');
    if (!entry.response) execute({ action: 'init' });
  }
  function createDatabase(name: string) {
    if (databases.has(name) || running.current || loading) return;
    const entry = { query: '' };
    databases.set(name, entry);
    if (storageAvailable) { persist(saveQuery(name,'')); persist(saveDatabase(name,entry)); }
    setDatabaseNames([...databases.keys()]); selectDatabase(name); setModal('manual');
  }
  function openTable(mode: 'manual' | 'csv') {
    if (!activeRef.current || running.current || loading) return;
    setError(''); setQueryError(null); setTablesOpen(true); setModal(mode);
  }
  function changeSavedQueries(next:SavedQuery[]) {
    const name=activeRef.current;
    const entry=name?databases.get(name):undefined;
    if(!name||!entry)return;
    entry.savedQueries=next;setSavedQueries(next);
    if(storageAvailable)persist(saveNamedQueries(name,next));
  }
  function saveCurrentQuery() {
    if(!activeDatabase||disabled||!sql.trim())return;
    if(selectedQuery) {
      changeSavedQueries(savedQueries.map(query=>query.name===selectedQuery?{...query,sql}:query));
      return;
    }
    setNameError('');setQueryName('');
  }
  function saveAsQuery() {
    const name=queryName?.trim()??'';
    if(!name||name.length>80){setNameError('Enter a query name (1–80 characters).');return;}
    if(savedQueries.some(query=>query.name.toLowerCase()===name.toLowerCase())){setNameError('A query with this name already exists.');return;}
    changeSavedQueries([...savedQueries,{name,sql}]);setSelectedQuery(name);setQueryName(null);setQueriesOpen(true);
  }
  function openSavedQuery(query:SavedQuery) {
    if(disabled)return;
    setSelectedQuery(query.name);updateQuery(query.sql);
  }
  function deleteSavedQuery(query:SavedQuery) {
    if(disabled||!window.confirm('Delete saved query "'+query.name+'"?'))return;
    changeSavedQueries(savedQueries.filter(item=>item.name!==query.name));
    if(selectedQuery===query.name)setSelectedQuery(null);
  }
  function viewTable(table:TableInfo) {
    if(disabled)return;
    setSelectedTable(table.name);
    execute({action:'query',sql:'SELECT * FROM '+formatIdentifier(table.name)+';'});
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
        {busy && !saving && <button type="button" className="toolbar-button stop-button" onClick={() => stop()}><X size={15}/> Stop</button>}
        <button type="button" className="run-button sql-run" disabled={disabled || !activeDatabase || !sql.trim()} onClick={() => runQuery(sql)}><Play size={14} fill="currentColor"/> <span>Run query</span><kbd>Ctrl ↵</kbd></button>
      </div>
    </header>
    {storageError && <div className="sql-storage-warning" role="alert">{storageError}</div>}
    <div className="sql-layout" style={{ '--sql-sidebar-width': sidebarWidth + 'px' } as CSSProperties}>
      <aside className="sql-sidebar">
        <div className="sql-database-picker">
          <div className="sql-database-heading"><label htmlFor={databaseNames.length ? 'sql-database-select' : undefined}><Database size={16}/> Database</label>{!!databaseNames.length && <button type="button" className="topbar-icon sql-create-database" aria-label="Create database" title="Create database" disabled={disabled} onClick={() => { setError(''); setModal('database'); }}><Plus size={16}/></button>}</div>
          {databaseNames.length ? <select id="sql-database-select" value={activeDatabase ?? ''} disabled={disabled} onChange={event => selectDatabase(event.target.value)}>
            <option value="" disabled>Select a database</option>
            {databaseNames.map(name => <option key={name}>{name}</option>)}
          </select> : <button type="button" className="subtle-button sql-create-database" disabled={disabled} onClick={() => { setError(''); setModal('database'); }}><Plus size={15}/> Create database</button>}
        </div>
        <nav className="sql-object-nav" aria-label="Database objects">
          {activeDatabase && <>
            <section className="sql-object-group">
              <div className="sql-object-heading"><button type="button" className="sql-group-toggle" aria-expanded={tablesOpen} onClick={()=>setTablesOpen(value=>!value)}><span>Tables</span>{tablesOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button><button type="button" className="topbar-icon sql-create-table" aria-label="Create table" title="Create table" disabled={disabled} onClick={()=>openTable('manual')}><Plus size={15}/></button>{!!state?.tables.length&&<button type="button" className="topbar-icon" aria-label="Clear database" title="Clear database" disabled={disabled} onClick={()=>{if(window.confirm('Permanently clear all tables in this database?')){setSelectedTable(null);execute({action:'reset'});}}}><Trash2 size={14}/></button>}</div>
              {tablesOpen&&<div className="sql-object-list">
                {state?.tables.map(table=><div className={'sql-object-row'+(selectedTable===table.name?' selected':'')} key={table.name}>
                  <button type="button" className="sql-object-open sql-preview-table" title={table.name} disabled={disabled} onClick={()=>viewTable(table)}><Table2 size={16}/><span>{table.name}</span></button>
                  {table.kind!=='view'&&<button type="button" className="topbar-icon sql-object-action" title="Design View" aria-label={'Design View: '+table.name} disabled={disabled} onClick={()=>{setSelectedTable(table.name);setError('');setQueryError(null);setDesignTable(table);}}><PencilRuler size={14}/></button>}
                </div>)}
                {!state?.tables.length&&<div className="sql-object-empty">No tables</div>}
              </div>}
            </section>
            <section className="sql-object-group">
              <div className="sql-object-heading"><button type="button" className="sql-group-toggle" aria-expanded={queriesOpen} onClick={()=>setQueriesOpen(value=>!value)}><span>Queries</span>{queriesOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button><button type="button" className="topbar-icon" aria-label="New query" title="New query" disabled={disabled} onClick={()=>{setSelectedQuery(null);updateQuery('');setQueriesOpen(true);}}><Plus size={15}/></button></div>
              {queriesOpen&&<div className="sql-object-list">
                {savedQueries.map(query=><div className={'sql-object-row'+(selectedQuery===query.name?' selected':'')} key={query.name}>
                  <button type="button" className="sql-object-open" title={query.name} disabled={disabled} onClick={()=>openSavedQuery(query)}><FileCode2 size={16}/><span>{query.name}</span></button>
                  <button type="button" className="topbar-icon sql-object-action" title="Delete saved query" aria-label={'Delete query '+query.name} disabled={disabled} onClick={()=>deleteSavedQuery(query)}><Trash2 size={14}/></button>
                </div>)}
                {!savedQueries.length&&<div className="sql-object-empty">No saved queries</div>}
              </div>}
            </section>
          </>}
        </nav>
        <div className="sql-sidebar-bottom">Databases are stored on this device.</div>
      </aside>
      <ResizeHandle axis="x" label="Resize table explorer" onResize={delta => setSidebarWidth(value => Math.max(190, Math.min(420, value + delta)))}/>
      <section ref={mainRef} className="sql-main" style={{ '--sql-editor-ratio': editorRatio + '%' } as CSSProperties}>
        <section className="editor-card sql-editor-panel">
          <div className="file-tabs sql-editor-tabs"><div className="file-tab active sql-file-tab"><FileCode2 size={15}/><span>{selectedQuery??'query.sql'}</span></div><button type="button" className="toolbar-button sql-save-query" disabled={disabled||!activeDatabase||!sql.trim()} onClick={saveCurrentQuery}><Save size={14}/> Save query</button></div>
          {loading ? <div className="sql-empty-state sql-code-editor" role="status">Opening saved databases…</div> : <SqlEditor key={(activeDatabase??'no-database')+'::'+(selectedQuery??'draft')} value={sql} onChange={updateQuery} onRun={runQuery} theme={theme} fontSize={settings.fontSize} autocomplete={settings.autocomplete} tables={state?.tables ?? []} diagnostic={queryError?.source === sql ? queryError.diagnostic : undefined}/>}
          <div className="editor-card-foot sql-editor-footer"><span>SQLite</span><span>{sql.split('\n').length} {sql.split('\n').length === 1 ? 'line' : 'lines'}</span></div>
        </section>
        <ResizeHandle axis="y" label="Resize query results" onResize={delta => setEditorRatio(value => Math.max(25, Math.min(75, value + delta / Math.max(1, mainRef.current?.clientHeight ?? 600) * 100)))}/>
        <section className="tool-dock sql-results-panel">
          <div className="dock-tab-row sql-dock-head"><div className="dock-tab active"><Table2 size={16}/> Results</div><span className="sql-result-status" role="status">{status}</span><button type="button" className="toolbar-button" disabled={!result || disabled} onClick={downloadResults}><Download size={15}/> Export CSV</button></div>
          {error && <p className="sql-error" role="alert">{error}</p>}
          {queryError && <div className="sql-error sql-query-error" role="alert"><strong>{queryError.diagnostic.title}{queryError.source === sql && queryError.diagnostic.line ? ' · Line ' + queryError.diagnostic.line : ''}</strong><p>{queryError.diagnostic.message}</p>{queryError.diagnostic.detail !== queryError.diagnostic.message && <details><summary>Technical details</summary><code>{queryError.diagnostic.detail}</code></details>}</div>}
          {result ? <><div className="sql-result-scroll"><table><thead><tr>{result.columns.map((column, i) => <th scope="col" key={i}>{column}</th>)}</tr></thead><tbody>{result.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell === null ? <i>NULL</i> : String(cell)}</td>)}</tr>)}</tbody></table></div>{result.truncated && <p className="sql-muted">Preview limited to 500 rows or 1 MB of displayed text. Export contains this preview.</p>}</> : <div className="sql-empty-state sql-empty-results"><span className="console-placeholder-mark"><Table2 size={20}/></span><p>{loading ? 'Restoring workspace…' : activeDatabase ? 'No results to display' : 'Create a database to begin'}</p></div>}
        </section>
      </section>
    </div>
    {queryName!==null&&<Modal title="Save query" onClose={()=>setQueryName(null)}><form className="sql-dialog-form" onSubmit={event=>{event.preventDefault();saveAsQuery();}}><label>Query name<input autoFocus maxLength={80} value={queryName} onChange={event=>{setQueryName(event.target.value);setNameError('');}} placeholder="Enter a query name"/></label>{nameError&&<p className="sql-dialog-error" role="alert">{nameError}</p>}<div className="sql-dialog-actions"><button type="button" className="subtle-button" onClick={()=>setQueryName(null)}>Cancel</button><button type="submit" className="run-button" disabled={!queryName.trim()}>Save</button></div></form></Modal>}
    {modal === 'database' && <CreateDatabaseDialog names={databaseNames} onCreate={createDatabase} onClose={() => setModal(null)}/>}
    {(modal === 'manual' || modal === 'csv') && activeDatabase && <CreateTableDialog databaseName={activeDatabase} initialMode={modal} busy={disabled} stoppable={busy && !saving} error={error} onClose={() => { setModal(null); setError(''); }} onStop={()=>stop()} onCreate={table => execute({ action:'create', table })} existingNames={state?.tables.map(table=>table.name)??[]} onImport={files => execute({action:'import',files})}/>}
    {designTable && <DesignView table={designTable} busy={busy} stoppable={busy && !saving} error={error} onClose={()=>{setDesignTable(null);setError('');}} onStop={()=>stop()} onSave={design=>execute({action:'design',design})}/>}
  </main>;
}
