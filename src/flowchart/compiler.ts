import { autoDeclareVariables, compile } from '../language';
import { parse } from '../language/parser';
import { tokenize } from '../language/lexer';
import type { Program, Statement } from '../language/ast';
import { nodeLabel, ports, type ChartNode, type FlowchartProject } from './model';

export class ChartError extends Error {
  constructor(message:string,public nodeId?:string) {super(message);this.name='ChartError';}
}
export interface ChartCompilation { code:string; ast:Program; lineNodes:Record<number,string>; mode:'structured'|'connections'; }
/** Convert connections, never the visual order, into executable pseudocode. */
export function compileFlowchart(project:FlowchartProject):ChartCompilation {
  const byId=new Map(project.nodes.map(node=>[node.id,node]));
  if(byId.size!==project.nodes.length) throw new ChartError('Two blocks have the same ID.');
  if(project.nodes.length>250) throw new ChartError('Use at most 250 blocks in one flowchart.');
  const starts=project.nodes.filter(node=>node.kind==='start');
  if(starts.length!==1) throw new ChartError('Add exactly one Start block.',starts[0]?.id);
  const start=starts[0];
  const routes=new Map<string,string>();
  for(const edge of project.edges) {
    const from=byId.get(edge.from),to=byId.get(edge.to);
    if(!from||!to) throw new ChartError('A connection points to a missing block.');
    if(to.kind==='start') throw new ChartError('Connect loops to a decision or process, not Start.',from.id);
    if(!ports(from).includes(edge.port)) throw new ChartError('This block has an invalid outgoing connection.',from.id);
    const key=`${edge.from}:${edge.port}`;
    if(routes.has(key)) throw new ChartError('Each outgoing port needs exactly one connection.',from.id);
    routes.set(key,edge.to);
  }
  const reachable=new Set<string>();
  function visit(id:string) {
    if(reachable.has(id)) return;
    reachable.add(id);const node=byId.get(id)!;
    for(const port of ports(node)) {
      const next=routes.get(`${id}:${port}`);
      if(!next) throw new ChartError(`Connect the ${port==='next'?'Next':port==='yes'?'Yes':'No'} port on this block.`,id);
      visit(next);
    }
  }
  visit(start.id);
  const disconnected=project.nodes.find(node=>!reachable.has(node.id));
  if(disconnected) throw new ChartError('Connect this block to the path from Start, or delete it.',disconnected.id);
  if(!project.nodes.some(node=>node.kind==='end')) throw new ChartError('Add an End block.');
  const next=(id:string,port='next')=>routes.get(`${id}:${port}`)!;
  const statements=new Map<string,string>();
  const declarations=new Map<string,{text:string;type:string;id:string;array:boolean}>();
  function declaration(statement:Extract<Statement,{kind:'Declaration'}>,text:string,id:string,explicit:boolean) {
    const previous=declarations.get(statement.name);
    if(previous && (previous.type!==statement.dataType || (explicit && previous.array && previous.text!==text))) throw new ChartError(`Conflicting declarations for ${statement.name}.`,id);
    if(!previous || explicit) declarations.set(statement.name,{text,type:statement.dataType,id,array:Boolean(statement.array)});
  }
  for(const node of project.nodes) {
    if(node.kind==='start'||node.kind==='end') continue;
    if(!node.text.trim() || /[\r\n]/.test(node.text)) throw new ChartError('Enter one expression or instruction in this block.',node.id);
    const text=nodeLabel(node).replace(/<-/g,'←');
    try {
      const source=node.kind==='decision'?`IF ${node.text} THEN\nENDIF`:text;
      const parsed=parse(tokenize(source));
      const expected:Record<string,Statement['kind'][]>={input:['Input'],output:['Output'],process:['Assignment','FileStatement'],decision:['IfStatement'],declare:['Declaration'],call:['CallStatement']};
      if(parsed.statements.length!==1 || !expected[node.kind].includes(parsed.statements[0].kind)) throw new Error('Use the instruction shown by this block’s type.');
      const s=parsed.statements[0];
      if(s.kind==='Declaration') declaration(s,text,node.id,true);
      else statements.set(node.id,node.kind==='decision'?node.text:text);
    } catch(error) {throw new ChartError(error instanceof Error?error.message:'Invalid block.',node.id);}
  }
  // A typed INPUT introduces its scalar variable. Array inputs use an explicit Variable block.
  for(const node of project.nodes.filter(node=>node.kind==='input')) {
    const statement=parse(tokenize(statements.get(node.id)!)).statements[0] as Extract<Statement,{kind:'Input'}>;
    if(!statement.target.indexes.length) {
      const name=statement.target.name,text=`DECLARE ${name} : ${node.dataType}`;
      declaration({kind:'Declaration',name,dataType:node.dataType,line:1,column:1,endColumn:1},text,node.id,false);
    } else if(!declarations.get(statement.target.name)?.array) throw new ChartError('Declare this array with a Variable block first.',node.id);
  }
  if(project.routines.trim()) {
    try {if(parse(tokenize(project.routines)).statements.some(s=>s.kind!=='Procedure'&&s.kind!=='Function')) throw new Error('Subroutines must contain PROCEDURE or FUNCTION definitions only.');}
    catch(error) {throw new ChartError(error instanceof Error?error.message:'Invalid subroutine definitions.');}
  }
  type Row={text:string;id?:string};
  const header:Row[]=[{text:'// Created in Pico Flowchart Builder'},...Array.from(declarations.values(),d=>({text:d.text,id:d.id})),{text:''}];
  const action=(node:ChartNode,indent:number):Row[]=>statements.has(node.id)?[{text:'  '.repeat(indent)+statements.get(node.id)!,id:node.id}]:[];
  // Postdominators identify branch joins. Back-edges use a separate loop test below.
  const all=new Set([...reachable,'@exit']);
  const post=new Map<string,Set<string>>([['@exit',new Set(['@exit'])],...Array.from(reachable,id=>[id,new Set(all)] as const)]);
  const reverseTraversal=[...reachable].reverse();
  for(let pass=0;pass<=project.nodes.length;pass++) {
    let changed=false;
    for(const id of reverseTraversal) {
      const node=byId.get(id)!;const successors=node.kind==='end'?['@exit']:ports(node).map(port=>next(id,port));
      const intersection=new Set(post.get(successors[0])!);
      for(const target of successors.slice(1)) for(const value of intersection) if(!post.get(target)!.has(value)) intersection.delete(value);
      intersection.add(id);
      const previous=post.get(id)!;
      if(previous.size!==intersection.size||[...previous].some(x=>!intersection.has(x))) {post.set(id,intersection);changed=true;}
    }
    if(!changed) break;
  }
  const join=(id:string)=>[...post.get(id)!].filter(x=>x!==id).find(candidate=>[...post.get(id)!].filter(x=>x!==id&&x!==candidate).every(other=>post.get(candidate)!.has(other)));
  // A loop branch must return to the decision along every path without leaving it.
  function returnsTo(first:string,headerId:string):boolean {
    const state=new Map<string,'visiting'|boolean>();
    function walk(id:string):boolean {
      if(id===headerId) return true;
      const previous=state.get(id);
      if(previous!==undefined) return previous==='visiting'?false:previous;
      const node=byId.get(id)!;if(node.kind==='end') return false;
      state.set(id,'visiting');
      const returns=ports(node).every(port=>walk(next(id,port)));
      state.set(id,returns);return returns;
    }
    return walk(first);
  }
  function canReach(id:string,target:string,seen=new Set<string>()):boolean {
    if(id===target) return true;if(seen.has(id)||id==='@exit') return false;
    const node=byId.get(id)!;if(node.kind==='end') return false;
    seen.add(id);return ports(node).some(port=>canReach(next(id,port),target,seen));
  }
  const emitted=new Set<string>();
  function block(first:string,stop:string,indent:number):Row[] {
    const rows:Row[]=[];let id=first;
    while(id!==stop&&id!=='@exit') {
      if(emitted.has(id)) throw new Error('Unstructured connections');
      emitted.add(id);const node=byId.get(id)!;
      if(node.kind==='end') return rows;
      if(node.kind==='decision') {
        const yes=next(id,'yes'),no=next(id,'no');
        const yesLoop=returnsTo(yes,id)&&!canReach(no,id),noLoop=returnsTo(no,id)&&!canReach(yes,id);
        if(yesLoop||noLoop) {
          rows.push({text:'  '.repeat(indent)+`WHILE ${yesLoop?node.text:`NOT (${node.text})`} DO`,id});
          rows.push(...block(yesLoop?yes:no,id,indent+1));
          rows.push({text:'  '.repeat(indent)+'ENDWHILE',id});id=yesLoop?no:yes;continue;
        }
        const merge=join(id);if(!merge) throw new Error('No branch join');
        rows.push({text:'  '.repeat(indent)+`IF ${node.text} THEN`,id});
        rows.push(...block(yes,merge,indent+1));rows.push({text:'  '.repeat(indent)+'ELSE',id});
        rows.push(...block(no,merge,indent+1));rows.push({text:'  '.repeat(indent)+'ENDIF',id});id=merge;
      } else {rows.push(...action(node,indent));id=next(id);}
    }
    return rows;
  }
  let rows:Row[],mode:ChartCompilation['mode']='structured';
  try {rows=[...header,...block(start.id,'@exit',0)];if(emitted.size!==reachable.size) throw new Error('Skipped block');}
  catch {
    mode='connections';
    // Any graph, including irreducible loops, has an exact finite-state translation.
    // Use a collision-free control variable and wrap CASE bodies to disambiguate assignments.
    let control='PicoFlowStep';while(project.nodes.some(n=>new RegExp(`\\b${control}\\b`,'i').test(n.text))||new RegExp(`\\b${control}\\b`,'i').test(project.routines))control+='X';
    const numbers=new Map(project.nodes.map((n,i)=>[n.id,i+1]));
    rows=[...header,{text:`DECLARE ${control} : INTEGER`},{text:`${control} ← ${numbers.get(start.id)}`},{text:`WHILE ${control} <> 0 DO`},{text:`  CASE OF ${control}`}];
    for(const node of project.nodes) {
      rows.push({text:`    ${numbers.get(node.id)}: IF TRUE THEN`,id:node.id});
      if(node.kind==='decision') {
        rows.push({text:`      IF ${node.text} THEN`,id:node.id},{text:`        ${control} ← ${numbers.get(next(node.id,'yes'))}`},{text:'      ELSE'},{text:`        ${control} ← ${numbers.get(next(node.id,'no'))}`},{text:'      ENDIF'});
      } else {rows.push(...action(node,3));rows.push({text:`      ${control} ← ${node.kind==='end'?0:numbers.get(next(node.id))}`});}
      rows.push({text:'    ENDIF'});
    }
    rows.push({text:'  ENDCASE'},{text:'ENDWHILE'});
  }
  if(project.routines.trim()) rows.push({text:''},...project.routines.split(/\r?\n/).map(text=>({text})));
  // Temporary comments preserve block IDs through declaration inference, then disappear.
  const tagged=rows.map(row=>row.id?`${row.text} // @pico-block:${encodeURIComponent(row.id)}`:row.text).join('\n');
  const lineNodes:Record<number,string>={};
  const code=autoDeclareVariables(tagged).split('\n').map((line,index)=>{
    const marker=/ \/\/ @pico-block:([^\s]+)$/.exec(line);
    if(marker) {lineNodes[index+1]=decodeURIComponent(marker[1]);return line.slice(0,marker.index);}
    return line;
  }).join('\n');
  try {return {code,ast:compile(code).ast,lineNodes,mode};}
  catch(error) {const line=(error as {line?:number})?.line;throw new ChartError(error instanceof Error?error.message:'The flowchart contains an invalid expression.',line?lineNodes[line]:undefined);}
}
