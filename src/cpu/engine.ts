import {type AssemblyImage,binary4,binary8,decode,type Mnemonic} from './assembler';
export type Phase='ready'|'fetch'|'decode'|'execute'|'interrupt'|'halted'|'error';
export type Register='PC'|'MAR'|'MDR'|'CIR'|'ACC'|'ALU'|'CU'|'RAM';
export type Bus='address'|'data'|'control'|'internal';
export interface Transfer{from:Register;to:Register;bus:Bus;value:string}
export interface Frame{phase:Phase;description:string;transfer?:Transfer;active:Register[];signal?:'READ'|'WRITE'|'HALT';address?:number;instruction?:Mnemonic}
export interface Machine{pc:number;mar:number;mdr:number;cir:number;acc:number;alu:number;memory:number[];kind:('instruction'|'data'|'empty')[];initial:AssemblyImage;micro:number;halted:boolean;error:string|null;cycles:number;instructions:number;frame:Frame}
const ready:Frame={phase:'ready',description:'Press Run to start the CPU, or Step to follow the fetch–decode–execute cycle.',active:['PC']};
export function boot(image:AssemblyImage):Machine{return {pc:image.entry,mar:0,mdr:0,cir:0,acc:0,alu:0,memory:image.memory.map(c=>c.value),kind:image.memory.map(c=>c.kind),initial:image,micro:0,halted:false,error:null,cycles:0,instructions:0,frame:ready};}
function flow(m:Machine,delta:Partial<Machine>,phase:Phase,description:string,active:Register[],transfer?:Transfer,signal?:Frame['signal']):Machine{
 return {...m,...delta,cycles:m.cycles+1,frame:{phase,description,active,transfer,signal,address:delta.mar??m.mar}};
}
export function step(m:Machine):Machine{
 if(m.halted||m.error)return m;
 const move=(delta:Partial<Machine>,phase:Phase,description:string,active:Register[],transfer?:Transfer,signal?:Frame['signal'])=>flow(m,delta,phase,description,active,transfer,signal);
 const frame=(phase:Phase,description:string,active:Register[],transfer?:Transfer,signal?:Frame['signal'])=>move({micro:m.micro+1},phase,description,active,transfer,signal);
 try{
  if(m.micro===0){if(m.pc<0||m.pc>15)throw Error('PC is outside RAM.');return frame('fetch','PC identifies the next instruction at '+binary4(m.pc)+'.',['PC']);}
  if(m.micro===1)return move({mar:m.pc,micro:2},'fetch','Copy PC into MAR.',['PC','MAR'],{from:'PC',to:'MAR',bus:'internal',value:binary4(m.pc)});
  if(m.micro===2)return frame('fetch','Send MAR along the address bus to RAM.',['MAR','RAM'],{from:'MAR',to:'RAM',bus:'address',value:binary4(m.mar)});
  if(m.micro===3)return frame('fetch','The control unit sends READ on the control bus.',['CU','RAM'],{from:'CU',to:'RAM',bus:'control',value:'READ'},'READ');
  if(m.micro===4){if(m.kind[m.mar]==='empty')throw Error('Cannot fetch an instruction from empty RAM '+binary4(m.mar)+'.');return move({mdr:m.memory[m.mar]!,micro:5},'fetch','RAM sends the instruction '+binary8(m.memory[m.mar]!)+' along the data bus to MDR.',['RAM','MDR'],{from:'RAM',to:'MDR',bus:'data',value:binary8(m.memory[m.mar]!)});}
  if(m.micro===5)return move({cir:m.mdr,micro:6},'fetch','Copy MDR into CIR.',['MDR','CIR'],{from:'MDR',to:'CIR',bus:'internal',value:binary8(m.mdr)});
  if(m.micro===6)return move({pc:m.pc+1,micro:7},'fetch','Increment the program counter.',['PC']);
  if(m.micro===7){if(m.kind[m.mar]!=='instruction')throw Error('Attempted to execute a data value at '+binary4(m.mar)+'.');const d=decode(m.cir);return move({micro:8},'decode','Decode CIR: opcode '+binary4(m.cir>>4)+' is '+d.mnemonic+', operand '+binary4(d.operand)+'.',['CU','CIR']);}
  const {mnemonic,operand}=decode(m.cir);
  if(m.micro===8&&['LDA','ADD','SUB','STA'].includes(mnemonic))return move({mar:operand,micro:9},'execute','Copy operand address '+binary4(operand)+' into MAR.',['CIR','MAR'],{from:'CIR',to:'MAR',bus:'internal',value:binary4(operand)});
  if(m.micro===9&&['LDA','ADD','SUB','STA'].includes(mnemonic))return frame('execute','Send operand address along the address bus.',['MAR','RAM'],{from:'MAR',to:'RAM',bus:'address',value:binary4(m.mar)});
  if(m.micro===10&&['LDA','ADD','SUB'].includes(mnemonic))return frame('execute','CU sends READ to RAM.',['CU','RAM'],{from:'CU',to:'RAM',bus:'control',value:'READ'},'READ');
  if(m.micro===11&&['LDA','ADD','SUB'].includes(mnemonic)){if(m.kind[m.mar]==='empty')throw Error('Reading empty RAM cell '+binary4(m.mar)+'.');return move({mdr:m.memory[m.mar]!,micro:12},'execute','Read operand '+binary8(m.memory[m.mar]!)+' on data bus into MDR.',['RAM','MDR'],{from:'RAM',to:'MDR',bus:'data',value:binary8(m.memory[m.mar]!)});}
  if(m.micro===12&&mnemonic==='LDA')return move({acc:m.mdr,micro:0,instructions:m.instructions+1},'execute','Load MDR into ACC: '+binary8(m.mdr)+'.',['MDR','ACC'],{from:'MDR',to:'ACC',bus:'internal',value:binary8(m.mdr)});
  if(m.micro===12&&(mnemonic==='ADD'||mnemonic==='SUB')){const result=(mnemonic==='ADD'?m.acc+m.mdr:m.acc-m.mdr)&255;return move({alu:result,micro:13},'execute','The ALU '+(mnemonic==='ADD'?'adds':'subtracts')+' ACC and MDR: '+binary8(result)+'.',['ACC','MDR','ALU'],{from:'MDR',to:'ALU',bus:'internal',value:binary8(m.mdr)});}
  if(m.micro===13&&(mnemonic==='ADD'||mnemonic==='SUB'))return move({acc:m.alu,micro:0,instructions:m.instructions+1},'execute','Copy ALU result into ACC: '+binary8(m.alu)+'.',['ALU','ACC'],{from:'ALU',to:'ACC',bus:'internal',value:binary8(m.alu)});
  if(m.micro===10&&mnemonic==='STA')return move({mdr:m.acc,micro:11},'execute','Copy ACC into MDR for the store operation.',['ACC','MDR'],{from:'ACC',to:'MDR',bus:'internal',value:binary8(m.acc)});
  if(m.micro===11&&mnemonic==='STA')return frame('execute','CU signals WRITE on the control bus.',['CU','RAM'],{from:'CU',to:'RAM',bus:'control',value:'WRITE'},'WRITE');
  if(m.micro===12&&mnemonic==='STA'){const memory=[...m.memory],kind=[...m.kind];memory[m.mar]=m.mdr;kind[m.mar]='data';return move({memory,kind,micro:0,instructions:m.instructions+1},'execute','Store '+binary8(m.mdr)+' into RAM at '+binary4(m.mar)+'.',['MDR','RAM'],{from:'MDR',to:'RAM',bus:'data',value:binary8(m.mdr)});}
  if(m.micro===8&&mnemonic==='LDI')return move({acc:operand,micro:0,instructions:m.instructions+1},'execute','Load immediate '+binary8(operand)+' into ACC.',['CIR','ACC'],{from:'CIR',to:'ACC',bus:'internal',value:binary8(operand)});
  if(m.micro===8&&mnemonic==='BRA')return move({pc:operand,micro:0,instructions:m.instructions+1},'execute','Branch: change PC to '+binary4(operand)+'.',['CIR','PC'],{from:'CIR',to:'PC',bus:'internal',value:binary4(operand)});
  if(m.micro===8&&mnemonic==='BRZ')return move({pc:m.acc===0?operand:m.pc,micro:0,instructions:m.instructions+1},'execute',m.acc===0?'ACC is zero: branch to '+binary4(operand)+'.':'ACC is not zero: continue.',['ACC','PC']);
  if(m.micro===8&&mnemonic==='HLT')return move({halted:true,instructions:m.instructions+1},'halted','HLT stops the CPU.',['CU'],undefined,'HALT');
  throw Error('Unexpected micro-operation '+m.micro+' for '+mnemonic+'.');
 }catch(error){const desc=error instanceof Error?error.message:'Execution error.';return {...m,error:desc,halted:true,frame:{phase:'error',description:desc,active:[]}};}
}
export function runToHalt(start:Machine,maxSteps=10000):Machine{
 let m=start;for(let i=0;i<maxSteps&&!m.halted;i++)m=step(m);
 return m.halted?m:{...m,error:'Execution limit reached; possible infinite loop.',halted:true,frame:{phase:'error',description:'Execution limit reached; possible infinite loop.',active:[]}};
}
