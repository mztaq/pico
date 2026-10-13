import {SPECS,STATEFUL,type CircuitDocument,type CircuitNode,type ComponentKind,type Signal} from './model';
export interface SimulationState { time:number; inputs:Record<string,0|1>; q:Record<string,Signal>; previousClocks:Record<string,Signal> }
export interface SimulationResult { state:SimulationState; signals:Record<string,Signal>; warning:string }
export const initialSimulation=():SimulationState=>({time:0,inputs:{},q:{},previousClocks:{}});
export const key=(id:string,pin:string)=>id+':'+pin;
export const invert=(a:Signal):Signal=>a===0?1:a===1?0:'X';
export function gate(kind:ComponentKind,inputs:Signal[]):Signal {
  const binary=inputs.map(s=>s==='Z'?'X':s);
  if(kind==='buffer')return binary[0]??'X';
  if(kind==='not')return invert(binary[0]??'X');
  if(kind==='tri')return binary[1]===0?'Z':binary[1]===1?(binary[0]??'X'):'X';
  if(kind==='and'||kind==='nand') {const value:Signal=binary.includes(0)?0:binary.every(s=>s===1)?1:'X';return kind==='nand'?invert(value):value;}
  if(kind==='or'||kind==='nor') {const value:Signal=binary.includes(1)?1:binary.every(s=>s===0)?0:'X';return kind==='nor'?invert(value):value;}
  if(kind==='xor'||kind==='xnor') {const value:Signal=binary.some(s=>s!=='0'&&s!==0&&s!==1)?'X':(binary.reduce<number>((sum,s)=>sum+(s===1?1:0),0)%2) as 0|1;return kind==='xnor'?invert(value):value;}
  return 'X';
}
export function resolveDrivers(drivers:Signal[]):Signal {
  const relevant=drivers.filter(s=>s!=='Z');
  if(!relevant.length)return 'Z';
  if(relevant.includes('X')||(relevant.includes(0)&&relevant.includes(1)))return 'X';
  return relevant[0]!;
}
export function clockOutput(node:CircuitNode,time:number):Signal {
  const period=node.period??1000,duty=node.duty??50;
  return time%period>=period*(1-duty/100)?1:0;
}
function propagate(doc:CircuitDocument,state:SimulationState) {
  let signals:Record<string,Signal>={};
  for(const n of doc.nodes)for(const p of [...SPECS[n.kind].inputs,...SPECS[n.kind].outputs])signals[key(n.id,p)]='Z';
  let warning='';
  for(let iteration=0;iteration<Math.min(80,doc.nodes.length*2+8);iteration++) {
    const next={...signals};
    for(const node of doc.nodes) {
      const spec=SPECS[node.kind];
      const input:Signal[]=spec.inputs.map(pin=>{
        const wires=doc.wires.filter(w=>w.to===node.id&&w.toPin===pin);
        const result=resolveDrivers(wires.map(w=>signals[key(w.from,w.fromPin)]??'Z'));
        const value:Signal=result==='Z'?(doc.strict?'X':doc.looseDefault):result;
        next[key(node.id,pin)]=value;
        return value;
      });
      let outputs:Signal[]=[];
      switch(node.kind) {
        case 'switch':case 'button':outputs=[state.inputs[node.id]??node.initial??0];break;
        case 'clock':outputs=[clockOutput(node,state.time)];break;
        case 'high':case 'pullup':outputs=[1];break;
        case 'low':case 'pulldown':outputs=[0];break;
        case 'sr':case 'dff':case 'jkff':case 'tff':{
          const q=state.q[node.id]??0;outputs=[q,invert(q)];break;
        }
        case 'lamp':case 'hex':case 'label':outputs=[];break;
        default:outputs=[gate(node.kind,input)];
      }
      spec.outputs.forEach((pin,i)=>{next[key(node.id,pin)]=outputs[i]??'X';});
    }
    if(Object.keys(next).every(k=>next[k]===signals[k]))return {signals:next,warning};
    signals=next;
  }
  warning='Circuit did not settle. Check for combinational feedback loops.';
  return {signals:Object.fromEntries(Object.keys(signals).map(k=>[k,'X' as const])),warning};
}
export function evaluateCircuit(doc:CircuitDocument,current:SimulationState):SimulationResult {
  const state:SimulationState={time:current.time,inputs:{...current.inputs},q:{...current.q},previousClocks:{...current.previousClocks}};
  let settled=propagate(doc,state);
  let changed=false;
  for(const node of doc.nodes) {
    if(!STATEFUL.includes(node.kind))continue;
    const clk=settled.signals[key(node.id,'CLK')]??'X';
    const prev=state.previousClocks[node.id]??0;
    if(prev===0&&clk===1) {
      const bit=(p:string)=>settled.signals[key(node.id,p)]??'X';
      const old=state.q[node.id]??0;
      let next:Signal=old;
      if(node.kind==='dff')next=bit('D');
      if(node.kind==='tff')next=bit('T')===0?old:bit('T')===1?invert(old):'X';
      if(node.kind==='sr') {
        const s=bit('S'),r=bit('R');
        next=s===1&&r===1?'X':s===1&&r===0?1:s===0&&r===1?0:s===0&&r===0?old:'X';
      }
      if(node.kind==='jkff') {
        const j=bit('J'),k=bit('K');
        next=j===1&&k===1?invert(old):j===1&&k===0?1:j===0&&k===1?0:j===0&&k===0?old:'X';
      }
      state.q[node.id]=next;changed=true;
    }
    state.previousClocks[node.id]=clk;
  }
  if(changed)settled=propagate(doc,state);
  if(Object.values(settled.signals).includes('X')&&!settled.warning&&doc.strict)settled.warning='Unknown input (X). Connect floating pins or choose loose input mode.';
  if(doc.wires.some(w=>settled.signals[key(w.to,w.toPin)]==='X')&&!settled.warning)settled.warning='Conflicting drivers or unknown input detected.';
  return {...settled,state};
}
export function advanceSimulation(doc:CircuitDocument,state:SimulationState,ms:number):SimulationResult {
  return evaluateCircuit(doc,{...state,time:Math.max(0,state.time+ms)});
}
export function stepSimulation(doc:CircuitDocument,state:SimulationState):SimulationResult {
  const clocks=doc.nodes.filter(n=>n.kind==='clock');
  if(!clocks.length)return evaluateCircuit(doc,state);
  const delays=clocks.map(n=>{
    const period=n.period??1000;
    const phase=state.time%period;
    const rise=period*(1-(n.duty??50)/100);
    return phase<rise?rise-phase:period-phase;
  });
  return advanceSimulation(doc,state,Math.max(1,Math.min(...delays)));
}
export function generateTruthTable(doc:CircuitDocument) {
  if(doc.nodes.some(n=>STATEFUL.includes(n.kind)||n.kind==='clock'||n.kind==='button'))throw Error('Static truth tables are not available for clocks, push buttons, or sequential components.');
  const inputs=doc.nodes.filter(n=>n.kind==='switch');
  if(inputs.length>8)throw Error('Truth tables are limited to eight toggle inputs (256 rows).');
  const outputs=doc.nodes.filter(n=>n.kind==='lamp'||n.kind==='hex');
  if(!outputs.length)throw Error('Add a lamp or hex display to generate a truth table.');
  const names=[...inputs.map((n,i)=>n.label||'Input '+(i+1)),...outputs.flatMap((n,i)=>n.kind==='hex'?['Display '+(i+1)]:[n.label||'Output '+(i+1)])];
  const rows:string[][]=[];
  for(let i=0;i<2**inputs.length;i++) {
    const bits=inputs.map((_,j)=>((i>>(inputs.length-j-1))&1) as 0|1);
    const state={...initialSimulation(),inputs:Object.fromEntries(inputs.map((n,j)=>[n.id,bits[j]]))};
    const {signals}=evaluateCircuit(doc,state);
    const values=outputs.map(n=>n.kind==='lamp'?String(signals[key(n.id,'IN')]??'X'):(()=>{
      const bits=['B3','B2','B1','B0'].map(p=>signals[key(n.id,p)]??'X');
      return bits.some(bit=>bit!==0&&bit!==1)?'X':Number.parseInt(bits.join(''),2).toString(16).toUpperCase();
    })());
    rows.push([...bits.map(String),...values]);
  }
  return {headers:names,rows};
}
export function truthTableCSV(table:{headers:string[];rows:string[][]}) {
  const cell=(value:string)=>'"'+value.replace(/"/g,'""')+'"';
  return [table.headers,...table.rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
