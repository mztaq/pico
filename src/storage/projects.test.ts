import { afterEach, describe, expect, it, vi } from 'vitest';
import { importProject, loadActiveId, loadProjects, newProject, projectFromExample, projectNameExists, uniqueProjectName, saveProjects } from './projects';
import { compile } from '../language';
import { execute } from '../runtime/interpreter';
import { examples } from '../examples';
const asFile=(data:unknown)=>({size:100,text:async()=>JSON.stringify(data)}) as File;
afterEach(()=>vi.unstubAllGlobals());
describe('project persistence boundaries',()=>{
  it('checks names ignoring case and repeated whitespace, with a rename exemption',()=>{
    const project=newProject('Lesson One');
    expect(projectNameExists('  lesson   ONE ',[project])).toBe(true);
    expect(projectNameExists('Lesson One',[project],project.id)).toBe(false);
    expect(uniqueProjectName('LESSON ONE',[project,newProject('lesson one (2)')])).toBe('LESSON ONE (3)');
    const long=newProject('x'.repeat(42));
    expect(uniqueProjectName(long.name,[long])).toBe(`${'x'.repeat(38)} (2)`);
  });
  it('renames existing duplicates without dropping projects or changing their code',()=>{
    const projects=[newProject('Lesson'),newProject(' lesson '),newProject('LESSON (2)'),newProject('')];
    const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
    saveProjects(projects,projects[1]!.id);
    const loaded=loadProjects();
    expect(new Set(loaded.map(project=>project.name.toLowerCase())).size).toBe(4);
    expect(loaded.map(project=>project.id)).toEqual(projects.map(project=>project.id));
    expect(loaded.map(project=>project.code)).toEqual(projects.map(project=>project.code));
    expect(loadActiveId(loaded)).toBe(projects[1]!.id);
  });
  it('adds the exact credit comment to fresh main.pico files without changing their output',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>null});
    const projects = [loadProjects()[0]!, newProject(), projectFromExample(examples[1]!.id)!];
    const header = '// PICO - CAIE Friendly Pseudocode Compiler made by Mustaqim and Amar';
    for (const project of projects) {
      expect(project.files[0]!.name).toBe('main.pico');
      expect(project.files[0]!.code.split('\n')[0]).toBe(header);
      expect(project.code).toBe(project.files[0]!.code);
      const result = execute(compile(project.code).ast, project.tests[0]?.inputs ?? []);
      expect(result.output).toEqual(project.tests.length ? project.tests[0]!.expected : ['42']);
    }
  });
  it('keeps edited main.pico contents unchanged during save, load, and import',async()=>{
    const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
    const project = newProject();
    project.files[0]!.code = 'OUTPUT "My existing work"';
    project.code = project.files[0]!.code;
    saveProjects([project],project.id);
    expect(loadProjects()[0]!.code).toBe(project.code);
    expect((await importProject(asFile(project))).code).toBe(project.code);
  });
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

it('keeps Python and pseudocode storage separate and imports only matching projects',async()=>{
  const stored=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)});
  const pseudo=newProject('Algorithm'), python=newProject('Python lesson','python');
  expect(python.files[0]!.name).toBe('main.py');expect(python.code).toContain('input(');
  saveProjects([pseudo],pseudo.id);saveProjects([python],python.id,'python');
  expect(loadProjects()[0]!.id).toBe(pseudo.id);expect(loadProjects('python')[0]!.id).toBe(python.id);
  expect(loadActiveId([python],'python')).toBe(python.id);
  expect((await importProject(asFile(python),'python')).language).toBe('python');
  await expect(importProject(asFile(python))).rejects.toThrow(/Python Compiler/);
  await expect(importProject(asFile(pseudo),'python')).rejects.toThrow(/Pseudocode Compiler/);
  await expect(importProject(asFile({...python,language:'unknown'}),'python')).rejects.toThrow(/valid Pico/);
});
it('imports Python source without applying pseudocode transformations',async()=>{
  const code='text="<- unchanged"\nprint(f"{text}")';
  const project=await importProject({name:'lesson.py',size:80,text:async()=>code} as File,'python');
  expect(project.language).toBe('python');expect(project.files[0]!.name).toBe('lesson.py');expect(project.code).toBe(code);
});
