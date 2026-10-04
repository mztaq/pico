import { examples } from '../examples';
export interface TestCase { id: string; name: string; inputs: string[]; expected: string[]; }
export interface PicoProject { id: string; name: string; code: string; tests: TestCase[]; updatedAt: number; }
const PROJECTS_KEY='pico.projects.v1'; const ACTIVE_KEY='pico.activeProject.v1'; const starter=examples[1]!;
const initialProject: PicoProject={id:'project-starter',name:'Untitled program',code:starter.code,tests:[{id:'test-count-five',name:'Counts from 1 to 5',inputs:[],expected:['1','2','3','4','5']}],updatedAt:Date.now()};
export function loadProjects(): PicoProject[]{try{const raw:unknown=JSON.parse(localStorage.getItem(PROJECTS_KEY)??'null');if(Array.isArray(raw)){const valid=raw.filter(isProject);if(valid.length)return valid;}}catch{}return[initialProject];}
function isProject(v:unknown):v is PicoProject{if(!v||typeof v!=='object')return false;const p=v as Partial<PicoProject>;return typeof p.id==='string'&&typeof p.name==='string'&&typeof p.code==='string'&&Array.isArray(p.tests);}
export function saveProjects(projects:PicoProject[],activeId:string):void{localStorage.setItem(PROJECTS_KEY,JSON.stringify(projects));localStorage.setItem(ACTIVE_KEY,activeId);}
export function loadActiveId(projects:PicoProject[]):string{const id=localStorage.getItem(ACTIVE_KEY);return projects.some(p=>p.id===id)?id!:projects[0]!.id;}
export function newProject():PicoProject{return{id:crypto.randomUUID(),name:'Untitled program',code:'DECLARE Number : INTEGER\nNumber ← 42\nOUTPUT Number',tests:[],updatedAt:Date.now()};}
export function projectFromExample(exampleId:string):PicoProject|undefined{const e=examples.find(x=>x.id===exampleId);return e?{id:crypto.randomUUID(),name:e.name,code:e.code,tests:[{id:crypto.randomUUID(),name:`${e.name} example`,inputs:[...e.inputs],expected:[...e.expected]}],updatedAt:Date.now()}:undefined;}
export function exportProject(project:PicoProject):void{const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${project.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'pico-project'}.pico`;a.click();URL.revokeObjectURL(url);}
export async function importProject(file:File):Promise<PicoProject>{const data=JSON.parse(await file.text()) as Partial<PicoProject>;if(!isProject(data))throw new Error('That file is not a valid Pico .pico project.');return{...data,id:crypto.randomUUID(),updatedAt:Date.now()};}
