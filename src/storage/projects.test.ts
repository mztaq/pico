import { afterEach, describe, expect, it, vi } from 'vitest';
import { importProject, loadActiveId, loadProjects, newProject, saveProjects } from './projects';
const asFile=(data:unknown)=>({size:100,text:async()=>JSON.stringify(data)}) as File;
afterEach(()=>vi.unstubAllGlobals());
describe('project persistence boundaries',()=>{
  it('rejects malformed test records instead of crashing the test panel',async()=>{
    const project=newProject();
    await expect(importProject(asFile({...project,tests:[{id:'bad',name:'bad',inputs:42,expected:[]}]}))).rejects.toThrow(/valid Pico/);
  });
  it('preserves the selected file and virtual file contents on import',async()=>{
    const project=newProject();
    project.files.push({id:'second',name:'second.pseudocode',code:'OUTPUT 2'});project.activeFileId='second';project.virtualFiles={data:['hello world']};
    const imported=await importProject(asFile(project));
    expect(imported.code).toBe('OUTPUT 2');expect(imported.activeFileId).toBe(imported.files[1]!.id);expect(imported.virtualFiles).toEqual(project.virtualFiles);
  });
  it('uses a safe default when browser storage is blocked',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('Blocked');}});
    const projects=loadProjects();expect(projects.length).toBeGreaterThan(0);expect(loadActiveId(projects)).toBe(projects[0]!.id);
  });
  it('round-trips project-scoped virtual files through autosave',()=>{
    const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
    const project=newProject();project.virtualFiles={data:['first','second']};saveProjects([project],project.id);
    expect(loadProjects()[0]!.virtualFiles).toEqual(project.virtualFiles);
  });
  it('rejects oversized imports',async()=>{
    await expect(importProject({size:5_000_001,text:async()=>''} as File)).rejects.toThrow(/5 MB/);
  });
});

it('saves immutable practice files in project snapshots',async()=>{
  const {addVersion,loadHistory}=await import('./history');
  const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
  const project=newProject();const files={data:['original']};
  addVersion(project.id,'Before changes',project.files,project.activeFileId,files);files.data[0]='edited';
  expect(loadHistory(project.id)[0]!.virtualFiles).toEqual({data:['original']});
});

it('migrates saved and imported .pseudocode source names without changing code or active file',async()=>{
  const project=newProject();project.files[0]!.name='lesson.PSEUDOCODE';project.files[0]!.code='OUTPUT "unchanged"';
  const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
  saveProjects([project],project.id);const loaded=loadProjects()[0]!;
  expect(loaded.files[0]!.name).toBe('lesson.pico');expect(loaded.activeFileId).toBe(project.activeFileId);expect(loaded.code).toBe('OUTPUT "unchanged"');
  const imported=await importProject(asFile(project));expect(imported.files[0]!.name).toBe('lesson.pico');expect(imported.code).toBe(loaded.code);
  const {addVersion,loadHistory}=await import('./history');addVersion(project.id,'Old source',project.files,project.activeFileId);
  expect(loadHistory(project.id)[0]!.files[0]!.name).toBe('lesson.pico');
});
