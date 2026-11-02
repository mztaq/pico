import type { Database } from 'sql.js';
import { singleStatement, tables, type QueryResult } from './engine';

export interface InspectionStep { label: string; detail: string }
export interface QueryInspection { steps: InspectionStep[]; plan: string[] }

/** A learning-oriented view of the clauses, followed by SQLite's actual query plan. */
export function inspectQuery(db: Database, source: string, result: QueryResult): QueryInspection {
  const sql = singleStatement(source);
  if (result.kind === 'write') {
    const target = /^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql)?.[1] ?? 'the table';
    return { steps: [
      { label: 'Target', detail: `SQLite opened ${target}.` },
      { label: 'Change', detail: `${result.changes} ${result.changes === 1 ? 'row was' : 'rows were'} changed. Run SELECT to check the new data.` },
    ], plan: [] };
  }
  const steps: InspectionStep[] = [];
  const from = /\bFROM\s+(\w+)/i.exec(sql)?.[1];
  if (from) {
    const table = tables.find(item => item.name.toLowerCase() === from.toLowerCase());
    const count = table ? db.exec(`SELECT COUNT(*) FROM ${table.name}`)[0]?.values[0]?.[0] : null;
    steps.push({ label: '1 · FROM', detail: `Start with ${from}${count === null || count === undefined ? '' : ` (${count} sample rows)`}.` });
  }
  if (/\bJOIN\b/i.test(sql)) steps.push({ label: `${steps.length + 1} · JOIN`, detail: 'Match records across tables using the ON condition.' });
  if (/\bWHERE\b/i.test(sql)) steps.push({ label: `${steps.length + 1} · WHERE`, detail: 'Keep only rows where the condition is true.' });
  if (/\bGROUP\s+BY\b/i.test(sql)) steps.push({ label: `${steps.length + 1} · GROUP BY`, detail: 'Collect rows into groups before calculating aggregates.' });
  steps.push({ label: `${steps.length + 1} · SELECT`, detail: `Show ${result.columns.length} ${result.columns.length === 1 ? 'column' : 'columns'} in the result.` });
  if (/\bORDER\s+BY\b/i.test(sql)) steps.push({ label: `${steps.length + 1} · ORDER BY`, detail: 'Sort the result rows using the requested column and direction.' });
  const plan: string[] = [];
  try {
    const statement = db.prepare(`EXPLAIN QUERY PLAN ${sql}`);
    try { while (statement.step() && plan.length < 12) plan.push(String(statement.get()[3] ?? '')); }
    finally { statement.free(); }
  } catch { /* Results remain valid even when a browser SQLite build cannot explain a query. */ }
  return { steps, plan };
}
