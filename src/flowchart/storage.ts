import { DATA_TYPES, NODE_KINDS, type FlowchartProject, newChart } from './model';
import { normalizeProjectName } from '../storage/projects';
const KEY='pico.flowcharts.v1';
export interface ChartStore {projects:FlowchartProject[];activeId:string;tutorialCompleted?:boolean;}
export function readChart(value:unknown):FlowchartProject {
  if(!value||typeof value!=='object') throw Error('Choose a Pico flowchart file.');
  const p=value as FlowchartProject;
  if(typeof p.id!=='string'||!p.id||p.id.length>100||typeof p.name!=='string'||!normalizeProjectName(p.name)||!Array.isArray(p.nodes)||!Array.isArray(p.edges)||typeof p.routines!=='string') throw Error('Invalid flowchart file.');
  if(p.nodes.length>250||p.edges.length>500||p.routines.length>100_000) throw Error('This flowchart is too large.');
  const ids=new Set<string>();
  const nodes=p.nodes.map(n=>{
    if(!n||typeof n.id!=='string'||!n.id||n.id.length>100||ids.has(n.id)||!NODE_KINDS.includes(n.kind)||typeof n.text!=='string'||n.text.length>4000||!DATA_TYPES.includes(n.dataType)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||n.x<0||n.y<0||n.x>10000||n.y>10000) throw Error('Invalid flowchart block.');
    ids.add(n.id);return {id:n.id,kind:n.kind,text:n.text,dataType:n.dataType,x:n.x,y:n.y};
  });
  const edgeIds=new Set<string>();
  const edges=p.edges.map(e=>{
    if(!e||typeof e.id!=='string'||!e.id||edgeIds.has(e.id)||!ids.has(e.from)||!ids.has(e.to)||!['next','yes','no'].includes(e.port)) throw Error('Invalid flowchart connection.');
    edgeIds.add(e.id);return {id:e.id,from:e.from,to:e.to,port:e.port};
  });
  return {id:p.id,name:normalizeProjectName(p.name),nodes,edges,routines:p.routines};
}
export function chartNameExists(name:string,projects:FlowchartProject[],except?:string) {return projects.some(p=>p.id!==except&&normalizeProjectName(p.name).toLowerCase()===normalizeProjectName(name).toLowerCase());}
export function uniqueChartName(name:string,projects:FlowchartProject[]) {
  const base=normalizeProjectName(name)||'Untitled flowchart';let candidate=base;
  for(let index=2;chartNameExists(candidate,projects);index++) {const suffix=` (${index})`;candidate=base.slice(0,42-suffix.length).trimEnd()+suffix;}
  return candidate;
}
export function loadCharts():ChartStore {
  try {
    const stored=JSON.parse(localStorage.getItem(KEY)??'null');
    if(stored?.version===1&&Array.isArray(stored.projects)) {
      const projects:FlowchartProject[]=[];
      for(const raw of stored.projects.slice(0,50)) {
        try {const p=readChart(raw);if(projects.some(x=>x.id===p.id))p.id=crypto.randomUUID();p.name=uniqueChartName(p.name,projects);projects.push(p);}catch {/* Keep other valid projects. */}
      }
      if(projects.length) return {projects,activeId:projects.some(p=>p.id===stored.activeId)?stored.activeId:projects[0].id,...(stored.tutorialCompleted===true?{tutorialCompleted:true}:{})};
    }
  } catch {/* Blocked storage and damaged files do not prevent editing. */}
  const project=newChart();return {projects:[project],activeId:project.id};
}
export function saveCharts(store:ChartStore) {localStorage.setItem(KEY,JSON.stringify({version:1,...store}));}
export function serializeChart(project:FlowchartProject) {return JSON.stringify({format:'pico-flowchart',version:1,project},null,2);}
export function importChart(source:string):FlowchartProject {
  if(source.length>2_000_000) throw Error('Choose a flowchart file smaller than 2 MB.');
  const value=JSON.parse(source);
  if(value?.format!=='pico-flowchart'||value.version!==1) throw Error('Choose a .picochart file exported by Pico.');
  const project=readChart(value.project);project.id=crypto.randomUUID();return project;
}
