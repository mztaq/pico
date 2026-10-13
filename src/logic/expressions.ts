import {SPECS,type CircuitDocument,type ComponentKind} from './model';

type Expr={type:'var';name:string;id:string}|{type:'const';bit:0|1}|{type:'op';op:'NOT'|'AND'|'OR'|'XOR';args:Expr[]};
export interface ExpressionView {output:string;word:string;algebraic:string;programming:string;minimalSOP?:string;minimalPOS?:string;variables:string[]}
const binary=(kind:ComponentKind)=>kind==='and'||kind==='nand'?'AND':kind==='or'||kind==='nor'?'OR':'XOR';
const group=(items:Expr[],operator:'AND'|'OR'|'XOR'):Expr=>({type:'op',op:operator,args:items});
const not=(arg:Expr):Expr=>({type:'op',op:'NOT',args:[arg]});
function format(e:Expr,style:'word'|'algebraic'|'programming'):string{
 if(e.type==='var')return e.name;
 if(e.type==='const')return String(e.bit);
 const [a,b]=e.args;
 if(e.op==='NOT')return style==='word'?'NOT ('+format(a!,style)+')':style==='algebraic'?'¬('+format(a!,style)+')':'!('+format(a!,style)+')';
 const op=style==='word'?' '+e.op+' ':style==='algebraic'?{AND:' · ',OR:' + ',XOR:' ⊕ '}[e.op]:{AND:' && ',OR:' || ',XOR:' ^ '}[e.op];
 return '('+format(a!,style)+op+format(b!,style)+')';
}
function evaluate(e:Expr,state:Record<string,0|1>):0|1{
 if(e.type==='var')return state[e.id]??0;
 if(e.type==='const')return e.bit;
 if(e.op==='NOT')return evaluate(e.args[0]!,state)?0:1;
 const a=evaluate(e.args[0]!,state),b=evaluate(e.args[1]!,state);
 return (e.op==='AND'?(a&b):e.op==='OR'?(a|b):(a^b)) as 0|1;
}
interface Cube{bits:string;covers:Set<number>}
function minimize(bits:number[],variables:string[],pos=false):string{
 const n=variables.length, target=pos?0:1;
 const minterms=bits.map((b,i)=>b===target?i:-1).filter(i=>i>=0);
 if(!minterms.length)return pos?'1':'0';
 if(minterms.length===bits.length)return pos?'0':'1';
 let levels:Cube[]=minterms.map(i=>({bits:i.toString(2).padStart(n,'0'),covers:new Set([i])})),primes:Cube[]=[];
 while(levels.length){
  const merged=new Set<number>(),next=new Map<string,Cube>();
  for(let i=0;i<levels.length;i++)for(let j=i+1;j<levels.length;j++){
   const a=levels[i]!.bits,b=levels[j]!.bits;
   const diffs=[...a].filter((ch,k)=>ch!==b[k]);
   if(diffs.length!==1||diffs[0]==='-'||a.split('').some((ch,k)=>(ch==='-')!==(b[k]==='-')))continue;
   merged.add(i);merged.add(j);
   const k=[...a].findIndex((ch,k)=>ch!==b[k]);
   const mergedBits=a.slice(0,k)+'-'+a.slice(k+1);
   const existing=next.get(mergedBits)??{bits:mergedBits,covers:new Set<number>()};
   for(const value of [...levels[i]!.covers,...levels[j]!.covers])existing.covers.add(value);
   next.set(mergedBits,existing);
  }
  levels.forEach((cube,i)=>{if(!merged.has(i)&&!primes.some(p=>p.bits===cube.bits))primes.push(cube);});
  levels=[...next.values()];
 }
 const remaining=new Set(minterms),selected:Cube[]=[];
 const covers=(cube:Cube,num:number)=>[...cube.bits].every((b,i)=>b==='-'||b===num.toString(2).padStart(n,'0')[i]);
 for(const num of minterms){
  const choices=primes.filter(p=>covers(p,num));
  if(choices.length===1&&!selected.includes(choices[0]!))selected.push(choices[0]!);
 }
 for(const p of selected)for(const num of minterms)if(covers(p,num))remaining.delete(num);
 while(remaining.size){
  const best=primes.filter(p=>!selected.includes(p)).sort((a,b)=>{
   const gain=(c:Cube)=>[...remaining].filter(v=>covers(c,v)).length;
   return gain(b)-gain(a)||(a.bits.match(/-/g)?.length??0)-(b.bits.match(/-/g)?.length??0);
  })[0];
  if(!best)break;
  selected.push(best);for(const num of [...remaining])if(covers(best,num))remaining.delete(num);
 }
 const terms=selected.map(c=>{
  const literals=[...c.bits].flatMap((bit,i)=>bit==='-'?[]:[pos?(bit==='1'?'NOT '+variables[i]:variables[i]):bit==='1'?variables[i]:'NOT '+variables[i]]);
  return '('+literals.join(pos?' OR ':' AND ')+')';
 });
 return terms.join(pos?' AND ':' OR ');
}
export function booleanExpressions(doc:CircuitDocument):ExpressionView[]{
 const switches=doc.nodes.filter(n=>n.kind==='switch');
 const used=new Set<string>();
 const names=new Map<string,string>();
 switches.forEach((n,i)=>{
   const fallback=i<26?String.fromCharCode(65+i):'I'+(i+1);
   let base=(n.label.trim()||fallback).toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,24);
   if(!/^[A-Z]/.test(base))base=fallback;
   let name=base,number=2;while(used.has(name))name=base+'_'+number++;
   names.set(n.id,name);used.add(name);
 });
 const visit=(nodeId:string,pin:string,stack:Set<string>):Expr=>{
  const id=nodeId+':'+pin;if(stack.has(id))throw Error('Feedback loop: Boolean expressions require a combinational circuit.');
  const node=doc.nodes.find(n=>n.id===nodeId);if(!node)throw Error('Missing circuit component.');
  const next=new Set(stack);next.add(id);
  if(node.kind==='switch')return {type:'var',name:names.get(node.id)!,id:node.id};
  if(node.kind==='high'||node.kind==='pullup')return {type:'const',bit:1};
  if(node.kind==='low'||node.kind==='pulldown')return {type:'const',bit:0};
  if(['clock','button','tri','sr','dff','jkff','tff'].includes(node.kind))throw Error('Only static Boolean gates and switches are supported. Remove clocked or tri-state components from this output.');
  const read=(input:string):Expr=>{
   const wires=doc.wires.filter(w=>w.to===node.id&&w.toPin===input);
   if(!wires.length){if(doc.strict)throw Error('Unconnected '+input+' input on '+(node.label||SPECS[node.kind].title)+'.');return {type:'const',bit:doc.looseDefault};}
   if(wires.length!==1)throw Error('Multiple drivers on '+input+'. Resolve the wiring before generating expressions.');
   return visit(wires[0]!.from,wires[0]!.fromPin,next);
  };
  if(node.kind==='not')return not(read('A'));
  if(node.kind==='buffer')return read('A');
  if(['and','nand','or','nor','xor','xnor'].includes(node.kind)){
   const expr=group([read('A'),read('B')],binary(node.kind));
   return ['nand','nor','xnor'].includes(node.kind)?not(expr):expr;
  }
  throw Error('This output is not a Boolean gate.');
 };
 const views:ExpressionView[]=[];
 for(const output of doc.nodes.filter(n=>n.kind==='lamp'||n.kind==='hex')){
   for(const pin of SPECS[output.kind].inputs){
    const connections=doc.wires.filter(w=>w.to===output.id&&w.toPin===pin);
    if(!connections.length)continue;
    if(connections.length!==1){views.push({output:output.label||SPECS[output.kind].title,word:'Multiple drivers',algebraic:'',programming:'',variables:[]});continue;}
    const e=visit(connections[0]!.from,connections[0]!.fromPin,new Set());
    const outputName=(output.label||SPECS[output.kind].title)+(output.kind==='hex'?' '+pin:'');
    const related=switches.filter(n=>{function find(e:Expr):boolean{return e.type==='var'?e.id===n.id:e.type==='const'?false:e.args.some(find);}return find(e);});
    const variables=related.map(n=>names.get(n.id)!);
    const view:ExpressionView={output:outputName,word:format(e,'word'),algebraic:format(e,'algebraic'),programming:format(e,'programming'),variables};
    if(related.length<=6){
      const values:number[]=[];
      for(let i=0;i<2**related.length;i++){
       const valuesById=Object.fromEntries(related.map((n,k)=>[n.id,((i>>(related.length-k-1))&1) as 0|1]));
       values.push(evaluate(e,valuesById));
      }
      view.minimalSOP=minimize(values,variables);
      view.minimalPOS=minimize(values,variables,true);
    }
    views.push(view);
   }
 }
 return views;
}
