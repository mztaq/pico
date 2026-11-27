// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { restoreRecords, queryNeedsSave, type StoredRecord } from './storage';
import type { SqlResponse } from './engine';

afterEach(()=>localStorage.clear());

describe('SQL local workspace restoration',()=>{
  const response:SqlResponse={database:new Uint8Array([1,2,3]),tables:[{name:'Students',columns:[{name:'ID',type:'INTEGER',primaryKey:true}]}],result:{columns:['ID'],rows:[[7]],truncated:false},message:'Created Students'};
  it('restores binary database snapshots, table designs, results, separate queries, selection and layout',()=>{
    const records:StoredRecord[]=[
      {key:'database:School',kind:'database',name:'School',query:'SELECT * FROM Students;',response},
      {key:'database:Practice',kind:'database',name:'Practice',query:'SELECT 1;'},
      {key:'query:School',kind:'query',name:'School',value:'SELECT ID FROM Students;'},
      {key:'selection',kind:'selection',name:'School'},
      {key:'layout',kind:'layout',value:{sidebarWidth:310,editorRatio:65}},
    ];
    const saved=restoreRecords(records);
    expect(saved.selected).toBe('School');
    expect(saved.databases.get('School')?.response).toEqual(response);
    expect(saved.databases.get('School')?.query).toBe('SELECT ID FROM Students;');
    expect(saved.databases.get('Practice')?.query).toBe('SELECT 1;');
    expect(saved.layout).toEqual({sidebarWidth:310,editorRatio:65});
  });
  it('restores the latest synchronous draft even before the IndexedDB write completes',()=>{
    localStorage.setItem('pico:sql:query:School','SELECT Name FROM Students');
    expect(restoreRecords([{key:'database:School',kind:'database',name:'School',query:'SELECT 1;',response}]).databases.get('School')?.query).toBe('SELECT Name FROM Students');
  });
  it('restores named queries separately for each database',()=>{
    const saved=restoreRecords([{key:'database:A',kind:'database',name:'A',query:''},{key:'database:B',kind:'database',name:'B',query:''},{key:'savedQueries:A',kind:'savedQueries',name:'A',value:[{name:'Top scores',sql:'SELECT Score FROM Students;'}]}]);
    expect(saved.databases.get('A')?.savedQueries).toEqual([{name:'Top scores',sql:'SELECT Score FROM Students;'}]);
    expect(saved.databases.get('B')?.savedQueries).toEqual([]);
  });
  it('restores the active named query and its latest synchronous draft',()=>{
    localStorage.setItem('pico:sql:active-query:School','Query1');
    localStorage.setItem('pico:sql:query:School','SELECT Score FROM Students;');
    const saved=restoreRecords([{key:'database:School',kind:'database',name:'School',query:''},{key:'savedQueries:School',kind:'savedQueries',name:'School',value:[{name:'Query1',sql:'SELECT * FROM Students;'}]}]);
    expect(saved.databases.get('School')?.activeQuery).toBe('Query1');
    expect(saved.databases.get('School')?.query).toBe('SELECT Score FROM Students;');
    expect(saved.databases.get('School')?.savedQueries?.[0]?.sql).toBe('SELECT * FROM Students;');
    expect(queryNeedsSave(saved.databases.get('School')!.query,'Query1',saved.databases.get('School')!.savedQueries!)).toBe(true);
  });
  it('restores field formats independently for each database',()=>{
    const saved=restoreRecords([{key:'database:A',kind:'database',name:'A',query:''},{key:'database:B',kind:'database',name:'B',query:''},{key:'displays:A',kind:'displays',name:'A',value:[{table:'Students',fields:[{name:'Passed',format:'yes-no'}]}]}]);
    expect(saved.databases.get('A')?.displays).toEqual([{table:'Students',fields:[{name:'Passed',format:'yes-no'}]}]);
    expect(saved.databases.get('B')?.displays).toEqual([]);
  });
  it('handles empty storage and missing selections, clamps invalid layout values',()=>{
    expect(restoreRecords([]).selected).toBeNull();
    const saved=restoreRecords([{key:'database:A',kind:'database',name:'A',query:''},{key:'selection',kind:'selection',name:'Missing'},{key:'layout',kind:'layout',value:{sidebarWidth:900,editorRatio:10}}]);
    expect(saved.selected).toBe('A');
    expect(saved.layout).toEqual({sidebarWidth:420,editorRatio:25});
  });
  it('refuses invalid database bytes instead of silently replacing saved data',()=>{
    expect(()=>restoreRecords([{key:'database:School',kind:'database',name:'School',query:'',response:{...response,database:[1,2] as unknown as Uint8Array}}])).toThrow(/Invalid saved database/);
  });
});

describe('explicit query saving',()=>{
  it('requires saving changed or unnamed drafts, not unchanged queries',()=>{
    const queries=[{name:'Query1',sql:'SELECT * FROM Students;'}];
    expect(queryNeedsSave('SELECT * FROM Students;','Query1',queries)).toBe(false);
    expect(queryNeedsSave('SELECT Name FROM Students;','Query1',queries)).toBe(true);
    expect(queryNeedsSave('', 'Query1',queries)).toBe(true);
    expect(queryNeedsSave('SELECT 1;',null,queries)).toBe(true);
    expect(queryNeedsSave(' ',null,queries)).toBe(false);
  });
});
