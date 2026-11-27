export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 50_000;
export const MAX_CSV_COLUMNS = 100;
export type Cell = string | number | null;

export function quoteIdentifier(name: string) { return '"' + name.replaceAll('"', '""') + '"'; }

export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('CSV is empty.');
  if (text.includes('\0')) throw new Error('CSV contains unsupported null characters.');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  const pushField = () => {
    row.push(field); field = ''; closed = false;
    if (row.length > MAX_CSV_COLUMNS) throw new Error('CSV exceeds 100 columns.');
  };
  const pushRow = () => {
    pushField(); rows.push(row); row = [];
    if (rows.length > MAX_CSV_ROWS + 1) throw new Error('CSV exceeds 50,000 data rows.');
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
      continue;
    }
    if (ch === ',') pushField();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else if (ch === '"' && !field && !closed) quoted = true;
    else {
      if (closed || ch === '"') throw new Error('Invalid CSV quoting.');
      field += ch;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (field || row.length || closed) pushRow();
  const width = rows[0]?.length ?? 0;
  if (!width || !rows[0].some(value => value.trim())) throw new Error('CSV needs a header row.');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length !== width) throw new Error('CSV row ' + (i + 1) + ' has the wrong number of columns.');
  }
  return rows;
}
export function uniqueName(name: string, taken: Set<string>) {
  const base = name || 'data';
  let value = base, suffix = 2;
  while (taken.has(value.toLowerCase())) value = base + '_' + suffix++;
  taken.add(value.toLowerCase());
  return value;
}
export function tableName(filename: string, taken: Set<string>) {
  let base = filename.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'data';
  if (/^\d|^sqlite_/i.test(base)) base = 'data_' + base;
  return uniqueName(base, taken);
}
export function inspectCsv(text: string) {
  const [header, ...rows] = parseCsv(text);
  const taken = new Set<string>();
  const names = header.map((name, index) => uniqueName(name.trim() || 'column_' + (index + 1), taken));
  const numeric = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
  const types = names.map((_, index) => {
    const populated = rows.map(row => row[index]).filter(value => value !== '');
    if (!populated.length || !populated.every(value => numeric.test(value) && Number.isFinite(Number(value)) && (!Number.isInteger(Number(value)) || Number.isSafeInteger(Number(value))))) return 'TEXT';
    return populated.every(value => Number.isSafeInteger(Number(value))) ? 'INTEGER' : 'REAL';
  });
  return { names, types, rows };
}
export function csvTable(text: string) {
  const { names, types, rows } = inspectCsv(text);
  const values: Cell[][] = rows.map(row => row.map((value, i) => value === '' ? null : types[i] === 'TEXT' ? value : Number(value)));
  return { names, types, values };
}
export function toCsv(columns: string[], rows: Cell[][]) {
  const escape = (value: Cell) => {
    let text = value === null ? '' : String(value);
    if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [columns, ...rows].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
}
