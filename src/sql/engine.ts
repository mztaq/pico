import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export type Cell = string | number | null;
export interface QueryResult { columns: string[]; rows: Cell[][]; changes: number; kind: 'select' | 'write'; explanation: string; cues: string[] }
export interface Column { name: string; type: string; primary?: boolean; foreign?: string }
export interface Table { name: string; description: string; columns: Column[] }
export const tables: Table[] = [
  { name: 'Students', description: 'People in the school', columns: [
    { name: 'StudentID', type: 'INTEGER', primary: true }, { name: 'Name', type: 'TEXT' }, { name: 'YearGroup', type: 'INTEGER' }, { name: 'ClubID', type: 'INTEGER', foreign: 'Clubs.ClubID' },
  ] },
  { name: 'Clubs', description: 'After-school activities', columns: [
    { name: 'ClubID', type: 'INTEGER', primary: true }, { name: 'ClubName', type: 'TEXT' }, { name: 'Room', type: 'TEXT' },
  ] },
  { name: 'Results', description: 'Quiz scores', columns: [
    { name: 'ResultID', type: 'INTEGER', primary: true }, { name: 'StudentID', type: 'INTEGER', foreign: 'Students.StudentID' }, { name: 'Subject', type: 'TEXT' }, { name: 'Score', type: 'INTEGER' },
  ] },
];
const seed = `PRAGMA foreign_keys = ON;
CREATE TABLE Clubs (ClubID INTEGER PRIMARY KEY, ClubName TEXT NOT NULL, Room TEXT NOT NULL);
CREATE TABLE Students (StudentID INTEGER PRIMARY KEY, Name TEXT NOT NULL, YearGroup INTEGER NOT NULL, ClubID INTEGER REFERENCES Clubs(ClubID));
CREATE TABLE Results (ResultID INTEGER PRIMARY KEY, StudentID INTEGER NOT NULL REFERENCES Students(StudentID), Subject TEXT NOT NULL, Score INTEGER NOT NULL CHECK(Score BETWEEN 0 AND 100));
INSERT INTO Clubs VALUES (1,'Robotics','Lab 2'),(2,'Chess','Library'),(3,'Art','Studio');
INSERT INTO Students VALUES (1,'Amina',10,1),(2,'Bilal',9,2),(3,'Chloe',10,1),(4,'Dev',11,3),(5,'Eman',10,2),(6,'Farah',9,1);
INSERT INTO Results VALUES (1,1,'Computing',92),(2,2,'Computing',76),(3,3,'Computing',84),(4,4,'Computing',71),(5,5,'Computing',89),(6,6,'Computing',78);`;

let sqlitePromise: Promise<SqlJsStatic> | undefined;
export async function createDatabase(saved?: Uint8Array, wasmBinary?: ArrayBuffer): Promise<Database> {
  sqlitePromise ??= initSqlJs({ locateFile: () => wasmUrl, wasmBinary });
  const SQLite = await sqlitePromise;
  let db: Database;
  try { db = saved ? new SQLite.Database(saved) : new SQLite.Database(); db.exec('PRAGMA foreign_keys = ON'); db.exec('SELECT * FROM Students LIMIT 1'); }
  catch { db = new SQLite.Database(); db.exec(seed); }
  return db;
}

// The editor accepts one practice statement. A lexical scan catches extra statements without
// treating semicolons in quoted text or comments as separators.
export function singleStatement(source: string): string {
  let quote = ''; let ended = false; let content = '';
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quote) { content += char; if (char === quote) { if (source[i + 1] === quote) content += source[++i]; else quote = ''; } continue; }
    if (char === '-' && source[i + 1] === '-') { while (i < source.length && source[i] !== '\n') i++; content += ' '; continue; }
    if (char === '/' && source[i + 1] === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++; i++; content += ' '; continue; }
    if (char === ';') { ended = true; continue; }
    if (ended && !/\s/.test(char)) throw Error('Run one SQL statement at a time. Select a statement and run it separately.');
    if (char === "'" || char === '"' || char === '`') { quote = char; content += char; continue; }
    content += char;
  }
  const sql = content.trim();
  if (!sql) throw Error('Write a query first, or choose a starting query from a challenge.');
  if (!/^(SELECT|INSERT|UPDATE|DELETE)\b/i.test(sql)) throw Error('This playground runs SELECT, INSERT, UPDATE and DELETE statements on the sample tables.');
  if (!/^SELECT\b/i.test(sql)) {
    const writeTable = /^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][\w]*)\b/i.exec(sql)?.[1];
    if (!writeTable || !tables.some(table => table.name.toLowerCase() === writeTable.toLowerCase())) throw Error('Changes are limited to Students, Clubs and Results.');
  }
  return sql;
}

export function explain(sql: string, result: Pick<QueryResult, 'kind' | 'rows' | 'changes'>): { explanation: string; cues: string[] } {
  if (result.kind === 'write') {
    const action = /^\s*(INSERT|UPDATE|DELETE)/i.exec(sql)?.[1]?.toLowerCase() ?? 'changed';
    return { explanation: `${action === 'insert' ? 'Added' : action === 'update' ? 'Updated' : 'Deleted'} ${result.changes} ${result.changes === 1 ? 'row' : 'rows'} in your practice database.`, cues: [] };
  }
  const from = /\bFROM\s+([A-Za-z_][\w]*)/i.exec(sql)?.[1] ?? 'the table';
  const cues = [ /\bWHERE\b/i.test(sql) ? 'Filtered rows with WHERE' : '', /\bORDER\s+BY\b/i.test(sql) ? 'Sorted with ORDER BY' : '', /\bJOIN\b/i.test(sql) ? 'Combined matching rows with JOIN' : '', /\bGROUP\s+BY\b/i.test(sql) ? 'Grouped rows' : '' ].filter(Boolean);
  const count = result.rows.length;
  return { explanation: count ? `Found ${count} ${count === 1 ? 'row' : 'rows'} from ${from}. ${cues.length ? cues.join('; ') + '.' : 'The highlighted columns are the ones your query asked for.'}` : `Your query ran successfully, but no rows matched in ${from}. Try changing the WHERE condition or inspect the sample data.`, cues };
}

export function runQuery(db: Database, source: string): QueryResult {
  const sql = singleStatement(source);
  const kind = /^SELECT\b/i.test(sql) ? 'select' : 'write';
  // A separate read-only SQLite connection protects schema and sample data from hidden writes
  // inside SELECT expressions. SQLite's browser build has no host file access.
  let statement;
  try {
    statement = db.prepare(sql);
    if (kind === 'write') db.exec('SAVEPOINT pico_query');
    const columns = statement.getColumnNames();
    const rows: Cell[][] = [];
    while (statement.step()) {
      if (rows.length >= 1000) throw Error('This query returned over 1,000 rows. Add a WHERE condition to narrow it down.');
      rows.push(statement.get().map(value => value instanceof Uint8Array ? '[binary data]' : value) as Cell[]);
    }
    statement.free(); statement = undefined;
    if (kind === 'write') db.exec('RELEASE pico_query');
    const changes = kind === 'write' ? db.getRowsModified() : 0;
    return { columns, rows, changes, kind, ...explain(sql, { kind, rows, changes }) };
  } catch (error) {
    statement?.free();
    if (kind === 'write') { try { db.exec('ROLLBACK TO pico_query; RELEASE pico_query'); } catch { /* The statement did not start a savepoint. */ } }
    throw error;
  }
}

export function sampleRows(db: Database, table: string): QueryResult {
  if (!tables.some(item => item.name === table)) throw Error('Unknown sample table.');
  return runQuery(db, `SELECT * FROM ${table}`);
}
