import { describe, expect, it } from 'vitest';
import { autoDeclareVariables, synchronizeAutoDeclarations } from './autoDeclare';
import { compile } from './index';
import { execute } from '../runtime/interpreter';

describe('autoDeclareVariables', () => {
  it('infers variable types from assignment expressions without duplicating declarations', () => {
    const source = 'Total ← 0\nTotal ← Total + 1.5\nName ← "Ada"\nReady ← TRUE';
    const inferred = autoDeclareVariables(source);
    expect(inferred).toBe('DECLARE Total : REAL\nDECLARE Name : STRING\nDECLARE Ready : BOOLEAN\n' + source);
    expect(() => compile(inferred)).not.toThrow();
    expect(autoDeclareVariables('DECLARE Count : INTEGER\nCount ← 1')).toBe('DECLARE Count : INTEGER\nCount ← 1');
  });

  it('keeps implicit FOR counters without inserting a declaration', () => {
    const source = 'FOR Index ← 1 TO 3\n    OUTPUT Index\nNEXT Index';
    const inferred = autoDeclareVariables(source);
    expect(inferred).toBe(source);
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

describe('type-aware auto declarations', () => {
  it.each([
    ['3', 'INTEGER'], ['3.0', 'REAL'], ['-3.0', 'REAL'], ['"3"', 'STRING'], ["'A'", 'CHAR'],
    ['TRUE', 'BOOLEAN'], ['FALSE', 'BOOLEAN'], ['7 / 2', 'REAL'], ['7 DIV 2', 'INTEGER'],
    ['7 MOD 2', 'INTEGER'], ['2 ^ 3', 'INTEGER'], ['3 + 1.0', 'REAL'],
    ['NOT FALSE', 'BOOLEAN'], ['3 < 4.0', 'BOOLEAN'], ['TRUE AND FALSE', 'BOOLEAN'],
    ['LENGTH("hello")', 'INTEGER'], ['SUBSTRING("hello", 1, 2)', 'STRING'],
    ["UCASE('a')", 'CHAR'], ["LCASE('B')", 'CHAR'], ['UCASE("a")', 'STRING'],
    ['ROUND(3.14, 1)', 'REAL'], ['RANDOM()', 'REAL'],
  ])('infers %s as %s and produces executable code', (expression, type) => {
    const source = `Value ← ${expression}`;
    const result = synchronizeAutoDeclarations(source);
    expect(result.code).toBe(`DECLARE Value : ${type}\n${source}`);
    expect(() => execute(compile(result.code).ast)).not.toThrow();
    expect(synchronizeAutoDeclarations(result.code, result.generatedTypes)).toEqual(result);
  });

  it('propagates inferred types through constants and dependencies', () => {
    const source = 'Original ← 3.0\nCONSTANT Scale ← Original\nCopy ← Scale\nResult ← Copy * 2\nOUTPUT Result';
    const result = autoDeclareVariables(source);
    expect(result).toContain('DECLARE Original : REAL\nDECLARE Copy : REAL\nDECLARE Result : REAL');
    expect(execute(compile(result).ast).output).toEqual(['6']);
  });

  it('widens across all assignments and branches', () => {
    const source = 'IF TRUE THEN\nValue ← 1\nELSE\nValue ← 2.5\nENDIF\nLetter ← \'a\'\nLetter ← "word"';
    const result = autoDeclareVariables(source);
    expect(result).toContain('DECLARE Value : REAL\nDECLARE Letter : STRING');
    expect(() => compile(result)).not.toThrow();
  });

  it.each([
    ['INPUT Value\nIF Value THEN\nOUTPUT "yes"\nENDIF', 'BOOLEAN', 'TRUE', 'yes'],
    ['INPUT Value\nOUTPUT Value DIV 2', 'INTEGER', '6', '3'],
    ['INPUT Value\nOUTPUT DIV(Value, 2)', 'INTEGER', '6', '3'],
    ['INPUT Value\nFOR I ← 1 TO Value\nOUTPUT I\nNEXT I', 'INTEGER', '1', '1'],
    ['INPUT Value\nDECLARE Items : ARRAY[1:2] OF STRING\nItems[1] ← "ok"\nOUTPUT Items[Value]', 'INTEGER', '1', 'ok'],
    ['INPUT Value\nPROCEDURE Show(N : INTEGER)\nOUTPUT N\nENDPROCEDURE\nCALL Show(Value)', 'INTEGER', '8', '8'],
    ['INPUT Value\nPROCEDURE Show(C : CHAR)\nOUTPUT C\nENDPROCEDURE\nCALL Show(Value)', 'CHAR', 'X', 'X'],
    ['INPUT Value\nIF Value = "yes" THEN\nOUTPUT "ok"\nENDIF', 'STRING', 'yes', 'ok'],
    ['Value ← 3.0\nINPUT Value\nOUTPUT Value', 'REAL', '4.0', '4'],
  ])('infers INPUT from clear context: %s', (source, type, input, output) => {
    const result = autoDeclareVariables(source);
    expect(result).toContain(`DECLARE Value : ${type}`);
    expect(execute(compile(result).ast, [input]).output).toEqual([output]);
  });

  it.each([
    'INPUT Value',
    'INPUT Value\nOUTPUT Value * 2',
    'INPUT Value\nIF Value = 3 THEN\nOUTPUT "yes"\nENDIF',
    'INPUT Value\nOUTPUT LENGTH(Value)',
    'INPUT Value\nPROCEDURE Show(N : REAL)\nOUTPUT N\nENDPROCEDURE\nCALL Show(Value)',
    'A ← B\nB ← A',
  ])('does not guess ambiguous types: %s', source => {
    expect(autoDeclareVariables(source)).toBe(source);
    expect(() => compile(source)).toThrow(/not been declared/);
  });

  it('infers typed function results and routine locals separately', () => {
    const source = 'FUNCTION Make(N : INTEGER) RETURNS CHAR\nLocal ← UCASE(\'a\')\nRETURN Local\nENDFUNCTION\nResult ← Make(1)\nOUTPUT Result';
    const result = autoDeclareVariables(source);
    expect(result).toContain('DECLARE Result : CHAR\nFUNCTION Make');
    expect(result).toContain('RETURNS CHAR\nDECLARE Local : CHAR');
    expect(execute(compile(result).ast).output).toEqual(['A']);
  });

  it('infers routine INPUT from the declared return type', () => {
    const source = 'FUNCTION ReadValue() RETURNS BOOLEAN\nINPUT Value\nRETURN Value\nENDFUNCTION\nOUTPUT ReadValue()';
    const result = autoDeclareVariables(source);
    expect(result).toContain('RETURNS BOOLEAN\nDECLARE Value : BOOLEAN');
    expect(execute(compile(result).ast, ['FALSE']).output).toEqual(['FALSE']);
  });

  it('keeps explicit nested declarations from leaking or constraining outer variables', () => {
    const source = 'IF TRUE THEN\nDECLARE Item : STRING\nItem ← "inside"\nOUTPUT Item\nENDIF\nItem ← 3\nOUTPUT Item';
    const result = autoDeclareVariables(source);
    expect(result).toBe('DECLARE Item : INTEGER\n' + source);
    expect(execute(compile(result).ast).output).toEqual(['inside', '3']);
  });

  it('preserves parameter and local shadowing', () => {
    const source = 'Item ← "global"\nFUNCTION F(Item : INTEGER) RETURNS REAL\nLocal ← Item / 2\nRETURN Local\nENDFUNCTION\nFUNCTION G() RETURNS CHAR\nDECLARE Item : CHAR\nItem ← \'x\'\nRETURN Item\nENDFUNCTION\nOUTPUT Item, F(4), G()';
    const result = autoDeclareVariables(source);
    expect(result).toContain('DECLARE Item : STRING');
    expect(result).toContain('RETURNS REAL\nDECLARE Local : REAL');
    expect(result.match(/DECLARE Item/g)).toHaveLength(2);
    expect(execute(compile(result).ast).output).toEqual(['global2x']);
  });

  it('infers array reads but requires manual bounds for undeclared arrays', () => {
    const source = 'DECLARE Grid : ARRAY[-1:1, 3:4] OF CHAR\nGrid[-1,3] ← \'z\'\nLetter ← Grid[-1,3]\nOUTPUT Letter';
    const result = autoDeclareVariables(source);
    expect(result).toBe('DECLARE Letter : CHAR\n' + source);
    expect(execute(compile(result).ast).output).toEqual(['z']);
    expect(autoDeclareVariables('Items[1] ← 3')).toBe('Items[1] ← 3');
    expect(autoDeclareVariables('Items ← 1\nItems[1] ← 3')).not.toContain('DECLARE Items');
  });

  it.each(['"3" + 4', 'TRUE + 1', 'NOT 3', '"x" / 2', '1.0 DIV 2', 'LENGTH(3)', 'SUBSTRING("abc", TRUE, 1)', 'ROUND(3, 1.0)'])('does not invent a result type for invalid expressions: %s', expression => {
    expect(autoDeclareVariables(`Value ← ${expression}`)).toBe(`Value ← ${expression}`);
  });

  it('preserves generated types on conflicting edits and surfaces the normal type error', () => {
    const initial = synchronizeAutoDeclarations('Value ← 1');
    const source = initial.code + '\nValue ← "text"';
    const result = synchronizeAutoDeclarations(source, initial.generatedTypes);
    expect(result.code).toBe(source);
    expect(() => compile(result.code)).toThrow(/Cannot assign STRING/);
  });

  it('does not trust a generated declaration the student has changed manually', () => {
    const initial = synchronizeAutoDeclarations('Value ← 1');
    const edited = initial.code.replace('INTEGER', 'REAL').replace('Value ← 1', 'Value ← "text"');
    expect(synchronizeAutoDeclarations(edited, initial.generatedTypes)).toEqual({ code: edited, generatedTypes: {} });
  });

  it('preserves comments, CRLF and incomplete editor input', () => {
    const source = '// heading\r\n\r\nValue ← 3.0 // decimal';
    const initial = synchronizeAutoDeclarations(source);
    expect(initial.code).toBe('// heading\r\n\r\nDECLARE Value : REAL\r\nValue ← 3.0 // decimal');
    const incomplete = initial.code + '\r\nOther ← "unclosed';
    expect(synchronizeAutoDeclarations(incomplete, initial.generatedTypes)).toEqual({ code: incomplete, generatedTypes: initial.generatedTypes });
  });

  it('updates a generated character and dependent case conversion to STRING', () => {
    const initial = synchronizeAutoDeclarations("Letter ← 'a'\nUpper ← UCASE(Letter)");
    const result = synchronizeAutoDeclarations(initial.code.replace("Letter ← 'a'", 'Letter ← "word"'), initial.generatedTypes);
    expect(result.code).toBe('DECLARE Letter : STRING\nDECLARE Upper : STRING\nLetter ← "word"\nUpper ← UCASE(Letter)');
    expect(() => compile(result.code)).not.toThrow();
  });
});

describe('inference fixed points', () => {
  it('resolves long dependency chains without a fixed small pass limit', () => {
    const source = [...Array.from({ length: 150 }, (_, index) => `V${index} ← V${index + 1}`), 'V150 ← 1', 'OUTPUT V0'].join('\n');
    const result = autoDeclareVariables(source);
    expect(result.match(/DECLARE V\d+ : INTEGER/g)).toHaveLength(151);
    expect(() => compile(result)).not.toThrow();
  });

  it('propagates an integer assignment preference through a constant', () => {
    const result = autoDeclareVariables('Original ← 3\nCONSTANT Saved ← Original\nCopy ← Saved');
    expect(result).toContain('DECLARE Original : INTEGER\nDECLARE Copy : INTEGER');
    expect(() => compile(result)).not.toThrow();
  });

  it('does not turn mutually constrained numeric inputs into arbitrary integers', () => {
    const source = 'INPUT First\nINPUT Second\nOUTPUT First + Second';
    expect(autoDeclareVariables(source)).toBe(source);
  });

  it('keeps unrelated valid inference when another variable has conflicting assignments', () => {
    const source = 'Bad ← 1\nBad ← "text"\nGood ← TRUE';
    expect(autoDeclareVariables(source)).toBe('DECLARE Good : BOOLEAN\n' + source);
  });

  it('keeps routine generated declaration tracking separate for equal local names', () => {
    const source = 'PROCEDURE First()\nLocal ← 1\nENDPROCEDURE\nPROCEDURE Second()\nLocal ← \'x\'\nENDPROCEDURE';
    const initial = synchronizeAutoDeclarations(source);
    const updated = synchronizeAutoDeclarations(initial.code.replace('Local ← 1', 'Local ← 1.0'), initial.generatedTypes);
    expect(updated.generatedTypes).toEqual({ 'routine:FIRST::Local': 'REAL', 'routine:SECOND::Local': 'CHAR' });
    expect(() => compile(updated.code)).not.toThrow();
  });
});
