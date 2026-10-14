/** Pico CPU Studio: educational 8-bit accumulator machine, 16 RAM addresses.
 * Instruction word: 4-bit opcode + 4-bit address/immediate operand.
 * Opcodes 0000 LDA, 0001 STA, 0010 ADD, 0011 HLT match the lesson slides.
 * This is a simplified *invented teaching ISA*, not a real CPU architecture.
 */
export const ISA = {
 LDA:0, STA:1, ADD:2, HLT:3, SUB:4, BRA:5, BRZ:6, LDI:7,
} as const;
export type Mnemonic=keyof typeof ISA;
export type CellKind='instruction'|'data'|'empty';
export interface MemoryCell {
 value:number; kind:CellKind; line:number|null; text:string;
}
export interface AssemblyImage {
 memory:MemoryCell[]; symbols:Record<string,number>; entry:number; code:string;
}
export class AssemblyError extends Error {
 constructor(message:string,public readonly line:number){super('Line '+line+': '+message);this.name='AssemblyError';}
}
export const DEFAULT_PROGRAM=String.raw\` ; Add the two values stored in RAM and save the result
LDA FIRST
ADD SECOND
STA RESULT
HLT

.ORG 0101
FIRST:  DAT 3
SECOND: DAT 5
RESULT: DAT 0\`;
const blank=():MemoryCell=>({value:0,kind:'empty',line:null,text:''});
type SourceLine={line:number;address:number;kind:'instruction'|'data';mnemonic:string;operand:string;source:string};
function valueOf(token:string,line:number):number{
 const raw=token.trim();
 if (/^0b[01]+$/i.test(raw))return parseInt(raw.slice(2),2);
 if (/^0x[0-9a-f]+$/i.test(raw))return parseInt(raw.slice(2),16);
 if (/^[01]{4}$/.test(raw))return parseInt(raw,2);
 if (/^\d+$/.test(raw))return Number(raw);
 throw new AssemblyError('Expected a non-negative integer, 0b binary, 0x hex or four-bit address.',line);
}
function operandOf(token:string,line:number,symbols:Record<string,number>):number{
 const label=token.toUpperCase();
 return Object.hasOwn(symbols,label)?symbols[label]!:valueOf(token,line);
}
function requireRange(n:number,min:number,max:number,line:number,kind:string):number{
 if(!Number.isSafeInteger(n)||n<min||n>max)throw new AssemblyError(kind+' must be '+min+'–'+max+'.',line);
 return n;
}
export function assemble(source:string):AssemblyImage{
 if(source.length>16000)throw new AssemblyError('Assembly source is too long.',1);
 const symbols:Record<string,number>=Object.create(null);
 const entries:SourceLine[]=[];
 const used=new Set<number>();
 let address=0;
 let firstInstruction:number|null=null;
 const lines=source.replace(/\r\n?/g,'\n').split('\n');
 if(lines.length>256)throw new AssemblyError('Use at most 256 source lines.',257);
 for(let index=0;index<lines.length;index++){
  const line=index+1;
  let code=lines[index]!.replace(/;.*$/,'').replace(/\/\/.*$/,'').trim();
  if(!code)continue;
  let match:RegExpMatchArray|null;
  while((match=code.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*/))){
   const label=match[1]!.toUpperCase();
   if(Object.hasOwn(symbols,label))throw new AssemblyError('Duplicate label '+label+'.',line);
   symbols[label]=requireRange(address,0,15,line,'Address');
   code=code.slice(match[0].length).trim();
  }
  if(!code)continue;
  const instruction=code.match(/^([.]?[a-z]+)(?:\s+(.+))?$/i);
  if(!instruction)throw new AssemblyError('Use MNEMONIC OPERAND (such as LDA 0101).',line);
  const mnemonic=instruction[1]!.toUpperCase();
  const operand=instruction[2]?.trim()??'';
  if(mnemonic==='.ORG'||mnemonic==='ORG'){
   if(!operand)throw new AssemblyError('ORG needs a memory address.',line);
   address=requireRange(valueOf(operand,line),0,15,line,'ORG address');
   continue;
  }
  if(!Object.hasOwn(ISA,mnemonic)&&mnemonic!=='DAT')throw new AssemblyError('Unknown instruction '+mnemonic+'.',line);
  if(mnemonic==='HLT'&&operand)throw new AssemblyError('HLT takes no operand.',line);
  if(mnemonic!=='HLT'&&!operand)throw new AssemblyError(mnemonic+' needs one operand.',line);
  if(operand&&/\s/.test(operand))throw new AssemblyError('Only one operand is supported.',line);
  requireRange(address,0,15,line,'Memory address');
  if(used.has(address))throw new AssemblyError('Memory address '+address+' is already in use.',line);
  used.add(address);
  const kind=mnemonic==='DAT'?'data':'instruction';
  if(kind==='instruction'&&firstInstruction===null)firstInstruction=address;
  entries.push({line,address,kind,mnemonic,operand,source:code});
  address++;
 }
 if(firstInstruction===null)throw new AssemblyError('Include at least one CPU instruction.',1);
 const memory=Array.from({length:16},blank);
 for(const item of entries){
  const n=item.mnemonic==='HLT'?0:operandOf(item.operand,item.line,symbols);
  const number=item.kind==='data'?requireRange(n,0,255,item.line,'DAT value'):requireRange(n,0,15,item.line,'Operand');
  const opcode=item.kind==='instruction'?ISA[item.mnemonic as Mnemonic]:0;
  memory[item.address]={value:item.kind==='instruction'?(opcode<<4)|number:number,kind:item.kind,line:item.line,text:item.source};
 }
 return {memory,symbols,entry:firstInstruction,code:source};
}
export function binary8(value:number):string{return (value&255).toString(2).padStart(8,'0');}
export function binary4(value:number):string{return (value&15).toString(2).padStart(4,'0');}
export function decode(word:number):{mnemonic:Mnemonic;operand:number}{
 const opcode=(word>>4)&15;
 const mnemonic=(Object.keys(ISA) as Mnemonic[]).find(key=>ISA[key]===opcode);
 if(!mnemonic)throw new Error('Unknown opcode '+binary4(opcode)+'.');
 return {mnemonic,operand:word&15};
}
