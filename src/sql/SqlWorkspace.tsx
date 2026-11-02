import { useEffect, useRef, useState } from 'react';
import type { Diagnostic } from '@codemirror/lint';
import { ArrowLeft, BookOpen, BugPlay, Database, Play, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import type { Database as SqlDatabase } from 'sql.js';
import { cssVariables, getTheme } from '../app/themes';
import { SoundButton } from '../app/components/SoundToggle';
import { playCue } from '../app/sound';
import { loadSettings } from '../storage/settings';
import { challenges } from './challenges';
import { createDatabase, runQuery, sampleRows, tables, type QueryResult } from './engine';
import { correctionFor, type Correction } from './editorHelp';
import { inspectQuery, type QueryInspection } from './inspection';
import { SqlEditor, type SqlEditorHandle, type SqlEditorOptions } from './SqlEditor';
import './sql.css';

const KEY = 'pico.sql.v1';
const DEFAULT_SQL = 'SELECT Name, YearGroup\nFROM Students\nWHERE YearGroup = 10\nORDER BY Name;';
type Mode = 'explore' | 'challenges';
const DEFAULT_OPTIONS: SqlEditorOptions = { autocomplete: true, hoverDocs: true, fixSuggestions: true };
interface Saved { sql: string; mode: Mode; challenge: string; completed: string[]; database?: string; options: SqlEditorOptions }
function load(): Saved {
  try { const value = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>; return { sql: typeof value.sql === 'string' ? value.sql : DEFAULT_SQL, mode: value.mode === 'challenges' ? 'challenges' : 'explore', challenge: challenges.some(item => item.id === value.challenge) ? value.challenge! : challenges[0]!.id, completed: Array.isArray(value.completed) ? value.completed.filter((id): id is string => typeof id === 'string') : [], database: typeof value.database === 'string' ? value.database : undefined, options: { autocomplete: value.options?.autocomplete !== false, hoverDocs: value.options?.hoverDocs !== false, fixSuggestions: value.options?.fixSuggestions !== false } }; }
  catch { return { sql: DEFAULT_SQL, mode: 'explore', challenge: challenges[0]!.id, completed: [], options: DEFAULT_OPTIONS }; }
}
function encode(bytes: Uint8Array): string { let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); }
function decode(text: string): Uint8Array { return Uint8Array.from(atob(text), char => char.charCodeAt(0)); }
function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such column/i.test(message)) return `${message}. Check the column names in the table browser.`;
  if (/no such table/i.test(message)) return `${message}. Try Students, Clubs or Results.`;
  if (/syntax error/i.test(message)) return `${message}. Check your keywords, commas and quotes.`;
  if (/FOREIGN KEY constraint/i.test(message)) return 'That student or club ID does not exist. Pick an ID from the linked table.';
  if (/UNIQUE constraint/i.test(message)) return 'That primary key is already in use. Choose a different ID.';
  return message;
}
function diagnosticFor(source: string, message: string, correction: Correction | null): Diagnostic {
  const token = /near ["']([^"']+)["']|no such (?:table|column):\s*([\w.]+)/i.exec(message)?.slice(1).find(Boolean);
  const position = correction?.from ?? (token ? source.toLowerCase().indexOf(token.toLowerCase()) : -1);
  const from = Math.max(0, position);
  return { from, to: Math.min(source.length, Math.max(from + 1, correction?.to ?? from + (token?.length ?? 1))), severity: 'error', message };
}

const examples = [
  { label: 'Year 10 students', sql: 'SELECT Name, YearGroup\nFROM Students\nWHERE YearGroup = 10\nORDER BY Name;' },
  { label: 'Club members', sql: 'SELECT Clubs.ClubName, COUNT(*) AS Members\nFROM Students\nJOIN Clubs ON Students.ClubID = Clubs.ClubID\nGROUP BY Clubs.ClubID\nORDER BY Members DESC;' },
  { label: 'Average score', sql: 'SELECT AVG(Score) AS AverageScore\nFROM Results;' },
  { label: 'High scores', sql: 'SELECT Students.Name, Results.Score\nFROM Results\nJOIN Students ON Results.StudentID = Students.StudentID\nWHERE Results.Score > 85\nORDER BY Results.Score DESC;' },
];

