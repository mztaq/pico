import { describe, expect, it } from 'vitest';
import { compileFlowchart, ChartError } from './compiler';
import { connectNodes, exampleProject, removeNode, type ChartNode, type FlowchartProject, type Port } from './model';
import { execute, RuntimeError } from '../runtime/interpreter';
import { createInteractiveSession } from '../runtime/worker';
import type { WorkerReply } from '../runtime/worker';

const run=(p:FlowchartProject,inputs:string[]=[])=>execute(compileFlowchart(p).ast,inputs);
function chart(nodes:Partial<ChartNode>[],connections:[string,string,Port?][]):FlowchartProject {
  return {id:'test',name:'Test chart',routines:'',nodes:nodes.map((n,i)=>({id:String(i),kind:'process',text:'',x:100,y:i*140,dataType:'INTEGER',...n})),edges:connections.map(([from,to,port='next'],i)=>({id:`edge${i}`,from,to,port}))};
}
describe('flowcharts to executable pseudocode',()=>{
  it('greets a typed name and emits ordinary sequential pseudocode',()=>{
    const p=exampleProject('greeting'),c=compileFlowchart(p);
    expect(c.mode).toBe('structured');expect(c.code).toContain('DECLARE Name : STRING');expect(c.code).not.toContain('PicoFlowStep');
    expect(run(p,['Mustaqim']).output).toEqual(['Enter your name','Hello Mustaqim!']);
  });
  it.each([[9,3,9],[3,9,9],[7,7,7]])('takes the correct largest-number branch for %s and %s',(a,b,max)=>{
    const p=exampleProject('largest');expect(compileFlowchart(p).code).toContain('IF Number1 > Number2 THEN');
    expect(run(p,[String(a),String(b)]).output).toEqual([`The largest number is ${max}`]);
  });
  it.each([[14,'Wear a coat'],[15,'No coat needed'],[20,'No coat needed']])('takes the correct temperature branch for %s',(n,out)=>expect(run(exampleProject('temperature'),[String(n)]).output).toEqual([out]));
  it('infers calculated variables and multiplies inputs',()=>{
    const p=exampleProject('multiply');expect(compileFlowchart(p).code).toContain('DECLARE Product : INTEGER');expect(run(p,['5','8']).output).toEqual(['40']);
  });
  it('converts a back edge into a readable WHILE loop',()=>{
    const p=exampleProject('counter'),c=compileFlowchart(p);
    expect(c.mode).toBe('structured');expect(c.code).toContain('WHILE Count <= 5 DO');expect(run(p).output).toEqual(['1','2','3','4','5']);
    expect(Object.values(c.lineNodes)).toContain('increment');
  });
  it('handles a loop on the No branch with a negated condition',()=>{
    let p=exampleProject('counter');p={...p,nodes:p.nodes.map(n=>n.id==='loop'?{...n,text:'Count > 5'}:n),edges:p.edges.map(e=>e.from==='loop'?{...e,port:e.port==='yes'?'no':'yes'}:e)};
    expect(compileFlowchart(p).code).toContain('WHILE NOT (Count > 5) DO');expect(run(p).output).toEqual(['1','2','3','4','5']);
  });
  it('keeps early End branches from executing the other branch',()=>{
    const p=chart([{id:'s',kind:'start'},{id:'input',kind:'input',text:'N'},{id:'d',kind:'decision',text:'N > 0'},{id:'a',kind:'output',text:'"Positive"'},{id:'b',kind:'output',text:'"Other"'},{id:'ea',kind:'end'},{id:'eb',kind:'end'}],[['s','input'],['input','d'],['d','a','yes'],['d','b','no'],['a','ea'],['b','eb']]);
    expect(run(p,['1']).output).toEqual(['Positive']);expect(run(p,['0']).output).toEqual(['Other']);
  });
  it('preserves a repeat-until graph with exact connection-based conversion',()=>{
    const p=chart([{id:'s',kind:'start'},{id:'init',text:'Count ← 0'},{id:'inc',text:'Count ← Count + 1'},{id:'d',kind:'decision',text:'Count >= 3'},{id:'out',kind:'output',text:'Count'},{id:'e',kind:'end'}],[['s','init'],['init','inc'],['inc','d'],['d','out','yes'],['d','inc','no'],['out','e']]);
    expect(compileFlowchart(p).mode).toBe('connections');expect(run(p).output).toEqual(['3']);
  });
  it('avoids collisions with its generated control variable',()=>{
    const p=chart([{id:'s',kind:'start'},{id:'init',text:'PicoFlowStep ← 0'},{id:'inc',text:'PicoFlowStep ← PicoFlowStep + 1'},{id:'d',kind:'decision',text:'PicoFlowStep >= 3'},{id:'out',kind:'output',text:'PicoFlowStep'},{id:'e',kind:'end'}],[['s','init'],['init','inc'],['inc','d'],['d','out','yes'],['d','inc','no'],['out','e']]);
    expect(compileFlowchart(p).code).toContain('PicoFlowStepX');expect(run(p).output).toEqual(['3']);
  });
  it('supports predefined procedures, arrays, and file instructions through the same engine',()=>{
    const p=chart([{id:'s',kind:'start'},{id:'arr',kind:'declare',text:'Scores : ARRAY[1:2] OF INTEGER'},{id:'set',text:'Scores[1] ← 42'},{id:'call',kind:'call',text:'Show()'},{id:'e',kind:'end'}],[['s','arr'],['arr','set'],['set','call'],['call','e']]);
    p.routines='PROCEDURE Show()\n  OUTPUT Scores[1]\nENDPROCEDURE';expect(run(p).output).toEqual(['42']);
  });
  it('blocks missing branches and selects the incomplete block',()=>{
    const p=exampleProject('largest');p.edges=p.edges.filter(e=>e.from!=='compare'||e.port!=='no');
    try{compileFlowchart(p);throw Error('Expected validation failure');}catch(e){expect(e).toBeInstanceOf(ChartError);expect((e as ChartError).nodeId).toBe('compare');}
  });
  it('rejects disconnected blocks, duplicate starts, and malformed instructions',()=>{
    let p=exampleProject('greeting');p.nodes.push({...p.nodes[0],id:'orphan',kind:'output',text:'"Unused"'});expect(()=>compileFlowchart(p)).toThrow(/Connect this block/);
    p=exampleProject();p.nodes.push({...p.nodes[0],id:'another'});expect(()=>compileFlowchart(p)).toThrow(/exactly one Start/);
    p=exampleProject();p.nodes.find(n=>n.id==='hello')!.text='"hello"\nINPUT Password';expect(()=>compileFlowchart(p)).toThrow(/one expression/);
  });
  it('rejects invalid expressions and conflicting input types',()=>{
    const p=exampleProject('largest');p.nodes.find(n=>n.id==='second')!.text='Number1';p.nodes.find(n=>n.id==='second')!.dataType='STRING';expect(()=>compileFlowchart(p)).toThrow(/Conflicting declarations/);
    const other=exampleProject('temperature');other.nodes.find(n=>n.id==='decision')!.text='Temperature >';expect(()=>compileFlowchart(other)).toThrow();
  });
  it('terminates on invalid typed input and maps the error to its block',()=>{
    const p=exampleProject('multiply'),compiled=compileFlowchart(p);const replies:WorkerReply[]=[];
    const session=createInteractiveSession({ast:compiled.ast,interactive:true,runs:[{inputs:[],options:{}}]},reply=>replies.push(reply));session.start();
    const input=replies.find(r=>!Array.isArray(r)&&r.type==='input');if(!input||Array.isArray(input)||input.type!=='input')throw Error('No input request');
    session.input({type:'input',id:input.request.id,value:'wrong'});
    const last=replies.at(-1);if(!last||Array.isArray(last)||last.type!=='complete')throw Error('Program did not terminate');
    expect(last.replies[0].error?.message).toMatch(/INTEGER/);expect(compiled.lineNodes[last.replies[0].error!.line!]).toBe('first');
    expect(replies.filter(r=>!Array.isArray(r)&&r.type==='input')).toHaveLength(1);
  });
  it('enforces REAL input spelling with the existing runtime',()=>{
    const p=exampleProject('multiply');p.nodes.filter(n=>n.kind==='input').forEach(n=>{n.dataType='REAL';});
    expect(()=>run(p,['5','2.0'])).toThrow(RuntimeError);expect(run(p,['5.0','2.0']).output).toEqual(['10']);
  });
  it('replaces a port connection and removes attached arrows when deleting a block',()=>{
    const p=exampleProject();const connected=connectNodes(p,'prompt','next','hello');expect(connected.edges.filter(e=>e.from==='prompt')).toHaveLength(1);expect(connected.edges.find(e=>e.from==='prompt')?.to).toBe('hello');
    expect(removeNode(p,'input').edges.some(e=>e.to==='input'||e.from==='input')).toBe(false);
  });
});
it('preserves the connection path across varied branch joins and loop backs',()=>{
  let seed=7381;const random=(limit:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%limit;};
  for(let test=0;test<100;test++) {
    const nodes:Partial<ChartNode>[]=[{id:'s',kind:'start'},{id:'init',text:'Count ← 0'}];
    const edges:[string,string,Port?][]=[['s','init'],['init','n0']];
    for(let i=0;i<8;i++) {
      const next=i===7?'e':`n${i+1}`;
      if(i%3===0) {nodes.push({id:`n${i}`,kind:'decision',text:'Count < 4'});edges.push([`n${i}`,`n${random(8)}`,'yes'],[`n${i}`,next,'no']);}
      else if(i%3===1){nodes.push({id:`n${i}`,kind:'process',text:'Count ← Count + 1'});edges.push([`n${i}`,next]);}
      else {nodes.push({id:`n${i}`,kind:'output',text:`"${i}"`});edges.push([`n${i}`,next]);}
    }
    nodes.push({id:'e',kind:'end'});
    const p=chart(nodes,edges),reachable=new Set<string>();
    function visit(id:string){if(reachable.has(id))return;reachable.add(id);edges.filter(e=>e[0]===id).forEach(e=>visit(e[1]));}visit('s');
    p.nodes=p.nodes.filter(n=>reachable.has(n.id));p.edges=p.edges.filter(e=>reachable.has(e.from));
    let current='s',count=0,steps=0;const expected:string[]=[];
    while(current!=='e'&&steps++<100) {const node=p.nodes.find(n=>n.id===current)!;if(node.kind==='process'&&node.id!=='init')count++;if(node.kind==='output')expected.push(node.text.slice(1,-1));const port=node.kind==='decision'?(count<4?'yes':'no'):'next';current=p.edges.find(e=>e.from===current&&e.port===port)!.to;}
    if(current==='e'){const result=run(p);expect(result.output,`graph ${test}`).toEqual(expected);expect(result.variables.Count,`graph ${test}`).toBe(count);}
    else {expect(()=>execute(compileFlowchart(p).ast,[],{limit:500}),`graph ${test}`).toThrow(RuntimeError);}
  }
});
