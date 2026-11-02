import { useEffect, useRef, useState } from 'react';
import { autocompletion, completeFromList } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql as sqlLanguage } from '@codemirror/lang-sql';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view';
import { ArrowLeft, Database, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { Database as SqlDatabase } from 'sql.js';
import { cssVariables, getTheme } from '../app/themes';
import { loadSettings } from '../storage/settings';
import { challenges } from './challenges';
import { createDatabase, runQuery, sampleRows, tables, type QueryResult } from './engine';
import './sql.css';

const KEY = 'pico.sql.v1';
const DEFAULT_SQL = 'SELECT Name, YearGroup\nFROM Students\nWHERE YearGroup = 10\nORDER BY Name;';
type Mode = 'explore' | 'challenges';
interface Saved { sql: string; mode: Mode; challenge: string; completed: string[]; database?: string }
function load(): Saved {
  try { const value = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>; return { sql: typeof value.sql === 'string' ? value.sql : DEFAULT_SQL, mode: value.mode === 'challenges' ? 'challenges' : 'explore', challenge: challenges.some(item => item.id === value.challenge) ? value.challenge! : challenges[0]!.id, completed: Array.isArray(value.completed) ? value.completed.filter((id): id is string => typeof id === 'string') : [], database: typeof value.database === 'string' ? value.database : undefined }; }
  catch { return { sql: DEFAULT_SQL, mode: 'explore', challenge: challenges[0]!.id, completed: [] }; }
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
  const theme = getTheme(loadSettings().theme);
  const editorHost = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const sqlRef = useRef(sql); sqlRef.current = sql;
  const dbRef = useRef<SqlDatabase | null>(null); dbRef.current = db;
  const runRef = useRef<() => void>(() => {});
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
    const timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify({ sql, mode, challenge: challengeId, completed, database: db ? encode(db.export()) : undefined } satisfies Saved)); db?.exec('PRAGMA foreign_keys = ON'); setSaveError(false); } catch { setSaveError(true); } }, 350);
    return () => clearTimeout(timer);
  }, [sql, mode, challengeId, completed, db, result]);
  useEffect(() => {
    if (!editorHost.current) return;
    const completions = completeFromList([...tables.flatMap(table => [table.name, ...table.columns.map(column => column.name)]), 'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'JOIN', 'ON'].map(label => ({ label, type: /^[A-Z ]+$/.test(label) ? 'keyword' : 'variable' })));
    const cm = new EditorView({ parent: editorHost.current, state: EditorState.create({ doc: sqlRef.current, extensions: [lineNumbers(), history(), sqlLanguage(), autocompletion({ override: [completions] }), placeholder('Write SQL here…'), EditorView.contentAttributes.of({ 'aria-label': 'SQL editor' }), keymap.of([{ key: 'Mod-Enter', run: () => { runRef.current(); return true; } }, ...defaultKeymap, ...historyKeymap]), EditorView.lineWrapping, EditorView.theme({ '&': { height: '100%', backgroundColor: 'var(--bg)', color: 'var(--text)' }, '.cm-scroller': { fontFamily: 'var(--font-code)', fontSize: '14px', lineHeight: '1.65', overflow: 'auto' }, '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--muted)', borderColor: 'var(--border)' }, '.cm-content': { caretColor: 'var(--accent)', padding: '12px' }, '.cm-activeLine': { backgroundColor: 'var(--accent-soft)' }, '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-2px' } }, { dark: theme.appearance === 'dark' }), EditorView.updateListener.of(update => { if (update.docChanged) setSql(update.state.doc.toString()); })] }) });
    editor.current = cm;
    return () => { cm.destroy(); editor.current = null; };
  }, [theme.id]);
  function replaceSql(text: string) { const cm = editor.current; if (cm) { cm.dispatch({ changes: { from: 0, to: cm.state.doc.length, insert: text } }); cm.focus(); } else setSql(text); }
  function insertName(name: string) { const cm = editor.current; if (!cm) return; const { from, to } = cm.state.selection.main; cm.dispatch({ changes: { from, to, insert: name }, selection: { anchor: from + name.length } }); cm.focus(); }
  function run() {
    const database = dbRef.current; if (!database) { setNotice('The practice database is loading.'); return; }
    setError('');
    try {
      const output = runQuery(database, sqlRef.current);
      setResult(output); setNotice(output.explanation);
      if (mode === 'challenges') {
        const task = challenges.find(item => item.id === challengeId)!;
        if (task.check(database, output)) { setCompleted(items => items.includes(task.id) ? items : [...items, task.id]); setNotice(`Nice work! ${task.why}`); }
        else setNotice(`${output.explanation} Keep trying: ${task.goal}`);
      }
    } catch (cause) { setResult(null); setError(friendlyError(cause)); setNotice('Your database is ready for another try.'); }
  }
  runRef.current = run;
  async function reset() {
    if (!window.confirm('Restore the original sample rows? Your SQL and completed challenges stay saved. Any data edits will be lost.')) return;
    db?.close(); const fresh = await createDatabase(); setDb(fresh); setResult(null); setError(''); setNotice('Sample data restored. Ready for a fresh query!');
  }
  function chooseChallenge(id: string) { setChallengeId(id); setHint(0); setAnswer(false); const task = challenges.find(item => item.id === id)!; replaceSql(task.starter); setResult(null); setError(''); setNotice(task.goal); }
  const relation = selectedRelation === 'student-club' ? { from: 'Students.ClubID', to: 'Clubs.ClubID', example: 'Amina → Robotics (ClubID 1)' } : { from: 'Results.StudentID', to: 'Students.StudentID', example: 'Score 92 → Amina (StudentID 1)' };
  return <div className="sql-app" data-pico-theme={theme.id} style={cssVariables(theme) as React.CSSProperties}>
    <header className="sql-header"><button className="sql-back" onClick={onHome} aria-label="Back to home"><ArrowLeft size={18} /></button><img src="/pico-logo.svg" alt="" /><strong>Pico<span>.</span></strong><span className="sql-divider" /><h1>SQL Playground</h1><span className="sql-local">● Local practice database</span></header>
    <div className="sql-toolbar"><div className="sql-modes" role="group" aria-label="Activity mode"><button className={mode === 'explore' ? 'active' : ''} onClick={() => setMode('explore')}>Explore</button><button className={mode === 'challenges' ? 'active' : ''} onClick={() => setMode('challenges')}>Challenges <span>{completed.length}/{challenges.length}</span></button></div><div className="sql-actions"><button className="sql-reset" onClick={reset}><RotateCcw size={15} /> Reset data</button><button className="sql-run" onClick={run} disabled={!db}><Play size={15} fill="currentColor" /> Run <kbd>Ctrl ↵</kbd></button></div></div>
    <main className="sql-layout"><aside className="sql-browser"><div className="sql-tabs"><button className={view === 'tables' ? 'active' : ''} onClick={() => setView('tables')}>Tables</button><button className={view === 'schema' ? 'active' : ''} onClick={() => setView('schema')}>Relationships</button></div>{view === 'tables' ? <><p className="sql-browser-tip">Click a table or column to insert its name into the editor.</p>{tables.map(table => <section className="sql-table-card" key={table.name}><button className={selectedTable === table.name ? 'selected' : ''} onClick={() => { setSelectedTable(table.name); setSelectedColumn(null); insertName(table.name); }}><Database size={15} /> <b>{table.name}</b><small>{table.description}</small></button>{selectedTable === table.name && <><div className="sql-columns">{table.columns.map(column => <button key={column.name} className={selectedColumn === column.name ? 'selected' : ''} onClick={() => { setSelectedColumn(column.name); insertName(column.name); }}><span>{column.name}</span><small>{column.type}</small>{column.primary && <em>PK</em>}{column.foreign && <em title={`References ${column.foreign}`}>FK</em>}</button>)}</div><div className="sql-mini"><b>Sample rows</b><div className="sql-scroll"><DataTable result={sample} /></div></div>{selectedColumn && <p className="sql-column-note">{selectedColumn}: {table.columns.find(column => column.name === selectedColumn)?.foreign ? `foreign key linking to ${table.columns.find(column => column.name === selectedColumn)?.foreign}` : table.columns.find(column => column.name === selectedColumn)?.primary ? 'primary key; uniquely identifies each row' : 'a value stored in each row'}.</p>}</>}</section>)}</> : <div className="sql-schema"><p>Keys connect records across tables. Select a link to see an example.</p><div className="sql-schema-nodes"><div>Clubs <small>ClubID · PK</small></div><button className={selectedRelation === 'student-club' ? 'active' : ''} onClick={() => setSelectedRelation('student-club')}>← ClubID links students to clubs</button><div>Students <small>StudentID · PK<br />ClubID · FK</small></div><button className={selectedRelation === 'result-student' ? 'active' : ''} onClick={() => setSelectedRelation('result-student')}>↑ StudentID links results to students</button><div>Results <small>ResultID · PK<br />StudentID · FK</small></div></div>{selectedRelation && <p className="sql-relation-detail"><b>{relation.from} → {relation.to}</b><br />Matching records: {relation.example}</p>}</div>}</aside>
      <div className="sql-main"><section className="sql-editor-panel"><div className="sql-panel-head"><h2>Query editor</h2><span>SQL · Ctrl+Enter to run</span></div><div className="sql-editor" ref={editorHost} aria-label="SQL editor" /></section><section className="sql-results"><div className="sql-panel-head"><h2>Results</h2>{result && <span>{result.kind === 'select' ? `${result.rows.length} ${result.rows.length === 1 ? 'row' : 'rows'} · ${result.columns.length} columns` : `${result.changes} ${result.changes === 1 ? 'row' : 'rows'} changed`}</span>}</div>{error ? <div className="sql-message error" role="alert"><b>Let's fix that query</b><p>{error}</p></div> : result?.kind === 'select' ? result.rows.length ? <div className="sql-result-scroll"><DataTable result={result} highlight /></div> : <div className="sql-empty">The query worked, but found no rows. Try another condition.</div> : result ? <div className="sql-empty">Change saved in this practice database. Run a SELECT to inspect it.</div> : <div className="sql-empty">Your query results will appear here. Give it a try!</div>}<p className="sql-feedback" aria-live="polite">{notice}</p>{result?.cues.length ? <div className="sql-cues">{result.cues.map(cue => <span key={cue}>{cue}</span>)}</div> : null}</section></div>
      {mode === 'challenges' && <aside className="sql-challenges"><div className="sql-panel-head"><h2>Challenges</h2><span>{completed.length}/{challenges.length} done</span></div><div className="sql-challenge-list">{challenges.map((item, index) => <button key={item.id} className={challengeId === item.id ? 'active' : ''} onClick={() => chooseChallenge(item.id)}><span>{completed.includes(item.id) ? '✓' : index + 1}</span>{item.title}</button>)}</div><div className="sql-task"><span className="sql-kicker"><Sparkles size={14} /> Your goal</span><h3>{challenge.title}</h3><p>{challenge.goal}</p><button onClick={() => replaceSql(challenge.starter)}>Use starting query</button><div className="sql-hints">{challenge.hints.slice(0, hint).map((text, index) => <p key={index}>Hint {index + 1}: {text}</p>)}{hint < challenge.hints.length && <button onClick={() => setHint(value => value + 1)}>Show {hint ? 'next hint' : 'a hint'}</button>}{hint >= challenge.hints.length && !answer && <button onClick={() => setAnswer(true)}>Reveal a solution</button>}{answer && <div><code>{challenge.solution}</code><p>{challenge.why}</p><button onClick={() => replaceSql(challenge.solution)}>Try this query</button></div>}</div></div></aside>}
    </main><footer className="sql-footer"><span>{saveError ? 'Browser storage is unavailable; copy your SQL before leaving.' : 'SQL and sample data save in this browser.'}</span><span>SELECT · WHERE · ORDER BY · JOIN · GROUP BY · INSERT · UPDATE · DELETE</span></footer>
  </div>;
}
function DataTable({ result, highlight = false }: { result: QueryResult | null; highlight?: boolean }) {
  if (!result) return <p>Loading sample rows…</p>;
  return <table><thead><tr>{result.columns.map((column, index) => <th className={highlight ? 'sql-selected-column' : ''} key={`${column}-${index}`} scope="col">{column}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{value === null ? <i>NULL</i> : String(value)}</td>)}</tr>)}</tbody></table>;
}
