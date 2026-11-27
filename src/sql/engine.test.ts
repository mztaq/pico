import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlModule } from 'sql.js';
import { csvTable, parseCsv, toCsv } from './csv';
import { executeSql } from './engine';

let SQL: SqlModule;
beforeAll(async () => { SQL = await initSqlJs(); });
describe('CSV parser', () => {
  it('handles BOM, quoted commas, doubled quotes, multiline fields and CRLF', () => {
    expect(parseCsv('\uFEFFname,note\r\n"Ada, A.","line 1\nline ""2"""\r\n')).toEqual([['name','note'],['Ada, A.','line 1\nline "2"']]);
  });
  it('preserves leading-zero identifiers and infers numeric columns', () => {
    expect(csvTable('id,score,score\n001,90,2.5\n002,,3.5')).toEqual({names:['id','score','score_2'],types:['TEXT','INTEGER','REAL'],values:[['001',90,2.5],['002',null,3.5]]});
  });
  it('rejects broken rows and quotes', () => {
    expect(() => parseCsv('a,b\n1')).toThrow();
    expect(() => parseCsv('a,b\n"x,2')).toThrow();
  });
  it('escapes exported spreadsheet formula text', () => {
    expect(toCsv(['name'],[['=1+1']])).toBe('"name"\r\n"\'=1+1"\r\n');
  });
});
describe('real SQLite', () => {
  it('imports multiple tables, joins, groups, filters and preserves edits', () => {
    const imported = executeSql(SQL, { action:'import', files:[{name:'students.csv',text:'id,name\n1,Ada\n2,Sam'},{name:'marks.csv',text:'student_id,score\n1,90\n1,80\n2,60'}] });
    expect(imported.tables.map(table => table.name)).toEqual(['marks','students']);
    const joined = executeSql(SQL, { action:'query', database:imported.database, sql:'SELECT s.name, AVG(m.score) AS average FROM students s JOIN marks m ON s.id=m.student_id GROUP BY s.name HAVING AVG(m.score)>70;' });
    expect(joined.result?.rows).toEqual([['Ada',85]]);
    const changed = executeSql(SQL,{ action:'query', database:joined.database,sql:"UPDATE students SET name='Alex' WHERE id=2; SELECT name FROM students WHERE id=2;"});
    expect(changed.result?.rows).toEqual([['Alex']]);
    expect(() => executeSql(SQL,{action:'query',database:changed.database,sql:'DELETE FROM students; SELECT * FROM nonexistent;'})).toThrow();
    expect(executeSql(SQL,{action:'query',database:changed.database,sql:'SELECT COUNT(*) FROM students;'}).result?.rows).toEqual([[2]]);
  });
  it('limits large result previews', () => {
    const reply=executeSql(SQL,{action:'query',sql:'WITH RECURSIVE nums(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM nums WHERE n<600) SELECT n FROM nums;'});
    expect(reply.result?.rows).toHaveLength(500);
    expect(reply.result?.truncated).toBe(true);
  });
});
