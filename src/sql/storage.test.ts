// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { restoreRecords, type StoredRecord } from './storage';
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
