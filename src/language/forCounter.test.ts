import { describe, expect, it } from 'vitest';
import { compile } from './index';
import { execute } from '../runtime/interpreter';
import { autoDeclareVariables } from './autoDeclare';
const run = (source: string) => execute(compile(source).ast);

describe('implicit FOR counters', () => {
  it('runs the textbook form without DECLARE or editor Auto-declare', () => {
    expect(run('FOR Counter ← 1 TO 5\nOUTPUT Counter\nNEXT Counter').output).toEqual(['1','2','3','4','5']);
  });
  it('supports descending, nested and reused counters', () => {
    const source='FOR Row ← 2 TO 1 STEP -1\nFOR Column ← 0 TO 1\nOUTPUT Row, ",", Column\nNEXT Column\nNEXT Row\nFOR Row ← 3 TO 3\nOUTPUT Row\nNEXT Row';
    expect(run(source).output).toEqual(['2,0','2,1','1,0','1,1','3']);
  });
  it('keeps routine counters local and creates them afresh on repeated calls', () => {
    const source='PROCEDURE Count()\nFOR Counter ← 1 TO 2\nOUTPUT Counter\nNEXT Counter\nENDPROCEDURE\nCALL Count()\nCALL Count()';
    const result=run(source);expect(result.output).toEqual(['1','2','1','2']);expect(result.variables).not.toHaveProperty('Counter');
  });
  it('reuses explicit INTEGER counters but rejects incompatible types and constants', () => {
    expect(run('DECLARE Counter : INTEGER\nFOR Counter ← 1 TO 2\nOUTPUT Counter\nNEXT Counter').output).toEqual(['1','2']);
    for (const declaration of ['DECLARE Counter : STRING','DECLARE Counter : REAL','DECLARE Counter : ARRAY[1:2] OF INTEGER','CONSTANT Counter ← 1']) {
      expect(() => compile(`${declaration}\nFOR Counter ← 1 TO 2\nNEXT Counter`)).toThrow(/INTEGER scalar|CONSTANT/);
    }
  });
  it('still requires declarations for ordinary variables and integer loop bounds', () => {
    expect(() => compile('Number ← 1')).toThrow(/not been declared/);
    expect(() => compile('FOR Counter ← 1.5 TO 2\nNEXT Counter')).toThrow(/INTEGER/);
    expect(() => run('FOR Counter ← 1 TO 3 STEP 0\nNEXT Counter')).toThrow(/zero/);
  });
  it('makes the initialized counter available after a zero-iteration loop', () => {
    expect(run('FOR Counter ← 5 TO 1\nNEXT Counter\nOUTPUT Counter').output).toEqual(['5']);
  });
  it('retains iteration limits without a declaration', () => {
    expect(() => run('FOR Counter ← 1 TO 1000000000\nNEXT Counter')).toThrow(/steps/);
  });
  it('infers dependent assignments without inserting a counter declaration', () => {
    const source='FOR Counter ← 1 TO 2\nDouble ← Counter * 2\nOUTPUT Double\nNEXT Counter';
    const inferred=autoDeclareVariables(source);
    expect(inferred).toContain('DECLARE Double : INTEGER');expect(inferred).not.toContain('DECLARE Counter');expect(run(inferred).output).toEqual(['2','4']);
  });
});
