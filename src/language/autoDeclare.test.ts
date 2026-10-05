import { describe, expect, it } from 'vitest';
import { autoDeclareVariables, synchronizeAutoDeclarations } from './autoDeclare';
import { compile } from './index';

describe('autoDeclareVariables', () => {
  it('infers variable types from assignment expressions without duplicating declarations', () => {
    const source = 'Total ← 0\nTotal ← Total + 1.5\nName ← "Ada"\nReady ← TRUE';
    const inferred = autoDeclareVariables(source);
    expect(inferred).toBe('DECLARE Total : REAL\nDECLARE Name : STRING\nDECLARE Ready : BOOLEAN\n' + source);
    expect(() => compile(inferred)).not.toThrow();
    expect(autoDeclareVariables('DECLARE Count : INTEGER\nCount ← 1')).toBe('DECLARE Count : INTEGER\nCount ← 1');
  });

  it('declares an undeclared FOR counter as INTEGER', () => {
    const source = 'FOR Index ← 1 TO 3\n    OUTPUT Index\nNEXT Index';
    const inferred = autoDeclareVariables(source);
    expect(inferred).toBe(`DECLARE Index : INTEGER\n${source}`);
    expect(() => compile(inferred)).not.toThrow();
  });

  it('declares inferred routine locals inside their routine', () => {
    const source = 'FUNCTION Double (N : INTEGER) RETURNS INTEGER\nResult ← N * 2\nRETURN Result\nENDFUNCTION\nOUTPUT Double(3)';
    const inferred = autoDeclareVariables(source);
    expect(inferred).toBe('FUNCTION Double (N : INTEGER) RETURNS INTEGER\nDECLARE Result : INTEGER\nResult ← N * 2\nRETURN Result\nENDFUNCTION\nOUTPUT Double(3)');
    expect(() => compile(inferred)).not.toThrow();
  });

  it('leaves input-only and conflicting assignments for the student to declare', () => {
    expect(autoDeclareVariables('INPUT Name')).toBe('INPUT Name');
    expect(autoDeclareVariables('Value ← 1\nValue ← "one"')).toBe('Value ← 1\nValue ← "one"');
  });

  it('leaves incomplete or invalid syntax unchanged', () => {
    expect(autoDeclareVariables('Score ←')).toBe('Score ←');
  });

  it('updates its generated declaration in real time when an assignment type changes', () => {
    const initial = synchronizeAutoDeclarations('Score ← 1');
    expect(initial.code).toBe('DECLARE Score : INTEGER\nScore ← 1');
    const real = synchronizeAutoDeclarations(initial.code.replace('Score ← 1', 'Score ← 1.5'), initial.generatedTypes);
    expect(real.code).toBe('DECLARE Score : REAL\nScore ← 1.5');
    expect(real.generatedTypes['global::Score']).toBe('REAL');
    const text = synchronizeAutoDeclarations(real.code.replace('Score ← 1.5', 'Score ← "ready"'), real.generatedTypes);
    expect(text.code).toBe('DECLARE Score : STRING\nScore ← "ready"');
    expect(() => compile(text.code)).not.toThrow();
  });

  it('never rewrites an explicit student declaration', () => {
    const source = 'DECLARE Score : INTEGER\nScore ← 1.5';
    const result = synchronizeAutoDeclarations(source);
    expect(result.code).toBe(source);
    expect(result.generatedTypes).toEqual({});
  });

  it('recalculates dependent generated declarations when their source variable changes type', () => {
    const initial = synchronizeAutoDeclarations('Source ← "hello"\nCopy ← Source');
    const edited = initial.code.replace('Source ← "hello"', 'Source ← TRUE');
    const updated = synchronizeAutoDeclarations(edited, initial.generatedTypes);
    expect(updated.code).toBe('DECLARE Source : BOOLEAN\nDECLARE Copy : BOOLEAN\nSource ← TRUE\nCopy ← Source');
    expect(() => compile(updated.code)).not.toThrow();
  });
});