export function SqlWorkspace({ onHome }: { onHome: () => void }) {
  const [saved] = useState(load);
  const [sql, setSql] = useState(saved.sql);
  const [mode, setMode] = useState<Mode>(saved.mode);
  const [challengeId, setChallengeId] = useState(saved.challenge);
  const [completed, setCompleted] = useState(saved.completed);
  const [hint, setHint] = useState(0);
  const [answer, setAnswer] = useState(false);
  const [db, setDb] = useState<SqlDatabase | null>(null);
  const [selectedTable, setSelectedTable] = useState('Students');
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<string | null>(null);
  const [sample, setSample] = useState<QueryResult | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Run the starter query to see data flow into the results.');
  const [saveError, setSaveError] = useState(false);
  const [view, setView] = useState<'tables' | 'schema'>('tables');
  const [options, setOptions] = useState(saved.options);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspection, setInspection] = useState<QueryInspection | null>(null);
  const [correction, setCorrection] = useState<Correction | null>(null);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const theme = getTheme(loadSettings().theme);
  const editor = useRef<SqlEditorHandle | null>(null);
  const sqlRef = useRef(sql); sqlRef.current = sql;
  const dbRef = useRef<SqlDatabase | null>(null); dbRef.current = db;
  const challenge = challenges.find(item => item.id === challengeId)!;

  useEffect(() => {
    let active = true;
    let data: Uint8Array | undefined;
    try { data = saved.database ? decode(saved.database) : undefined; } catch { /* Rebuild invalid saved data. */ }
    createDatabase(data).then(database => { if (active) setDb(database); else database.close(); }).catch(error => setError(friendlyError(error)));
    return () => { active = false; };
  }, []);
  useEffect(() => () => { dbRef.current?.close(); }, []);
  useEffect(() => { if (db) setSample(sampleRows(db, selectedTable)); }, [db, selectedTable, result]);
  useEffect(() => {
    const timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify({ sql, mode, challenge: challengeId, completed, database: db ? encode(db.export()) : undefined, options } satisfies Saved)); db?.exec('PRAGMA foreign_keys = ON'); setSaveError(false); } catch { setSaveError(true); } }, 350);
    return () => clearTimeout(timer);
  }, [sql, mode, challengeId, completed, db, result, options]);
  function replaceSql(text: string) { if (editor.current) editor.current.replace(text); else setSql(text); setError(''); setCorrection(null); setDiagnostic(null); setInspection(null); }
  function changeSql(text: string) { setSql(text); setError(''); setCorrection(null); setDiagnostic(null); setInspection(null); }
  function useExample(text: string) { replaceSql(text); setExamplesOpen(false); playCue('tab'); }
  function run() {
    const database = dbRef.current; if (!database) { setNotice('The practice database is loading.'); return; }
    setError(''); setCorrection(null); setDiagnostic(null); playCue('run');
    try {
      const output = runQuery(database, sqlRef.current);
      setResult(output); setInspection(inspectQuery(database, sqlRef.current, output)); setNotice(output.explanation);
      if (mode === 'challenges') {
        const task = challenges.find(item => item.id === challengeId)!;
        if (task.check(database, output)) { setCompleted(items => items.includes(task.id) ? items : [...items, task.id]); setNotice(`Nice work! ${task.why}`); playCue('success'); }
        else setNotice(`${output.explanation} Keep trying: ${task.goal}`);
      }
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      const message = friendlyError(cause);
      const fix = options.fixSuggestions ? correctionFor(sqlRef.current, raw) : null;
      setResult(null); setInspection(null); setInspectorOpen(false); setError(message); setCorrection(fix); setDiagnostic(diagnosticFor(sqlRef.current, message, fix)); setNotice('Your database is ready for another try.'); playCue('error');
    }
  }
  function applyCorrection() { if (!correction) return; editor.current?.replaceRange(correction.from, correction.to, correction.replacement); setCorrection(null); setDiagnostic(null); setError(''); setNotice('Correction applied. Run again to check your query.'); playCue('success'); }
  async function reset() {
    if (!window.confirm('Restore the original sample rows? Your SQL and completed challenges stay saved. Any data edits will be lost.')) return;
    db?.close(); const fresh = await createDatabase(); setDb(fresh); setResult(null); setInspection(null); setError(''); setCorrection(null); setDiagnostic(null); setNotice('Sample data restored. Ready for a fresh query!'); playCue('success');
  }
  function chooseChallenge(id: string) { setChallengeId(id); setHint(0); setAnswer(false); const task = challenges.find(item => item.id === id)!; replaceSql(task.starter); setResult(null); setError(''); setNotice(task.goal); }
  const relation = selectedRelation === 'student-club' ? { from: 'Students.ClubID', to: 'Clubs.ClubID', example: 'Amina → Robotics (ClubID 1)' } : { from: 'Results.StudentID', to: 'Students.StudentID', example: 'Score 92 → Amina (StudentID 1)' };
  return <div className="sql-app" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="sql-header">
      <button className="sql-back" onClick={onHome} aria-label="Back to home"><ArrowLeft size={18} /></button>
      <img src="/pico-logo.svg" alt="" /><strong>Pico<span>.</span></strong><span className="sql-divider" /><h1>SQL Playground</h1>
      <span className="sql-local">● Local practice database</span><SoundButton />
    </header>
    <div className="sql-toolbar">
      <div className="sql-modes" role="group" aria-label="Activity mode"><button className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}>Explore</button><button className={mode === 'challenges' ? 'active' : ''} onClick={() => setMode('challenges')}>Challenges <span>{completed.length}/{challenges.length}</span></button></div>
      <div className="sql-actions">
        <button className={inspectorOpen ? 'active' : ''} onClick={() => setInspectorOpen(value => !value)} aria-pressed={inspectorOpen}><BugPlay size={16} /> Inspect query</button>
        <div className="sql-options-wrap"><button onClick={() => setSettingsOpen(value => !value)} aria-expanded={settingsOpen} aria-controls="sql-options"><Settings2 size={16} /> Options</button>
          {settingsOpen && <div id="sql-options" className="sql-options" role="group" aria-label="SQL editor options"><strong>Editor help</strong>
            <label><input type="checkbox" checked={options.autocomplete} onChange={event => setOptions(value => ({ ...value, autocomplete: event.target.checked }))} /> Autocomplete tables and keywords</label>
            <label><input type="checkbox" checked={options.hoverDocs} onChange={event => setOptions(value => ({ ...value, hoverDocs: event.target.checked }))} /> Hover documentation</label>
            <label><input type="checkbox" checked={options.fixSuggestions} onChange={event => setOptions(value => ({ ...value, fixSuggestions: event.target.checked }))} /> Suggest corrections after errors</label>
          </div>}
        </div>
        <button className="sql-reset" onClick={reset}><RotateCcw size={15} /> Reset data</button>
        <button className="sql-run" onClick={run} disabled={!db}><Play size={15} fill="currentColor" /> Run <kbd>Ctrl ↵</kbd></button>
      </div>
    </div>
    <main className="sql-layout">
      <aside className="sql-browser" aria-label="Database browser">
        <div className="sql-tabs"><button className={view === 'tables' ? 'active' : ''} onClick={() => setView('tables')}>Tables</button><button className={view === 'schema' ? 'active' : ''} onClick={() => setView('schema')}>Relationships</button></div>
        {view === 'tables' ? <>
          <p className="sql-browser-tip">Click to inspect. Use <b>Try query</b> when you want to edit the SQL.</p>
          {tables.map(table => <section className="sql-table-card" key={table.name}>
            <button className={`sql-table-heading ${selectedTable === table.name ? 'selected' : ''}`} onClick={() => { setSelectedTable(table.name); setSelectedColumn(null); }} aria-expanded={selectedTable === table.name}><Database size={16} /><b>{table.name}</b><small>{table.description}</small></button>
            {selectedTable === table.name && <>
              <div className="sql-browser-preview"><button onClick={() => useExample(`SELECT * FROM ${table.name};`)}>Try query: all {table.name.toLowerCase()}</button></div>
              <div className="sql-columns">{table.columns.map(column => <div className="sql-column-row" key={column.name}>
                <button className={`sql-column-select ${selectedColumn === column.name ? 'selected' : ''}`} onClick={() => setSelectedColumn(column.name)} aria-label={`Inspect ${table.name}.${column.name}`}><span>{column.name}</span><small>{column.type}</small>{column.primary && <em>PK</em>}{column.foreign && <em title={`References ${column.foreign}`}>FK</em>}</button>
                <button className="sql-column-try" onClick={() => useExample(`SELECT ${column.name}\nFROM ${table.name};`)} aria-label={`Try a query for ${table.name}.${column.name}`}>Try</button>
              </div>)}</div>
              {selectedColumn && <p className="sql-column-note"><b>{selectedColumn}</b> · {table.columns.find(column => column.name === selectedColumn)?.foreign ? `Foreign key linking to ${table.columns.find(column => column.name === selectedColumn)?.foreign}` : table.columns.find(column => column.name === selectedColumn)?.primary ? 'Primary key that uniquely identifies each row' : `${table.columns.find(column => column.name === selectedColumn)?.type} value in each row`}.</p>}
              <div className="sql-mini"><b>Sample rows</b><div className="sql-scroll"><DataTable result={sample} /></div></div>
            </>}
          </section>)}
        </> : <div className="sql-schema"><p>Keys connect records across tables. Select a link to see matching values.</p><div className="sql-schema-nodes"><div>Clubs <small>ClubID · primary key</small></div><button className={selectedRelation === 'student-club' ? 'active' : ''} onClick={() => setSelectedRelation('student-club')}>↓ ClubID links students to clubs</button><div>Students <small>StudentID · primary key<br />ClubID · foreign key</small></div><button className={selectedRelation === 'result-student' ? 'active' : ''} onClick={() => setSelectedRelation('result-student')}>↓ StudentID links results to students</button><div>Results <small>ResultID · primary key<br />StudentID · foreign key</small></div></div>{selectedRelation && <p className="sql-relation-detail"><b>{relation.from} → {relation.to}</b><br />Example: {relation.example}</p>}</div>}
      </aside>
      <div className="sql-main">
        <section className="sql-editor-panel" aria-labelledby="sql-editor-title">
          <div className="sql-panel-head"><div><span className="sql-kicker">WORKSPACE</span><h2 id="sql-editor-title">Query editor</h2></div><button className="sql-example-trigger" onClick={() => setExamplesOpen(value => !value)} aria-expanded={examplesOpen}><BookOpen size={15} /> Examples</button></div>
          {examplesOpen && <div className="sql-examples" role="group" aria-label="Example queries">{examples.map(example => <button key={example.label} onClick={() => useExample(example.sql)}>{example.label}</button>)}</div>}
          <p id="sql-editor-help" className="sql-editor-help">One statement at a time · Ctrl+Enter to run · Hover over a keyword for help</p>
          <SqlEditor ref={editor} value={saved.sql} onChange={changeSql} onRun={run} theme={theme} options={options} diagnostic={diagnostic} />
          {error && <div id="sql-editor-error" className="sql-inline-error" role="alert"><strong>Check this query</strong><span>{error}</span>{correction && <button onClick={applyCorrection}>Replace {correction.original} with {correction.replacement}</button>}</div>}
        </section>
        <section className="sql-results" aria-labelledby="sql-results-title">
          <div className="sql-panel-head sql-results-head"><div><span className="sql-kicker">OUTPUT</span><h2 id="sql-results-title">{inspectorOpen ? 'Query inspector' : 'Results'}</h2></div><div className="sql-result-controls"><button className={!inspectorOpen ? 'active' : ''} onClick={() => setInspectorOpen(false)}>Results</button><button className={inspectorOpen ? 'active' : ''} onClick={() => setInspectorOpen(true)}>Inspect</button>{result && <span>{result.kind === 'select' ? `${result.rows.length} rows · ${result.columns.length} columns` : `${result.changes} rows changed`}</span>}</div></div>
          {inspectorOpen ? inspection ? <div className="sql-inspector"><p>How your query moved through the data:</p><div className="sql-inspector-steps">{inspection.steps.map(step => <div className="sql-inspector-step" key={step.label}><b>{step.label}</b><span>{step.detail}</span></div>)}</div>{inspection.plan.length > 0 && <details><summary>SQLite query plan</summary><p>SQLite's own description of how it read the tables:</p>{inspection.plan.map((line, index) => <code key={index}>{line}</code>)}</details>}</div> : <div className="sql-empty"><BugPlay size={26} /><b>Run a query to inspect it</b><span>See each clause in order and how SQLite accessed the tables.</span></div> : <>
            {result && <div className="sql-feedback-banner" aria-live="polite"><span>{notice}</span>{result.cues.length > 0 && <div className="sql-cues">{result.cues.map(cue => <span key={cue}>{cue}</span>)}</div>}</div>}
            {error ? <div className="sql-empty"><span>Fix the marked query above, then run it again.</span></div> : result?.kind === 'select' ? result.rows.length ? <div className="sql-result-scroll"><DataTable result={result} highlight /></div> : <div className="sql-empty"><b>No matching rows yet</b><span>The query ran successfully. Try changing the WHERE condition.</span></div> : result ? <div className="sql-empty"><b>Change saved locally</b><span>Run a SELECT to inspect the updated practice data.</span></div> : <div className="sql-empty"><Database size={26} /><b>Your results appear here</b><span>Run the starter query or choose an example to explore the data.</span><button onClick={run}>Run starter query</button></div>}
          </>}
        </section>
      </div>
      {mode === 'challenges' && <aside className="sql-challenges"><div className="sql-panel-head"><h2>Challenges</h2><span>{completed.length}/{challenges.length} done</span></div><div className="sql-challenge-list">{challenges.map((item, index) => <button key={item.id} className={challengeId === item.id ? 'active' : ''} onClick={() => chooseChallenge(item.id)}><span>{completed.includes(item.id) ? '✓' : index + 1}</span>{item.title}</button>)}</div><div className="sql-task"><span className="sql-kicker"><Sparkles size={14} /> Your goal</span><h3>{challenge.title}</h3><p>{challenge.goal}</p><button onClick={() => replaceSql(challenge.starter)}>Use starting query</button><div className="sql-hints">{challenge.hints.slice(0, hint).map((text, index) => <p key={index}>Hint {index + 1}: {text}</p>)}{hint < challenge.hints.length && <button onClick={() => setHint(value => value + 1)}>Show {hint ? 'next hint' : 'a hint'}</button>}{hint >= challenge.hints.length && !answer && <button onClick={() => setAnswer(true)}>Reveal a solution</button>}{answer && <div><code>{challenge.solution}</code><p>{challenge.why}</p><button onClick={() => replaceSql(challenge.solution)}>Try this query</button></div>}</div></div></aside>}
    </main>
    <footer className="sql-footer"><span>{saveError ? 'Browser storage is unavailable; copy your SQL before leaving.' : 'SQL and sample data save in this browser.'}</span><span>SELECT · WHERE · ORDER BY · JOIN · GROUP BY · INSERT · UPDATE · DELETE</span></footer>
  </div>;
}
function DataTable({ result, highlight = false }: { result: QueryResult | null; highlight?: boolean }) {
  if (!result) return <p>Loading sample rows…</p>;
  return <table><thead><tr>{result.columns.map((column, index) => <th className={highlight ? 'sql-selected-column' : ''} key={`${column}-${index}`} scope="col">{column}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{value === null ? <i>NULL</i> : String(value)}</td>)}</tr>)}</tbody></table>;
}
