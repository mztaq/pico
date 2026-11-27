import type { Database, SqlModule, SqlValue } from 'sql.js';
import { inspectCsv, quoteIdentifier, tableName, type Cell } from './csv';

import { validateManualTable, validateTableSchema, convertFieldValue, columnTypes, type ManualColumn, type ColumnType, type ManualTable } from './manual-table';
import { normalizeSortDirections } from './worksheet-sql';
import { formatIdentifier } from './identifiers';

export const MAX_RESULT_ROWS = 500;
const MAX_DATABASE_BYTES = 32 * 1024 * 1024;
export interface TableInfo { name: string; kind?: 'table' | 'view'; columns: { name: string; type: string; primaryKey?: boolean }[]; }
export interface CsvImportFile { name: string; text: string; tableName?: string; columns?: ManualColumn[]; }
export interface TableDesign { name: string; columns: ManualColumn[]; }
export interface QueryResult { columns: string[]; rows: Cell[][]; truncated: boolean; }
export interface SqlRequest { database?: Uint8Array; action: 'init' | 'reset' | 'import' | 'create' | 'design' | 'query'; table?: ManualTable; design?: TableDesign; files?: CsvImportFile[]; sql?: string; }
export interface SqlResponse { database: Uint8Array; tables: TableInfo[]; result: QueryResult | null; message: string; }
export type WorkerReply = { ok: true; value: SqlResponse } | { ok: false; error: string } | { ready: true };

function displayCell(value: SqlValue): Cell {
  if (value instanceof Uint8Array) return '[BLOB: ' + value.length + ' bytes]';
  if (typeof value === 'string' && value.length > 4096) return value.slice(0, 4096) + '…';
  return value;
}
function tables(db: Database): TableInfo[] {
  const names = db.exec("SELECT name,type FROM sqlite_master WHERE type IN ('table','view') AND substr(name,1,7) <> 'sqlite_' ORDER BY name LIMIT 100")[0]?.values ?? [];
  return names.map(([name,kind]) => ({
    name: String(name), kind: kind === 'view' ? 'view' as const : 'table' as const,
    columns: (db.exec('PRAGMA table_info(' + quoteIdentifier(String(name)) + ')')[0]?.values ?? []).map(row => ({ name: String(row[1]), type: String(row[2] || 'ANY'), primaryKey: Number(row[5]) > 0 })),
  }));
}
function definitions(columns: ManualColumn[]) {
  const keys = columns.filter(column => column.primaryKey);
  const fields = columns.map(column => quoteIdentifier(column.name) + ' ' + column.type + (column.primaryKey ? ' NOT NULL' : ''));
  if (keys.length) fields.push('PRIMARY KEY (' + keys.map(column => quoteIdentifier(column.name)).join(', ') + ')');
  return fields.join(', ');
}
function createTableSql(name: string, columns: ManualColumn[]) {
  return 'CREATE TABLE ' + quoteIdentifier(name) + ' (' + definitions(columns) + ')';
}
function insertRows(db: Database, name: string, columns: ManualColumn[], values: Iterable<SqlValue[]>) {
  const insert = db.prepare('INSERT INTO ' + quoteIdentifier(name) + ' VALUES (' + columns.map(() => '?').join(', ') + ')');
  try { for (const row of values) insert.run(row); } finally { insert.free(); }
}

