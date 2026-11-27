import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs, { type SqlModule } from 'sql.js';
import { csvTable, parseCsv, toCsv } from './csv';
import { executeSql } from './engine';
import { formatIdentifier } from './identifiers';
import { resizeManualGrid, validateManualTable } from './manual-table';

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

describe('manual worksheet tables', () => {
  it('creates named fields with types and primary keys and joins manual and CSV tables', () => {
    const created = executeSql(SQL, { action:'create', table:{name:'Students', columns:[{name:'ID',type:'INTEGER',primaryKey:true},{name:'Full name',type:'TEXT',primaryKey:false},{name:'Active',type:'BOOLEAN',primaryKey:false}], rows:[['1','Ada','true'],['2',"O'Brien",'false']]} });
    expect(created.tables[0]?.name).toBe('Students');
    expect(created.result?.rows).toEqual([[1,'Ada',1],[2,"O'Brien",0]]);
    const imported=executeSql(SQL,{action:'import',database:created.database,files:[{name:'marks.csv',text:'id,score\n1,96\n2,78'}]});
    expect(executeSql(SQL,{action:'query',database:imported.database,sql:'SELECT "Full name", score FROM Students JOIN marks ON Students.ID=marks.id WHERE Active=1;'}).result?.rows).toEqual([['Ada',96]]);
  });
  it('supports empty tables and rejects duplicate names, invalid integers and duplicate primary keys', () => {
    const columns=[{name:'ID',type:'INTEGER',primaryKey:true}] as const;
    const create=(rows:string[][])=>executeSql(SQL,{action:'create',table:{name:'Records',columns:[...columns],rows}});
    expect(create([]).tables).toHaveLength(1);
    expect(()=>create([['bad']])).toThrow(/integer/);
    expect(()=>create([['1'],['1']])).toThrow(/UNIQUE/);
    expect(()=>executeSql(SQL,{action:'create',table:{name:'Records',columns:[...columns,...columns],rows:[]}})).toThrow(/unique/);
  });
});

describe('worksheet dimensions and syllabus data types', () => {
  it('expands and shrinks the entry grid without losing retained data', () => {
    const columns = [{ name:'ID', type:'INTEGER', primaryKey:true }] as const;
    const larger = resizeManualGrid([...columns], [['1']], 3, 10);
    expect(larger.columns).toHaveLength(3);
    expect(larger.rows).toHaveLength(10);
    expect(larger.rows[0]).toEqual(['1','','']);
    expect(larger.columns[0]).toEqual(columns[0]);
    expect(resizeManualGrid(larger.columns,larger.rows,1,1).rows).toEqual([['1']]);
    expect(resizeManualGrid(larger.columns,larger.rows,2,0).rows).toEqual([]);
    expect(()=>resizeManualGrid([],[],0,1)).toThrow();
  });
  it('validates character, date and time values before inserting', () => {
    const table = {name:'Attendance',columns:[{name:'Code',type:'CHARACTER',primaryKey:true},{name:'Day',type:'DATE',primaryKey:false},{name:'Arrival',type:'TIME',primaryKey:false},{name:'Recorded',type:'DATETIME',primaryKey:false}] as const,rows:[['A','2026-11-27','08:30','2026-11-27T08:30']]};
    expect(executeSql(SQL,{action:'create',table:{...table,columns:[...table.columns]}}).result?.rows).toEqual([['A','2026-11-27','08:30','2026-11-27 08:30']]);
    for (const row of [['AB','2026-11-27','08:30','2026-11-27'],['A','2026-02-30','08:30','2026-11-27'],['A','2026-11-27','25:00','2026-11-27']]) {
      expect(()=>validateManualTable({...table,columns:[...table.columns],rows:[row]})).toThrow();
    }
  });
});

describe('worksheet SQL ordering', () => {
  it('accepts both spelled-out directions and standard SQLite ASC/DESC', () => {
    const data=executeSql(SQL,{action:'import',files:[{name:'scores.csv',text:'name,score\nAda,90\nSam,60\nLee,80'}]});
    for (const direction of ['DESCENDING','DESC']) {
      expect(executeSql(SQL,{action:'query',database:data.database,sql:'SELECT name FROM scores WHERE score > 60 ORDER BY score '+direction+';'}).result?.rows).toEqual([['Ada'],['Lee']]);
    }
    for (const direction of ['ASCENDING','ASC']) {
      expect(executeSql(SQL,{action:'query',database:data.database,sql:'SELECT name FROM scores ORDER BY score '+direction+';'}).result?.rows).toEqual([['Sam'],['Lee'],['Ada']]);
    }
  });
  it('does not rewrite field names, quoted strings or comments', () => {
    const data=executeSql(SQL,{action:'query',sql:"CREATE TABLE t (descending INTEGER, note TEXT); INSERT INTO t VALUES (1,'ORDER BY score DESCENDING'),(2,'ASCENDING');"});
    expect(executeSql(SQL,{action:'query',database:data.database,sql:"SELECT note FROM t ORDER BY descending DESCENDING; -- ORDER BY note DESCENDING"}).result?.rows).toEqual([['ASCENDING'],['ORDER BY score DESCENDING']]);
    expect(executeSql(SQL,{action:'query',database:data.database,sql:'SELECT descending FROM t ORDER BY descending;'}).result?.rows).toEqual([[1],[2]]);
  });
});

describe('Cambridge-style identifiers', () => {
  it.each([['Students','Students'],['Student_ID','Student_ID'],['Score','Score'],['Full name','"Full name"'],['SELECT','"SELECT"'],['order','"order"'],['true','"true"'],['ASCENDING','"ASCENDING"'],['12A','"12A"'],['A"B','"A""B"']])('formats %s as %s', (name, expected) => {
    expect(formatIdentifier(name)).toBe(expected);
  });
  it('generates executable bare-name queries for imported and manually created tables', () => {
    const imported = executeSql(SQL,{action:'import',files:[{name:'Students.csv',text:'Name,Score\nAda,90'}]});
    expect(imported.suggestedQuery).toBe('SELECT * FROM Students;');
    const created = executeSql(SQL,{action:'create',database:imported.database,table:{name:'Order',columns:[{name:'Full name',type:'TEXT',primaryKey:false}],rows:[['Ada']]}});
    expect(created.suggestedQuery).toBe('SELECT * FROM "Order";');
    expect(executeSql(SQL,{action:'query',database:created.database,sql:created.suggestedQuery}).result?.rows).toEqual([['Ada']]);
    expect(executeSql(SQL,{action:'query',database:created.database,sql:'SELECT Name, Score FROM Students WHERE Score > 80;'}).result?.rows).toEqual([['Ada',90]]);
  });
});
