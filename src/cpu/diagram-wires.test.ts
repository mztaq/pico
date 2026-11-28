import {describe,it,expect} from 'vitest';
import {NORMAL_WIRES,ADVANCED_WIRES,NORMAL_LAYOUT,ADVANCED_LAYOUT,normalTransferRoute,cpuTransferRoute,orthogonalPath} from './diagram-wires';
import {assemble,DEFAULT_PROGRAM} from './assembler';
import {boot,step} from './engine';
describe('CPU schematic routes',()=>{
 it('uses only orthogonal commands and refuses diagonals',()=>{
  for(const wire of [...NORMAL_WIRES,...ADVANCED_WIRES])expect(wire.path).toMatch(/^M\d+ \d+(?: [HV]\d+)+$/);
  expect(()=>orthogonalPath([[0,0],[2,2]])).toThrow();
 });
 it('connects the Control Unit to each visible normal component without advanced-only units',()=>{
  expect(NORMAL_WIRES.filter(w=>w.control&&w.target).map(w=>w.target).sort()).toEqual(['ACC','ALU','CACHE','CIR','MAR','MDR','PC']);
  expect(ADVANCED_WIRES.filter(w=>w.control&&w.target).map(w=>w.target).sort()).toEqual(['ACC','ALU','CACHE','CIR','CLOCK','DECODE','INTERRUPT','MAR','MDR','PC','STATUS']);
 });
 it('gives each control signal a distinct port on the control unit',()=>{
  for(const [wires,cu] of [[NORMAL_WIRES,{x:548,y:443,w:160,h:95}],[ADVANCED_WIRES,ADVANCED_LAYOUT.CU!]] as const){
   const controls=wires.filter(w=>w.control);
   const starts=controls.map(w=>w.path.split(' ').slice(0,2).join(' '));
   expect(new Set(starts).size).toBe(controls.length);
   for(const start of starts){
    const [x,y]=start.slice(1).split(' ').map(Number) as [number,number];
    expect(x>=cu.x&&x<=cu.x+cu.w&&y>=cu.y&&y<=cu.y+cu.h).toBe(true);
    expect(x===cu.x||x===cu.x+cu.w||y===cu.y||y===cu.y+cu.h).toBe(true);
   }
  }
  expect(NORMAL_LAYOUT.ACC?.w).toBe(160);
 });
 it('follows rendered data wires and their reverses for every animated step',()=>{
  let machine=boot(assemble(DEFAULT_PROGRAM));
  for(let i=0;i<100&&!machine.halted;i++){
   machine=step(machine);
   const transfer=machine.frame.transfer;
   if(!transfer)continue;
   for(const [routes,wires] of [[normalTransferRoute,NORMAL_WIRES],[cpuTransferRoute,ADVANCED_WIRES]] as const){
    const path=routes(transfer.from,transfer.to);
    expect(path).toMatch(/^M\d+ \d+(?: [HV]\d+)+$/);
    if(transfer.from==='RAM'||transfer.to==='RAM')continue;
    const wire=wires.find(w=>w.from===transfer.from&&w.to===transfer.to);
    if(wire)expect(path).toBe(wire.path);
    else expect(wires.some(w=>w.bidirectional&&w.from===transfer.to&&w.to===transfer.from)).toBe(true);
   }
  }
  expect(machine.halted).toBe(true);
 });
 it('uses the visible external bus lanes',()=>{
  expect(normalTransferRoute('RAM','MDR')).toBe('M924 358 H708');
  expect(normalTransferRoute('MDR','RAM')).toBe('M708 328 H924');
  expect(cpuTransferRoute('CU','RAM')).toBe('M708 470 H924');
 });
});
