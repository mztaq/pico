import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createDatabase, runQuery } from './engine';
import { inspectQuery } from './inspection';

it('traces the clauses and includes SQLite’s real read plan', async () => {
  const wasm = readFileSync(new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));
  const db = await createDatabase(undefined, Uint8Array.from(wasm).buffer);
  const source = 'SELECT Name FROM Students WHERE YearGroup = 10 ORDER BY Name';
  const inspection = inspectQuery(db, source, runQuery(db, source));
  expect(inspection.steps.map(step => step.label)).toEqual(['1 · FROM', '2 · WHERE', '3 · SELECT', '4 · ORDER BY']);
  expect(inspection.steps[0]?.detail).toContain('6 sample rows');
  expect(inspection.plan.length).toBeGreaterThan(0);
  db.close();
});
