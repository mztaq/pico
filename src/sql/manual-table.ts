import type { Cell } from './csv';

export const columnTypes = ['TEXT', 'CHARACTER', 'BOOLEAN', 'INTEGER', 'REAL', 'DATE', 'TIME', 'DATETIME'] as const;
export type ColumnType = typeof columnTypes[number];
export const columnTypeLabels: Record<ColumnType, string> = { TEXT:'Text / alphanumeric', CHARACTER:'Character', BOOLEAN:'Boolean', INTEGER:'Integer', REAL:'Real', DATE:'Date', TIME:'Time', DATETIME:'Date/time' };
export interface ManualColumn { name: string; type: ColumnType; primaryKey: boolean; }
export interface ManualTable { name: string; columns: ManualColumn[]; rows: string[][]; }

/** Resize a draft without changing the retained field definitions or records. */
export function resizeManualGrid(columns: ManualColumn[], rows: string[][], fields: number, records: number) {
  if (!Number.isInteger(fields) || fields < 1 || fields > 100 || !Number.isInteger(records) || records < 0 || records > 1000) throw new Error('Invalid table size.');
  const nextColumns = Array.from({ length: fields }, (_,i): ManualColumn => columns[i] ?? { name:'', type:'TEXT', primaryKey:false });
  const nextRows = Array.from({ length: records }, (_,i) => Array.from({ length: fields }, (_,j) => rows[i]?.[j] ?? ''));
  return { columns: nextColumns, rows: nextRows };
}

function validDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
function validTime(value: string) { return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value); }
function validDateTime(value: string) {
  const parts = value.split(/[T ]/);
  return parts.length === 1 ? validDate(value) || validTime(value) : parts.length === 2 && validDate(parts[0]) && validTime(parts[1]);
}

export function validateManualTable(table: ManualTable) {
  const name = table.name.trim();
  if (!name || name.length > 100 || /^sqlite_/i.test(name) || name.includes('\0')) throw new Error('Enter a valid table name.');
  if (!table.columns.length || table.columns.length > 100) throw new Error('Use between 1 and 100 columns.');
  if (table.rows.length > 1000) throw new Error('Manual entry supports up to 1,000 rows. Import CSV for larger tables.');
  const columns = table.columns.map(column => ({ ...column, name: column.name.trim() }));
  const names = new Set<string>();
  for (const column of columns) {
    if (!column.name || column.name.length > 100 || column.name.includes('\0')) throw new Error('Enter a name for every column.');
    if (names.has(column.name.toLowerCase())) throw new Error('Column names must be unique.');
    names.add(column.name.toLowerCase());
    if (!columnTypes.includes(column.type)) throw new Error('Choose a valid column type.');
  }
  const values: Cell[][] = table.rows.map((row, rowIndex) => {
    if (row.length !== columns.length) throw new Error('Row ' + (rowIndex + 1) + ' has the wrong number of values.');
    return row.map((raw, index) => {
      const column = columns[index];
      const value = raw.trim();
      const fail = () => new Error('Row ' + (rowIndex + 1) + ', ' + column.name + ': enter a valid ' + column.type.toLowerCase() + ' value.');
      if (raw.length > 4096) throw new Error('Manual cells must contain at most 4,096 characters.');
      if (raw === '') {
        if (column.primaryKey) throw new Error('Row ' + (rowIndex + 1) + ': primary key values are required.');
        return null;
      }
      if (column.type === 'TEXT') return raw;
      if (column.type === 'CHARACTER') {
        if (Array.from(raw).length !== 1) throw fail();
        return raw;
      }
      if (column.type === 'DATE' || column.type === 'TIME' || column.type === 'DATETIME') {
        const valid = column.type === 'DATE' ? validDate(value) : column.type === 'TIME' ? validTime(value) : validDateTime(value);
        if (!valid) throw fail();
        return value.replace('T', ' ');
      }
      if (column.type === 'BOOLEAN') {
        if (/^(true|yes|1)$/i.test(value)) return 1;
        if (/^(false|no|0)$/i.test(value)) return 0;
        throw fail();
      }
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw fail();
      const number = Number(value);
      if (!Number.isFinite(number) || (column.type === 'INTEGER' && !Number.isSafeInteger(number))) throw fail();
      return number;
    });
  });
  return { name, columns, values };
}
