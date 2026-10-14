import {describe,expect,it} from 'vitest';
import {assemble} from './assembler';
import {boot,step} from './engine';
import {advanceRunFrame} from './playback';
import {initialInterrupt} from './advanced';
describe('continuous CPU playback',()=>{
 it('restarts automatically after HLT while keeping cumulative counts',()=>{
  let cpu=boot(assemble('LDA 1111\\nHLT\\n.ORG 1111\\nDAT 7'.replaceAll('\\n','\n')));
  let interrupt=initialInterrupt();
  let wraps=0;
  for(let n=0;n<80;n++){
   const result=advanceRunFrame(cpu,interrupt,'normal');
   cpu=result.machine;interrupt=result.interrupt;
   if(result.restarted)wraps++;
  }
  expect(wraps).toBeGreaterThan(1);
  expect(cpu.instructions).toBeGreaterThan(3);
  expect(cpu.error).toBeNull();
 });
 it('keeps manual stepping halted until Reset or Run restarts the loop',()=>{
  const base=boot(assemble('HLT'));
  let one=base;
  for(let n=0;n<9;n++)one=step(one);
  expect(one.halted).toBe(true);
  expect(step(one)).toBe(one);
  const again=advanceRunFrame(one,initialInterrupt(),'normal');
  expect(again.restarted).toBe(true);
  expect(again.machine.halted).toBe(false);
  expect(again.machine.pc).toBe(0);
 });
 it('does not hide execution faults by silently resetting',()=>{
  const cpu=boot(assemble('LDA 1111\nHLT'));
  let current=cpu;
  for(let n=0;n<15&&!current.error;n++)current=advanceRunFrame(current,initialInterrupt(),'normal').machine;
  expect(current.error).toBeTruthy();
  expect(advanceRunFrame(current,initialInterrupt(),'normal').restarted).toBe(false);
 });
});
