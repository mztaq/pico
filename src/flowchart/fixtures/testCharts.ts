import type { ChartNode, ChartEdge, FlowchartProject, Port, NodeKind } from '../model';
import type { DataType } from '../../language/ast';
export type ExampleKey = 'greeting' | 'largest' | 'temperature' | 'multiply' | 'counter' | 'blank';
export const EXAMPLES: {key:ExampleKey;name:string}[]=[
  {key:'greeting',name:'Ask a name'}, {key:'largest',name:'Largest of two numbers'},
  {key:'temperature',name:'Wear a coat?'}, {key:'multiply',name:'Multiply two numbers'},
  {key:'counter',name:'Count to five'}, {key:'blank',name:'Blank flowchart'},
];
export function exampleProject(key: ExampleKey='greeting'): FlowchartProject {
  const nodes: ChartNode[]=[], edges: ChartEdge[]=[];
  function add(id:string,kind:NodeKind,text:string,x:number,y:number,dataType:DataType='INTEGER') {nodes.push({id,kind,text,x,y,dataType});}
  function edge(from:string,to:string,port:Port='next') {edges.push({id:crypto.randomUUID(),from,to,port});}
  add('start','start','Start',360,44);
  if(key==='greeting') {
    add('prompt','output','"Enter your name"',360,190); add('input','input','Name',360,336,'STRING');
    add('hello','output','"Hello ", Name, "!"',360,482); add('end','end','End',360,628);
    edge('start','prompt');edge('prompt','input');edge('input','hello');edge('hello','end');
  } else if(key==='largest') {
    add('first','input','Number1',360,190);add('second','input','Number2',360,336);
    add('compare','decision','Number1 > Number2',360,482);
    add('larger1','output','"The largest number is ", Number1',120,670);add('larger2','output','"The largest number is ", Number2',620,670);
    add('end','end','End',360,858);
    edge('start','first');edge('first','second');edge('second','compare');edge('compare','larger1','yes');edge('compare','larger2','no');edge('larger1','end');edge('larger2','end');
  } else if(key==='temperature') {
    add('input','input','Temperature',360,190);add('decision','decision','Temperature < 15',360,336);
    add('coat','output','"Wear a coat"',120,524);add('no-coat','output','"No coat needed"',620,524);add('end','end','End',360,712);
    edge('start','input');edge('input','decision');edge('decision','coat','yes');edge('decision','no-coat','no');edge('coat','end');edge('no-coat','end');
  } else if(key==='multiply') {
    add('first','input','Number1',360,190);add('second','input','Number2',360,336);add('multiply','process','Product ← Number1 * Number2',360,482);add('output','output','Product',360,628);add('end','end','End',360,774);
    edge('start','first');edge('first','second');edge('second','multiply');edge('multiply','output');edge('output','end');
  } else if(key==='counter') {
    add('init','process','Count ← 1',360,190);add('loop','decision','Count <= 5',360,336);add('print','output','Count',80,524);add('increment','process','Count ← Count + 1',80,670);add('end','end','End',660,524);
    edge('start','init');edge('init','loop');edge('loop','print','yes');edge('loop','end','no');edge('print','increment');edge('increment','loop');
  } else {add('end','end','End',360,336);edge('start','end');}
  return {id:crypto.randomUUID(),name:EXAMPLES.find(e=>e.key===key)!.name,nodes,edges,routines:''};
}
