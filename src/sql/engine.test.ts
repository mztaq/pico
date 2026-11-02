import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { singleStatement, explain, createDatabase, runQuery } from './engine';

describe('SQL practice boundaries and feedback', () => {
  it('accepts quoted semicolons and trailing comments but rejects stacked statements', () => {
    expect(singleStatement("SELECT ';' FROM Students; -- okay")).toBe("SELECT ';' FROM Students");
    expect(() => singleStatement('SELECT * FROM Students; DELETE FROM Students')).toThrow(/one SQL statement/i);
  });
  it('allows changes only to sample tables', () => {
    expect(singleStatement('UPDATE Results SET Score = 88 WHERE ResultID = 1')).toContain('Results');
    expect(() => singleStatement('DELETE FROM sqlite_sequence')).toThrow(/limited to/i);
    expect(() => singleStatement('ATTACH DATABASE x AS other')).toThrow(/runs SELECT/i);
  });
  it('distinguishes an empty valid result from an error', () => {
    expect(explain('SELECT Name FROM Students WHERE YearGroup = 20', { kind: 'select', rows: [], changes: 0 }).explanation).toMatch(/ran successfully, but no rows/i);
  });
  it('runs joins, aggregates and edits in the local SQLite database', async () => {
    const wasm = readFileSync(new URL('../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));
    const db = await createDatabase(undefined, Uint8Array.from(wasm).buffer);
    expect(runQuery(db, 'SELECT Clubs.ClubName, COUNT(*) FROM Students JOIN Clubs ON Students.ClubID = Clubs.ClubID GROUP BY Clubs.ClubID ORDER BY Clubs.ClubID').rows).toEqual([['Robotics', 3], ['Chess', 2], ['Art', 1]]);
    expect(runQuery(db, "INSERT INTO Results VALUES (99, 1, 'Computing', 80)").changes).toBe(1);
    expect(runQuery(db, 'UPDATE Results SET Score=88 WHERE ResultID=99').changes).toBe(1);
    expect(runQuery(db, 'SELECT Score FROM Results WHERE ResultID=99').rows).toEqual([[88]]);
    expect(() => runQuery(db, "INSERT INTO Results VALUES (100, 999, 'Computing', 80)")).toThrow(/FOREIGN KEY/i);
    db.close();
  });
});