/** A conservative rebuild: never discard SQL-defined constraints, indexes, triggers or relationships. */
function changeDesign(db: Database, design: TableDesign) {
  const schema = db.exec('SELECT name,type,sql FROM sqlite_master WHERE name = ' + "'" + design.name.replaceAll("'", "''") + "' COLLATE NOCASE")[0]?.values[0];
  if (!schema || schema[1] !== 'table') throw new Error('Design View requires an existing table.');
  const name = String(schema[0]);
  const current = tables(db).find(table => table.name === name);
  if (!current || current.columns.length !== design.columns.length) throw new Error('The table structure changed. Reopen Design View.');
  const columns = current.columns.map(column => ({ name: column.name, type: column.type as ColumnType, primaryKey: Boolean(column.primaryKey) }));
  if (columns.some(column => !columnTypes.includes(column.type)) || schema[2] !== createTableSql(name, columns)) {
    throw new Error('This table has a custom SQL structure. Use SQL to edit it so its constraints are preserved.');
  }
  const dependencies = db.exec("SELECT name FROM sqlite_master WHERE type IN ('view','trigger') OR (type='index' AND tbl_name=" + "'" + name.replaceAll("'", "''") + "' AND sql IS NOT NULL)")[0]?.values ?? [];
  if (dependencies.length) throw new Error('This database contains views, triggers or indexes that may depend on the table. Use SQL to change its design.');
  const allTables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND substr(name,1,7) <> 'sqlite_'")[0]?.values ?? [];
  for (const [other] of allTables) {
    const refs = db.exec('PRAGMA foreign_key_list(' + quoteIdentifier(String(other)) + ')')[0]?.values ?? [];
    if (refs.some(row => String(other) === name || String(row[2]).toLowerCase() === name.toLowerCase())) throw new Error('This table has foreign key relationships. Use SQL to change its design.');
  }
  const next = validateTableSchema({ name, columns: design.columns }).columns;
  if (next.every((column,i) => column.name === columns[i].name && column.type === columns[i].type && column.primaryKey === columns[i].primaryKey)) return name;
  const taken = new Set(allTables.map(row=>String(row[0]).toLowerCase()));
  const temporary = tableName('pico_design_temp.csv',taken);
  db.run('BEGIN');
  db.run(createTableSql(temporary,next));
  const select = db.prepare('SELECT * FROM ' + quoteIdentifier(name));
  try {
    function* converted() {
      let row = 0;
      while (select.step()) {
        const values = select.get();
        yield values.map((value,i) => {
          if (value instanceof Uint8Array) throw new Error('Binary fields must be edited using SQL.');
          if (next[i].type === columns[i].type && !(next[i].primaryKey && value === null)) return value;
          return convertFieldValue(value === null ? null : String(value), next[i], row);
        });
        row++;
      }
    }
    insertRows(db,temporary,next,converted());
  } finally { select.free(); }
  db.run('DROP TABLE ' + quoteIdentifier(name));
  db.run('ALTER TABLE ' + quoteIdentifier(temporary) + ' RENAME TO ' + quoteIdentifier(name));
  db.run('COMMIT');
  return name;
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
    let result: QueryResult | null = null, message = 'SQLite ready';
    if (request.action === 'import') {
      const taken = new Set(tables(db).map(table => table.name.toLowerCase()));
      const imported: string[] = [];
      for (const file of request.files ?? []) {
        const data = inspectCsv(file.text);
        const name = file.tableName === undefined ? tableName(file.name, taken) : file.tableName.trim();
        if (file.tableName !== undefined) {
          if (taken.has(name.toLowerCase())) throw new Error('Table "' + name + '" already exists.');
          taken.add(name.toLowerCase());
        }
        const columns = validateTableSchema({ name, columns: file.columns ?? data.names.map((name,i)=>({ name, type: data.types[i] as ColumnType, primaryKey:false })) }).columns;
        if (columns.length !== data.names.length) throw new Error('CSV field count does not match its design.');
        db.run(createTableSql(name,columns));
        db.run('BEGIN');
        insertRows(db,name,columns,data.rows.map((row,i)=>row.map((cell,j)=>convertFieldValue(cell === '' ? null : cell,columns[j],i))));
        db.run('COMMIT');
        imported.push(name);
      }
      if (imported.length) {
        result = query(db, 'SELECT * FROM ' + formatIdentifier(imported[0]) + ';');
      }
      message = 'Imported ' + imported.length + (imported.length === 1 ? ' table' : ' tables');
    } else if (request.action === 'create') {
      if (!request.table) throw new Error('Enter table details.');
      const { name, columns, values } = validateManualTable(request.table);
      db.run(createTableSql(name,columns));
      if (values.length) {
        db.run('BEGIN'); insertRows(db,name,columns,values); db.run('COMMIT');
      }
      result = query(db, 'SELECT * FROM ' + formatIdentifier(name) + ';');
      message = 'Created ' + name;
    } else if (request.action === 'design') {
      if (!request.design) throw new Error('Choose a table design.');
      const name = changeDesign(db,request.design);
      result = query(db,'SELECT * FROM ' + quoteIdentifier(name) + ';');
      message = 'Saved design for ' + name;
    } else if (request.action === 'query') {
      if (!request.sql?.trim()) throw new Error('Enter a SQL statement.');
      if (request.sql.length > 100_000) throw new Error('Query exceeds 100,000 characters.');
      result = query(db, normalizeSortDirections(request.sql));
      message = result ? result.rows.length + (result.truncated ? '+ rows returned (preview limited)' : ' rows returned') : 'Query completed';
    } else if (request.action === 'reset') message = 'Database cleared';
    const schema = tables(db);
    const database = db.export();
    if (database.byteLength > MAX_DATABASE_BYTES) throw new Error('Database exceeds the 32 MB session limit.');
    return { database, tables: schema, result, message };
  } finally { db.close(); }
}
