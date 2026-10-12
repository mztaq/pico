import type { DataType } from '../language/ast';

export const NODE_KINDS = ['start', 'end', 'input', 'output', 'process', 'decision', 'declare', 'call'] as const;
export type NodeKind = typeof NODE_KINDS[number];
export type Port = 'next' | 'yes' | 'no';
export interface ChartNode { id: string; kind: NodeKind; x: number; y: number; text: string; dataType: DataType; }
export interface ChartEdge { id: string; from: string; to: string; port: Port; }
export interface FlowchartProject { id: string; name: string; nodes: ChartNode[]; edges: ChartEdge[]; routines: string; }
export const NODE_WIDTH = 208;
export const NODE_HEIGHT = 92;
export const DATA_TYPES: DataType[] = ['INTEGER', 'REAL', 'STRING', 'CHAR', 'BOOLEAN'];
export const BLOCKS: { kind: NodeKind; label: string; hint: string; text: string }[] = [
  {kind:'start',label:'Start',hint:'Begin the program',text:'Start'},
  {kind:'end',label:'End',hint:'Finish the program',text:'End'},
  {kind:'input',label:'Input',hint:'Read a typed value',text:'Number'},
  {kind:'output',label:'Output',hint:'Display text or values',text:'"Hello"'},
  {kind:'process',label:'Process',hint:'Assign or calculate a value',text:'Total ← Number * 2'},
  {kind:'decision',label:'Decision',hint:'Choose Yes or No',text:'Number > 10'},
  {kind:'call',label:'Subroutine',hint:'Call a procedure',text:'ShowResult()'},
];
export function createNode(kind: NodeKind, x: number, y: number): ChartNode {
  return {id:crypto.randomUUID(),kind,x:Math.min(10000,Math.max(0,x)),y:Math.min(10000,Math.max(0,y)),text:BLOCKS.find(block=>block.kind===kind)!.text,dataType:'INTEGER'};
}
export function nodeLabel(node: ChartNode): string {
  if(node.kind==='input') return `INPUT ${node.text}`;
  if(node.kind==='output') return `OUTPUT ${node.text}`;
  if(node.kind==='declare') return node.text.includes(':') ? `DECLARE ${node.text}` : `DECLARE ${node.text} : ${node.dataType}`;
  if(node.kind==='call') return `CALL ${node.text}`;
  return node.text;
}
export function ports(node: ChartNode): Port[] { return node.kind==='end'?[]:node.kind==='decision'?['yes','no']:['next']; }
export function connectNodes(project: FlowchartProject, from: string, port: Port, to: string): FlowchartProject {
  const source=project.nodes.find(node=>node.id===from), target=project.nodes.find(node=>node.id===to);
  if(!source || !target || target.kind==='start' || !ports(source).includes(port)) return project;
  return {...project,edges:[...project.edges.filter(edge=>edge.from!==from||edge.port!==port),{id:crypto.randomUUID(),from,to,port}]};
}
export function removeNode(project: FlowchartProject, id: string): FlowchartProject {
  return {...project,nodes:project.nodes.filter(node=>node.id!==id),edges:project.edges.filter(edge=>edge.from!==id&&edge.to!==id)};
}
export function newChart(name='Untitled flowchart'):FlowchartProject {return {id:crypto.randomUUID(),name,nodes:[],edges:[],routines:''};}
export function blockName(kind:NodeKind):string {return kind==='declare'?'Variable':BLOCKS.find(b=>b.kind===kind)!.label;}
