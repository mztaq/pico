import {describe,expect,it} from 'vitest';
import {assemble,AssemblyError,binary8,decode,DEFAULT_PROGRAM} from './assembler';
describe('Pico CPU teaching assembler',()=>{
 it('uses the Cambridge presentation opcodes for LDA, STA, ADD and HLT',()=>{
  const program=assemble('LDA 0101\nSTA 0110\nADD 0111\nHLT');
  expect(program.memory.slice(0,4).map(c=>c.value)).toEqual([5,22,39,48]);
  expect(program.memory[0]?.kind).toBe('instruction');
  expect(decode(39)).toEqual({mnemonic:'ADD',operand:7});
 });
 it('assembles address labels, ORG, DAT, comments and 8-bit words',()=>{
  const p=assemble(DEFAULT_PROGRAM);
  expect(p.memory.slice(0,4).map(c=>c.value)).toEqual([5,38,23,48]);
  expect(p.memory.slice(5,8).map(c=>c.value)).toEqual([3,5,0]);
  expect(p.symbols.FIRST).toBe(5);
  expect(p.entry).toBe(0);
  expect(binary8(p.memory[2]!.value)).toBe('00010111');
 });
 it('accepts 0b, 0x and decimal literals',()=>{
  const p=assemble('LDA 0b1010\nADD 0xA\nSTA 10\nHLT');
  expect(p.memory.slice(0,4).map(c=>c.value)).toEqual([10,42,26,48]);
 });
 it.each([
  ['bad instruction','MOV 2','Unknown instruction'],
  ['out-of-range','LDA 16','Operand must be'],
  ['duplicate labels','X: HLT\nX: HLT','Duplicate label'],
  ['collision','HLT\n.ORG 0000\nHLT','already in use'],
  ['missing operand','STA','needs one operand'],
  ['HLT operand','HLT 0','takes no operand'],
  ['bad org','.ORG 16\nHLT','ORG address'],
  ['bad data','HLT\nDAT 300','DAT value'],
  ['missing instructions','DATA: DAT 3','at least one'],
  ['undefined symbol','LDA MISSING\nHLT','Expected a non-negative'],
 ])('rejects %s with useful line errors',(_,code,message)=>{
  expect(()=>assemble(code)).toThrow(message);
 });
 it('reports original source line',()=>{
  try{assemble('; comment\nLDA WHAT');}catch(e){expect(e).toBeInstanceOf(AssemblyError);expect((e as AssemblyError).line).toBe(2);}
 });
});
