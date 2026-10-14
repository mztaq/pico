import {describe,expect,it} from 'vitest';
import {assemble,DEFAULT_PROGRAM} from './assembler';
import {boot,runToHalt,step} from './engine';
describe('CPU Studio micro-step engine',()=>{
 it('performs fetch, memory read, CIR transfer, and decode exactly',()=>{
  let m=boot(assemble(DEFAULT_PROGRAM)),last='';
  for(let i=0;i<8;i++){m=step(m);last=m.frame.description;}
  expect(m.pc).toBe(1);expect(m.mar).toBe(0);expect(m.mdr).toBe(5);expect(m.cir).toBe(5);
  expect(last).toContain('Decode CIR');expect(m.frame.phase).toBe('decode');
 });
 it('performs LDA ADD STA and HLT',()=>{
  const m=runToHalt(boot(assemble(DEFAULT_PROGRAM)));
  expect(m.error).toBeNull();expect(m.acc).toBe(8);
  expect(m.memory[7]).toBe(8);expect(m.instructions).toBe(4);expect(m.halted).toBe(true);
 });
 it('runs branches and arithmetic',()=>{
  const p=assemble('LDI 0xF\nSTA 0101\nLDA 0101\nSUB 0101\nBRZ DONE\nLDI 9\nDONE: HLT\n.ORG 0101\nDAT 0');
  const m=runToHalt(boot(p));
  expect(m.acc).toBe(0);expect(m.instructions).toBe(6);expect(m.memory[5]).toBe(15);
 });
 it('stops looping instruction programs at an execution budget',()=>{
  expect(runToHalt(boot(assemble('HERE: BRA HERE')),110).error).toMatch(/Execution limit/);
 });
 it('reports empty RAM reads',()=>{
  expect(runToHalt(boot(assemble('LDA 1111\nHLT'))).error).toMatch(/empty RAM/);
 });
 it('does not advance after HLT and resets from initial program',()=>{
  const m=runToHalt(boot(assemble('HLT')));
  expect(step(m)).toBe(m);
  expect(boot(m.initial).cycles).toBe(0);
 });
});
