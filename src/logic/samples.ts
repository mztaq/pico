import {makeDocument,makeNode,type CircuitDocument,type CircuitNode} from './model';
export type SampleName='and'|'half'|'full'|'dff';
const connect=(doc:CircuitDocument,a:CircuitNode,out:string,b:CircuitNode,input:string)=>doc.wires.push({id:crypto.randomUUID(),from:a.id,fromPin:out,to:b.id,toPin:input});
const add=(doc:CircuitDocument,kind:CircuitNode['kind'],x:number,y:number,label='')=>{const n=makeNode(kind,x,y,label);doc.nodes.push(n);return n;};
export const SAMPLES:{id:SampleName;title:string;description:string}[]=[
  {id:'and',title:'AND gate',description:'Both switches must be 1 to turn on the lamp.'},
  {id:'half',title:'Half adder',description:'XOR produces Sum. AND produces Carry.'},
  {id:'full',title:'Full adder',description:'Adds A, B and Carry In. Two XOR gates calculate Sum; AND/OR gates calculate Carry Out.'},
  {id:'dff',title:'D flip-flop',description:'Change D, then step the clock to capture D on the rising edge.'},
];
export function loadSample(sample:SampleName):CircuitDocument {
  const d=makeDocument(SAMPLES.find(s=>s.id===sample)?.title??'Circuit sample');
  const a=add(d,'switch',80,115,'A'),b=add(d,'switch',80,270,'B');
  if(sample==='and') {
    const and=add(d,'and',330,192),lamp=add(d,'lamp',585,192,'Output');
    connect(d,a,'Q',and,'A');connect(d,b,'Q',and,'B');connect(d,and,'Q',lamp,'IN');
  }
  if(sample==='half'||sample==='full') {
    const xor1=add(d,'xor',310,115),and1=add(d,'and',310,310);
    connect(d,a,'Q',xor1,'A');connect(d,b,'Q',xor1,'B');connect(d,a,'Q',and1,'A');connect(d,b,'Q',and1,'B');
    if(sample==='half') {
      const sum=add(d,'lamp',565,115,'Sum'),carry=add(d,'lamp',565,310,'Carry');
      connect(d,xor1,'Q',sum,'IN');connect(d,and1,'Q',carry,'IN');
    }else {
      const cin=add(d,'switch',80,445,'Carry In'),xor2=add(d,'xor',540,115),and2=add(d,'and',540,310),or=add(d,'or',755,310),sum=add(d,'lamp',755,115,'Sum'),carry=add(d,'lamp',975,310,'Carry Out');
      connect(d,xor1,'Q',xor2,'A');connect(d,cin,'Q',xor2,'B');connect(d,xor2,'Q',sum,'IN');
      connect(d,xor1,'Q',and2,'A');connect(d,cin,'Q',and2,'B');connect(d,and1,'Q',or,'A');connect(d,and2,'Q',or,'B');connect(d,or,'Q',carry,'IN');
    }
  }
  if(sample==='dff') {
    d.nodes=[];d.wires=[];
    const data=add(d,'switch',80,130,'D'),clk=add(d,'clock',80,310,'Clock'),ff=add(d,'dff',340,225,'D flip-flop'),out=add(d,'lamp',610,225,'Q');
    connect(d,data,'Q',ff,'D');connect(d,clk,'Q',ff,'CLK');connect(d,ff,'Q',out,'IN');
  }
  return d;
}
