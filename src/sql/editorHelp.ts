import { tables } from './engine';

export interface SqlHelp { title: string; description: string; example?: string }
export interface Correction { from: number; to: number; original: string; replacement: string; reason: string }

const keywords: Record<string, SqlHelp> = {
  SELECT: { title: 'SELECT', description: 'Choose the columns to show in the result.', example: 'SELECT Name, YearGroup' },
  FROM: { title: 'FROM', description: 'Name the table that supplies the rows.', example: 'FROM Students' },
  WHERE: { title: 'WHERE', description: 'Keep only rows that meet a condition.', example: 'WHERE YearGroup = 10' },
  AND: { title: 'AND', description: 'Both conditions must be true.', example: 'WHERE Score > 80 AND Subject = \'Computing\'' },
  OR: { title: 'OR', description: 'At least one condition must be true.', example: 'WHERE YearGroup = 9 OR YearGroup = 10' },
  ORDER: { title: 'ORDER BY', description: 'Sort the result. Add DESC for highest first.', example: 'ORDER BY Score DESC' },
  GROUP: { title: 'GROUP BY', description: 'Collect rows with the same value before using an aggregate.', example: 'GROUP BY ClubID' },
  JOIN: { title: 'JOIN', description: 'Combine rows from two tables using matching key values.', example: 'JOIN Clubs ON Students.ClubID = Clubs.ClubID' },
  ON: { title: 'ON', description: 'State which columns must match in a JOIN.' },
  INSERT: { title: 'INSERT INTO', description: 'Add a new row to a table.', example: 'INSERT INTO Clubs VALUES (4, \'Drama\', \'Hall\')' },
  VALUES: { title: 'VALUES', description: 'Supply the values for a new row in column order.' },
  UPDATE: { title: 'UPDATE', description: 'Change existing rows. Use WHERE to target the rows you mean.', example: 'UPDATE Results SET Score = 88 WHERE ResultID = 1' },
  SET: { title: 'SET', description: 'Assign a new value to a column in an UPDATE.' },
  DELETE: { title: 'DELETE FROM', description: 'Remove rows. Use WHERE to avoid removing every row.' },
  COUNT: { title: 'COUNT()', description: 'Count rows or non-NULL values.', example: 'SELECT COUNT(*) FROM Students' },
  SUM: { title: 'SUM()', description: 'Add numeric values in a column.' },
  AVG: { title: 'AVG()', description: 'Find the average of numeric values.' },
  MIN: { title: 'MIN()', description: 'Find the smallest value.' },
  MAX: { title: 'MAX()', description: 'Find the largest value.' },
  ASC: { title: 'ASC', description: 'Sort from lowest to highest or A to Z. This is the default.' },
  DESC: { title: 'DESC', description: 'Sort from highest to lowest or Z to A.' },
  NULL: { title: 'NULL', description: 'A missing or unknown value. Use IS NULL to test for it.' },
};

export function helpForWord(word: string): SqlHelp | null {
  const upper = word.toUpperCase();
  if (keywords[upper]) return keywords[upper];
  const table = tables.find(item => item.name.toUpperCase() === upper);
  if (table) return { title: table.name, description: `${table.description}. Click the table in the browser to inspect its columns.` };
  const column = tables.flatMap(item => item.columns.map(field => ({ table: item.name, field }))).find(item => item.field.name.toUpperCase() === upper);
  if (!column) return null;
  return { title: `${column.table}.${column.field.name}`, description: `${column.field.type} column${column.field.primary ? '; primary key' : ''}${column.field.foreign ? `; foreign key to ${column.field.foreign}` : ''}.` };
}

export function completionItems() {
  const terms = Object.values(keywords).map(item => ({ label: item.title.replace('()', ''), type: item.title.includes('()') ? 'function' : 'keyword', detail: item.description }));
  const names = tables.flatMap(table => [
    { label: table.name, type: 'class', detail: table.description },
    ...table.columns.map(column => ({ label: column.name, type: 'property', detail: `${table.name} · ${column.type}${column.primary ? ' · PK' : ''}${column.foreign ? ' · FK' : ''}` })),
  ]);
  return [...terms, ...names];
}

function distance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const next = [i];
    for (let j = 1; j <= right.length; j++) next[j] = Math.min(next[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1));
    previous.splice(0, previous.length, ...next);
  }
  return previous[right.length]!;
}

export function correctionFor(source: string, error: string): Correction | null {
  const missing = /no such (table|column):\s*([\w.]+)/i.exec(error);
  const near = /near ["']([^"']+)["']:\s*syntax error/i.exec(error);
  const first = /^\s*([A-Za-z_]+)/.exec(source);
  const token = missing?.[2]?.split('.').at(-1) ?? near?.[1] ?? (first && !/^(SELECT|INSERT|UPDATE|DELETE)$/i.test(first[1]!) ? first[1] : null);
  if (!token || !/^[A-Za-z_]+$/.test(token)) return null;
  const candidates = missing?.[1]?.toLowerCase() === 'table'
    ? tables.map(table => table.name)
    : missing?.[1]?.toLowerCase() === 'column'
      ? [...new Set(tables.flatMap(table => table.columns.map(column => column.name)))]
      : Object.keys(keywords);
  const best = candidates.map(candidate => ({ candidate, score: distance(token.toLowerCase(), candidate.toLowerCase()) })).sort((a, b) => a.score - b.score)[0];
  if (!best || best.score === 0 || best.score > (token.length >= 5 ? 2 : 1)) return null;
  const expression = new RegExp(`\\b${token}\\b`, 'i');
  const match = expression.exec(source);
  if (!match) return null;
  return { from: match.index, to: match.index + match[0].length, original: match[0], replacement: best.candidate, reason: `Did you mean ${best.candidate}?` };
}
