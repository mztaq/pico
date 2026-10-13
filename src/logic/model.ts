export type Signal = 0 | 1 | 'X' | 'Z';
export type ComponentKind = 'switch'|'button'|'clock'|'high'|'low'|'pullup'|'pulldown'|'lamp'|'hex'|'buffer'|'not'|'and'|'nand'|'or'|'nor'|'xor'|'xnor'|'tri'|'sr'|'dff'|'jkff'|'tff'|'label';
export type GroupName = 'Inputs'|'Outputs'|'Logic gates'|'Sequential'|'Other';
export interface ComponentSpec { title:string; group:GroupName; inputs:readonly string[]; outputs:readonly string[]; description:string }
export const SPECS:Record<ComponentKind,ComponentSpec> = {
  switch:{title:'Toggle switch',group:'Inputs',inputs:[],outputs:['Q'],description:'Click during simulation to switch between 0 and 1.'},
  button:{title:'Push button',group:'Inputs',inputs:[],outputs:['Q'],description:'Outputs 1 only while held down.'},
  clock:{title:'Clock',group:'Inputs',inputs:[],outputs:['Q'],description:'Periodic clock signal while running, or with Step.'},
  high:{title:'Constant 1',group:'Inputs',inputs:[],outputs:['Q'],description:'Always outputs logic 1.'},
  low:{title:'Constant 0',group:'Inputs',inputs:[],outputs:['Q'],description:'Always outputs logic 0.'},
  pullup:{title:'Pull-up',group:'Other',inputs:[],outputs:['Q'],description:'Weak logic high, modeled as 1 with single-driver inputs.'},
  pulldown:{title:'Pull-down',group:'Other',inputs:[],outputs:['Q'],description:'Weak logic low, modeled as 0 with single-driver inputs.'},
  lamp:{title:'Lamp',group:'Outputs',inputs:['IN'],outputs:[],description:'Lights up when the input is 1.'},
  hex:{title:'Hex display',group:'Outputs',inputs:['B3','B2','B1','B0'],outputs:[],description:'Displays four incoming bits as a hexadecimal digit.'},
  buffer:{title:'Buffer',group:'Logic gates',inputs:['A'],outputs:['Q'],description:'Copies its input.'},
  not:{title:'NOT',group:'Logic gates',inputs:['A'],outputs:['Q'],description:'Inverts its input.'},
  and:{title:'AND',group:'Logic gates',inputs:['A','B'],outputs:['Q'],description:'High if every input is high.'},
  nand:{title:'NAND',group:'Logic gates',inputs:['A','B'],outputs:['Q'],description:'Inverted AND.'},
  or:{title:'OR',group:'Logic gates',inputs:['A','B'],outputs:['Q'],description:'High if any input is high.'},
  nor:{title:'NOR',group:'Logic gates',inputs:['A','B'],outputs:['Q'],description:'Inverted OR.'},
  xor:{title:'XOR',group:'Logic gates',inputs:['A','B'],outputs:['Q'],description:'High for an odd number of high inputs.'},
  xnor:{title:'XNOR',group:'Logic gates',inputs:['A','B'],outputs:['Q'],description:'Inverted XOR.'},
  tri:{title:'Tri-state buffer',group:'Logic gates',inputs:['A','EN'],outputs:['Q'],description:'Outputs Z when enable is 0.'},
  sr:{title:'SR flip-flop',group:'Sequential',inputs:['S','R','CLK'],outputs:['Q','!Q'],description:'Rising-edge SR flip-flop. S=R=1 is invalid.'},
  dff:{title:'D flip-flop',group:'Sequential',inputs:['D','CLK'],outputs:['Q','!Q'],description:'Samples D on a rising clock edge.'},
  jkff:{title:'JK flip-flop',group:'Sequential',inputs:['J','K','CLK'],outputs:['Q','!Q'],description:'Set, reset or toggle on a rising edge.'},
  tff:{title:'T flip-flop',group:'Sequential',inputs:['T','CLK'],outputs:['Q','!Q'],description:'Toggles on a rising clock edge when T is 1.'},
  label:{title:'Text label',group:'Other',inputs:[],outputs:[],description:'Annotate the circuit.'},
};
export const GROUPS:GroupName[]=['Inputs','Outputs','Logic gates','Sequential','Other'];
export const STATEFUL:ComponentKind[]=['sr','dff','jkff','tff'];
export interface CircuitNode {id:string; kind:ComponentKind; x:number; y:number; rotation:number; label:string; initial?:0|1; period?:number; duty?:number}
export interface CircuitWire {id:string; from:string; fromPin:string; to:string; toPin:string}
export interface CircuitDocument {version:1; title:string; nodes:CircuitNode[]; wires:CircuitWire[]; strict:boolean; looseDefault:0|1; grid:boolean; snap:boolean}
export const makeDocument=(title='Untitled circuit'):CircuitDocument=>({version:1,title,nodes:[],wires:[],strict:true,looseDefault:0,grid:true,snap:true});
export const makeNode=(kind:ComponentKind,x:number,y:number,label=''):CircuitNode=>({id:crypto.randomUUID(),kind,x,y,rotation:0,label,initial:0,period:1000,duty:50});
export const nodeHeight=(node:CircuitNode)=>Math.max(78,30+Math.max(SPECS[node.kind].inputs.length,SPECS[node.kind].outputs.length)*26);
export const NODE_WIDTH=122;
export function portPosition(node:CircuitNode,pin:string,direction:'in'|'out') {
  const pins=direction==='in'?SPECS[node.kind].inputs:SPECS[node.kind].outputs;
  const index=pins.indexOf(pin);
  const x=direction==='in'?node.x:node.x+NODE_WIDTH, y=node.y+(index+1)*nodeHeight(node)/(pins.length+1);
  const radians=node.rotation*Math.PI/180, cx=node.x+NODE_WIDTH/2,cy=node.y+nodeHeight(node)/2;
  const dx=x-cx,dy=y-cy;
  return {x:cx+dx*Math.cos(radians)-dy*Math.sin(radians),y:cy+dx*Math.sin(radians)+dy*Math.cos(radians)};
}
export function isWireValid(doc:CircuitDocument,wire:CircuitWire):string|null {
  const source=doc.nodes.find(n=>n.id===wire.from),target=doc.nodes.find(n=>n.id===wire.to);
  if(!source||!target)return 'Both endpoints must exist.';
  if(!SPECS[source.kind].outputs.includes(wire.fromPin))return 'Start the wire from an output pin.';
  if(!SPECS[target.kind].inputs.includes(wire.toPin))return 'Connect the wire to an input pin.';
  if(doc.wires.some(w=>w.from===wire.from&&w.fromPin===wire.fromPin&&w.to===wire.to&&w.toPin===wire.toPin))return 'Those pins are already connected.';
  if(wire.from===wire.to)return 'A component cannot wire directly to itself.';
  return null;
}
export function parseDocument(raw:unknown):CircuitDocument {
  if(!raw||typeof raw!=='object')throw Error('Expected a Pico circuit JSON object.');
  const d=raw as Record<string,unknown>;
  if(d.version!==1)throw Error('Unsupported circuit file version (expected version 1).');
  if(!Array.isArray(d.nodes)||!Array.isArray(d.wires)||d.nodes.length>600||d.wires.length>2400)throw Error('Invalid circuit size or missing nodes/wires.');
  const nodes:CircuitNode[]=d.nodes.map((item:unknown)=>{
    if(!item||typeof item!=='object')throw Error('Invalid component.');
    const n=item as Record<string,unknown>;
    if(typeof n.id!=='string'||n.id.length>100||!Object.hasOwn(SPECS,String(n.kind)))throw Error('Unknown component type or identifier.');
    if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x as number)>100000||Math.abs(n.y as number)>100000)throw Error('Invalid component position.');
    if(![0,90,180,270].includes(n.rotation as number))throw Error('Invalid component rotation.');
    if(typeof n.label!=='string'||n.label.length>120)throw Error('Invalid component label.');
    if(n.initial!==undefined&&n.initial!==0&&n.initial!==1)throw Error('Invalid initial switch state.');
    const period=n.period===undefined?1000:n.period;
    const duty=n.duty===undefined?50:n.duty;
    if(typeof period!=='number'||!Number.isFinite(period)||period<100||period>60000||typeof duty!=='number'||!Number.isFinite(duty)||duty<1||duty>99)throw Error('Clock period must be 100–60000 ms and duty 1–99%.');
    return {id:n.id,kind:n.kind as ComponentKind,x:n.x as number,y:n.y as number,rotation:n.rotation as number,label:n.label,initial:n.initial as 0|1|undefined,period,duty};
  });
  if(new Set(nodes.map(n=>n.id)).size!==nodes.length)throw Error('Duplicate component identifiers.');
  const wires:CircuitWire[]=[];
  for(const item of d.wires) {
    if(!item||typeof item!=='object')throw Error('Invalid wire.');
    const w=item as Record<string,unknown>;
    if([w.id,w.from,w.fromPin,w.to,w.toPin].some(v=>typeof v!=='string'||(v as string).length>100))throw Error('Invalid wire identifier.');
    const wire={id:w.id as string,from:w.from as string,fromPin:w.fromPin as string,to:w.to as string,toPin:w.toPin as string};
    const issue=isWireValid({...makeDocument(),nodes,wires},wire);
    if(issue)throw Error('Invalid wire: '+issue);
    wires.push(wire);
  }
  if(new Set(wires.map(w=>w.id)).size!==wires.length)throw Error('Duplicate wire identifiers.');
  if(typeof d.title!=='string'||d.title.length>120||typeof d.strict!=='boolean'||(d.looseDefault!==0&&d.looseDefault!==1))throw Error('Invalid circuit settings.');
  return {version:1,title:d.title,nodes,wires,strict:d.strict,looseDefault:d.looseDefault,grid:d.grid!==false,snap:d.snap!==false};
}
