import { examples } from '../examples';
import type { DataType } from '../language/ast';
import { isAutoDeclaredType } from '../language/autoDeclare';
export interface TestCase { id: string; name: string; inputs: string[]; expected: string[]; }
export interface PicoFile { id: string; name: string; code: string; autoDeclaredTypes?: Record<string, DataType>; }
export interface PicoProject { id: string; name: string; code: string; files: PicoFile[]; activeFileId: string; tests: TestCase[]; updatedAt: number; }
const PROJECTS_KEY='pico.projects.v1'; const ACTIVE_KEY='pico.activeProject.v1'; const starter=examples[1]!;
function makeFile(name:string,code:string,id:string=crypto.randomUUID()):PicoFile{return{id,name,code};}
function makeProject(id:string,name:string,code:string,tests:TestCase[]):PicoProject{const file=makeFile('main.pseudocode',code,`${id}-main`);return{id,name,code,files:[file],activeFileId:file.id,tests,updatedAt:Date.now()};}
const initialProject: PicoProject=makeProject('project-starter','Untitled program',starter.code,[{id:'test-count-five',name:'Counts from 1 to 5',inputs:[],expected:['1','2','3','4','5']}]);
export function loadProjects():PicoProject[]{try{const raw:unknown=JSON.parse(localStorage.getItem(PROJECTS_KEY)??'null');if(Array.isArray(raw)){const valid=raw.map(normalizeProject).filter((p):p is PicoProject=>Boolean(p));if(valid.length)return valid;}}catch{}return[initialProject];}
function normalizeProject(value: unknown): PicoProject | undefined {
  if (!value || typeof value !== 'object') return;
  const project = value as Partial<PicoProject>;
  if (typeof project.id !== 'string' || typeof project.name !== 'string' || !Array.isArray(project.tests)) return;
  const legacyCode = typeof project.code === 'string' ? project.code : '';
  const rawFiles = Array.isArray(project.files) ? project.files.map(normalizeFile).filter((file): file is PicoFile => Boolean(file)) : [];
  const files = rawFiles.length ? rawFiles : [makeFile('main.pseudocode', legacyCode, `${project.id}-main`)];
  const activeFileId = files.some(file => file.id === project.activeFileId) ? project.activeFileId! : files[0]!.id;
  const active = files.find(file => file.id === activeFileId)!;
  return { ...project, code: active.code, files, activeFileId, updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : Date.now() } as PicoProject;
}

function normalizeFile(value: unknown): PicoFile | undefined {
  if (!value || typeof value !== 'object') return;
  const file = value as Partial<PicoFile>;
  if (typeof file.id !== 'string' || typeof file.name !== 'string' || typeof file.code !== 'string') return;
  const autoDeclaredTypes = file.autoDeclaredTypes && typeof file.autoDeclaredTypes === 'object' && !Array.isArray(file.autoDeclaredTypes)
    ? Object.fromEntries(Object.entries(file.autoDeclaredTypes).filter(([, type]) => isAutoDeclaredType(type))) as Record<string, DataType>
    : undefined;
  return { id: file.id, name: file.name, code: file.code, ...(autoDeclaredTypes ? { autoDeclaredTypes } : {}) };
}
export function saveProjects(projects:PicoProject[],activeId:string):void{localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));localStorage.setItem(ACTIVE_KEY,activeId);}
export function loadActiveId(projects:PicoProject[]):string{const id=localStorage.getItem(ACTIVE_KEY);return projects.some(p=>p.id===id)?id!:projects[0]!.id;}
export function newProject(name='Untitled program'):PicoProject{return makeProject(crypto.randomUUID(),name,'DECLARE Number : INTEGER\nNumber ← 42\nOUTPUT Number',[]);}
export function projectFromExample(exampleId:string):PicoProject|undefined{const e=examples.find(x=>x.id===exampleId);return e?makeProject(crypto.randomUUID(),e.name,e.code,[{id:crypto.randomUUID(),name:`${e.name} example`,inputs:[...e.inputs],expected:[...e.expected]}]):undefined;}
export function exportProject(project:PicoProject):void{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'pico-project'}.pico`;a.click();URL.revokeObjectURL(url);}
export async function importProject(file:File):Promise<PicoProject>{const data=JSON.parse(await file.text());const project=normalizeProject(data);if(!project)throw new Error('That file is not a valid Pico .pico project.');const id=crypto.randomUUID();const files=project.files.map(f=>({...f,id:crypto.randomUUID()}));return{...project,id,files,activeFileId:files[0]!.id,code:files[0]!.code,updatedAt:Date.now()};}
