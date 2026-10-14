import {describe,it,expect} from 'vitest';
import {assemble} from './assembler';
import {boot} from './engine';
import {advanceWithInterrupt,initialInterrupt,requestInterrupt} from './advanced';
describe('Cambridge interrupt demonstration',()=>{
 it('waits for current instruction to finish, shows ISR stages and restores PC',()=>{
  let m=boot(assemble('LDA 0101\nADD 0101\nHLT\n.ORG 0101\nDAT 3'));
  let state=requestInterrupt(initialInterrupt());
  for(let n=0;n<100&&m.instructions===0;n++){
   const result=advanceWithInterrupt(m,state);m=result.machine;state=result.interrupt;
   expect(state.stage).toBe(0);
  }
  expect(m.instructions).toBe(1);
  const address=m.pc;
  for(let n=0;n<5;n++){
   const result=advanceWithInterrupt(m,state);m=result.machine;state=result.interrupt;
   expect(m.frame.phase).toBe('interrupt');
  }
  expect(state.handled).toBe(1);
  expect(state.stage).toBe(0);
  expect(m.pc).toBe(address);
  expect(m.acc).toBe(3);
  expect(m.instructions).toBe(1);
  const resume=advanceWithInterrupt(m,state);
  expect(resume.machine.frame.phase).toBe('fetch');
 });
 it('ignores duplicate requests until the current request completes',()=>{
  const state=requestInterrupt(initialInterrupt());
  expect(requestInterrupt(state)).toEqual(state);
 });
});
