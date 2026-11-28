import {describe,it,expect} from 'vitest';
import {assemble,DEFAULT_PROGRAM} from './assembler';
import {boot,step} from './engine';
import {cpuFrameCue} from './frame-sound';
describe('CPU micro-operation sounds',()=>{
 it('distinguishes register changes from transfers, including unchanged copied values',()=>{
  let previous=boot(assemble(DEFAULT_PROGRAM));
  expect(cpuFrameCue(previous,previous)).toBeNull();
  const cues=[];
  for(let i=0;i<7;i++){const next=step(previous);cues.push(cpuFrameCue(previous,next));previous=next;}
  expect(cues).toEqual(['cpuRegister','cpuTransfer','cpuTransfer','cpuTransfer','cpuTransferWrite','cpuTransferWrite','cpuRegister']);
  expect(cpuFrameCue(previous,boot(previous.initial))).toBeNull();
  while(!previous.halted){const next=step(previous);expect(cpuFrameCue(previous,next)).not.toBeNull();previous=next;}
  expect(cpuFrameCue(previous,step(previous))).toBeNull();
 });
});
