/** Shared CPU diagram geometry and live register-value formatting.
 * Used by CPU Studio and its read-only homepage product preview.
 */
import { binary4, binary8 } from './assembler';
import type { Machine, Register } from './engine';

export const NORMAL_LAYOUT:Partial<Record<Register|'CACHE'|'DECODE'|'CLOCK'|'STATUS'|'INTERRUPT',{x:number;y:number;w:number;h:number}>>={
 ACC:{x:45,y:189,w:240,h:90},
 ALU:{x:45,y:299,w:240,h:110},
 CIR:{x:315,y:197,w:165,h:102},
 CACHE:{x:45,y:431,w:240,h:100},
};

export const BOXES:{key:Register|'DECODE'|'CACHE'|'CLOCK'|'STATUS'|'INTERRUPT';x:number;y:number;w:number;h:number;label:string;value:(m:Machine)=>string}[]=[
 {key:'PC',x:45,y:64,w:158,h:106,label:'Program Counter',value:m=>binary4(m.pc)},
 {key:'MAR',x:548,y:64,w:160,h:102,label:'Memory Address Register',value:m=>binary4(m.mar)},
 {key:'DECODE',x:45,y:185,w:247,h:225,label:'Decode Unit',value:m=>m.frame.phase==='decode'?'DECODING':'CONTROLLED BY CU'},
 {key:'CACHE',x:45,y:423,w:247,h:108,label:'Cache',value:()=>'FAST MEMORY'},
 {key:'ACC',x:315,y:184,w:165,h:81,label:'Accumulator',value:m=>binary8(m.acc)},
 {key:'ALU',x:315,y:283,w:165,h:95,label:'Arithmetic Logic Unit',value:m=>binary8(m.alu)},
 {key:'CIR',x:315,y:389,w:165,h:73,label:'Current Instruction Register',value:m=>binary8(m.cir)},
 {key:'STATUS',x:315,y:468,w:165,h:32,label:'Status Register',value:m=>m.acc===0?'Z = 1':'Z = 0'},
 {key:'INTERRUPT',x:315,y:505,w:165,h:33,label:'Interrupt Register',value:()=>'READY'},
 {key:'MDR',x:548,y:268,w:160,h:90,label:'Memory Data Register',value:m=>binary8(m.mdr)},
 {key:'CLOCK',x:548,y:367,w:160,h:52,label:'Clock',value:m=>'TICK '+m.cycles},
 {key:'CU',x:548,y:443,w:160,h:95,label:'Control Unit',value:m=>m.frame.signal??'DECODE / CONTROL'},
];
