import type { Database, SqlModule, SqlValue } from 'sql.js';
import { csvTable, quoteIdentifier, tableName, type Cell } from './csv';

import { validateManualTable, type ManualTable } from './manual-table';
import { normalizeSortDirections } from './worksheet-sql';

export const MAX_RESULT_ROWS = 500;
const MAX_DATABASE_BYTES = 32 * 1024 * 1024;
export interface TableInfo { name: string; columns: { name: string; type: string }[]; }
export interface QueryResult { columns: string[]; rows: Cell[][]; truncated: boolean; }
export interface SqlRequest { database?: Uint8Array; action: 'init' | 'reset' | 'import' | 'create' | 'query'; table?: ManualTable; files?: { name: string; text: string }[]; sql?: string; }
export interface SqlResponse { database: Uint8Array; tables: TableInfo[]; result: QueryResult | null; message: string; suggestedQuery?: string; }
export type WorkerReply = { ok: true; value: SqlResponse } | { ok: false; error: string } | { ready: true };

function displayCell(value: SqlValue): Cell {
  if (value instanceof Uint8Array) return '[BLOB: ' + value.length + ' bytes]';
  if (typeof value === 'string' && value.length > 4096) return value.slice(0, 4096) + '…';
  return value;
}
function tables(db: Database): TableInfo[] {
  const names = db.exec("SELECT name FROM sqlite_master WHERE type IN ('table','view') AND substr(name,1,7) <> 'sqlite_' ORDER BY name LIMIT 100")[0]?.values ?? [];
  return names.map(([name]) => ({
    name: String(name),
    columns: (db.exec('PRAGMA table_info(' + quoteIdentifier(String(name)) + ')')[0]?.values ?? []).map(row => ({ name: String(row[1]), type: String(row[2] || 'ANY') })),
  }));
}
function query(db: Database, sql: string): QueryResult | null {
  let result: QueryResult | null = null;
  for (const statement of db.iterateStatements(sql)) {
    const columns = statement.getColumnNames();
    let budget = 1_000_000;
    const rows: Cell[][] = [];
    let truncated = false;
    while (statement.step()) {
      if (rows.length >= MAX_RESULT_ROWS || budget <= 0) { truncated = true; continue; }
      const row = statement.get().map(displayCell);
      const size = row.reduce<number>((sum, value) => sum + String(value ?? '').length, 0);
      if (size > budget) { truncated = true; budget = 0; continue; }
      budget -= size;
      rows.push(row);
    }
    result = columns.length ? { columns, rows, truncated } : null;
  }
  return result;
}
export function executeSql(SQL: SqlModule, request: SqlRequest): SqlResponse {
  // Each operation works on a copy. Errors and cancellation preserve the last successful database.
  const db = new SQL.Database(request.action === 'reset' ? undefined : request.database);
  try {
    let result: QueryResult | null = null, message = 'SQLite ready', suggestedQuery: string | undefined;
    if (request.action === 'import') {
      const taken = new Set(tables(db).map(table => table.name.toLowerCase()));
      const imported: string[] = [];
      for (const file of request.files ?? []) {
        const name = tableName(file.name, taken);
        const data = csvTable(file.text);
        db.run('CREATE TABLE ' + quoteIdentifier(name) + ' (' + data.names.map((column, i) => quoteIdentifier(column) + ' ' + data.types[i]).join(', ') + ')');
        const insert = db.prepare('INSERT INTO ' + quoteIdentifier(name) + ' VALUES (' + data.names.map(() => '?').join(', ') + ')');
        try {
          db.run('BEGIN');
          for (const row of data.values) insert.run(row);
          db.run('COMMIT');
        } finally { insert.free(); }
        imported.push(name);
      }
      if (imported.length) {
        suggestedQuery = 'SELECT * FROM ' + quoteIdentifier(imported[0]) + ';';
        result = query(db, suggestedQuery);
      }
      message = 'Imported ' + imported.length + (imported.length === 1 ? ' table' : ' tables');
    } else if (request.action === 'create') {
      if (!request.table) throw new Error('Enter table details.');
      const { name, columns, values } = validateManualTable(request.table);
      const keys = columns.filter(column => column.primaryKey);
      const definitions = columns.map(column => quoteIdentifier(column.name) + ' ' + column.type + (column.primaryKey ? ' NOT NULL' : ''));
      if (keys.length) definitions.push('PRIMARY KEY (' + keys.map(column => quoteIdentifier(column.name)).join(', ') + ')');
      db.run('CREATE TABLE ' + quoteIdentifier(name) + ' (' + definitions.join(', ') + ')');
      if (values.length) {
        const insert = db.prepare('INSERT INTO ' + quoteIdentifier(name) + ' VALUES (' + columns.map(() => '?').join(', ') + ')');
        try {
          db.run('BEGIN');
          for (const row of values) insert.run(row);
          db.run('COMMIT');
        } finally { insert.free(); }
      }
      suggestedQuery = 'SELECT * FROM ' + quoteIdentifier(name) + ';';
      result = query(db, suggestedQuery);
      message = 'Created ' + name;
    } else if (request.action === 'query') {
      if (!request.sql?.trim()) throw new Error('Enter a SQL statement.');
      if (request.sql.length > 100_000) throw new Error('Query exceeds 100,000 characters.');
      result = query(db, normalizeSortDirections(request.sql));
      message = result ? result.rows.length + (result.truncated ? '+ rows returned (preview limited)' : ' rows returned') : 'Query completed';
    } else if (request.action === 'reset') message = 'Database cleared';
    const schema = tables(db);
    const database = db.export();
    if (database.byteLength > MAX_DATABASE_BYTES) throw new Error('Database exceeds the 32 MB session limit.');
    return { database, tables: schema, result, message, suggestedQuery };
  } finally { db.close(); }
}
