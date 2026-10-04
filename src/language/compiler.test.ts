import { describe, expect, it } from 'vitest';
import { compile } from './index';
import { examples } from '../examples';
import { execute } from '../runtime/interpreter';

describe('Cambridge pseudocode examples', () => {
  for (const example of examples) {
    it(`runs ${example.name} with its documented output`, () => {
      const program = compile(example.code).ast;
      expect(execute(program, example.inputs).output).toEqual(example.expected);
    });
  }
});

describe('Cambridge syntax guards', () => {
  it('requires DO after WHILE and accepts curly quotes', () => {
    expect(() => compile('DECLARE Number : INTEGER\nWHILE Number <> -1\nENDWHILE')).toThrow(/requires DO/);
    expect(execute(compile('OUTPUT “Hello”').ast).output).toEqual(['Hello']);
  });
});

describe('Cambridge core behavior', () => {
  it('evaluates arithmetic, comparisons, Boolean operators and precedence', () => {
    const code = 'DECLARE Answer : BOOLEAN\nAnswer ← 2 + 3 * 4 = 14 AND NOT FALSE\nOUTPUT Answer';
    expect(execute(compile(code).ast).output).toEqual(['TRUE']);
  });
  it('handles ascending and descending inclusive FOR loops', () => {
    const code = 'DECLARE I : INTEGER\nFOR I ← 3 TO 1 STEP -1\n    OUTPUT I\nNEXT I';
    expect(execute(compile(code).ast).output).toEqual(['3', '2', '1']);
  });
  it('supports DIV and MOD as infix operators and library routines', () => {
    const code = 'OUTPUT 17 DIV 5\nOUTPUT 17 MOD 5\nOUTPUT DIV(17, 5)\nOUTPUT MOD(17, 5)';
    expect(execute(compile(code).ast).output).toEqual(['3', '2', '3', '2']);
  });
  it('supports one- and two-argument ROUND and text routines', () => {
    const code = 'OUTPUT ROUND(2.5)\nOUTPUT ROUND(3.14159, 2)\nOUTPUT UPPER("pico")\nOUTPUT LOWER("CAMBRIDGE")\nOUTPUT LENGTH("CIE")';
    expect(execute(compile(code).ast).output).toEqual(['2', '3.14', 'PICO', 'cambridge', '3']);
  });
  it('converts INPUT using each declared variable type', () => {
    const code = 'DECLARE Count : INTEGER\nDECLARE Ready : BOOLEAN\nINPUT Count\nINPUT Ready\nOUTPUT Count + 1\nOUTPUT Ready';
    expect(execute(compile(code).ast, ['4', 'TRUE']).output).toEqual(['5', 'TRUE']);
  });
  it('reports undeclared identifiers and immutable constants', () => {
    expect(() => execute(compile('OUTPUT Score').ast)).toThrow(/has not been declared/);
    expect(() => execute(compile('CONSTANT Limit ← 5\nLimit ← 6').ast)).toThrow(/cannot be changed/);
  });
  it('reports missing input and zero loop steps without hanging', () => {
    expect(() => execute(compile('DECLARE Answer : STRING\nINPUT Answer').ast)).toThrow(/Enter a value for Answer/);
    expect(() => execute(compile('DECLARE I : INTEGER\nFOR I ← 1 TO 3 STEP 0\n    OUTPUT I\nNEXT I').ast)).toThrow(/cannot be zero/);
  });
  it('supports Cambridge CASE, REPEAT, and booklet string routines', () => {
    const code = 'DECLARE Choice : INTEGER\nChoice ← 2\nCASE OF Choice\n1 : OUTPUT \"one\"\n2 : OUTPUT \"two\"\nOTHERWISE\nOUTPUT \"other\"\nENDCASE\nREPEAT\nChoice ← Choice - 1\nUNTIL Choice = 0\nOUTPUT SUBSTRING(\"Cambridge\", 1, 4)\nOUTPUT UCASE(\"pico\")';
    expect(execute(compile(code).ast).output).toEqual(['two', 'Camb', 'PICO']);
  });
  it('supports procedures, functions, and arrays', () => {
    const code = 'DECLARE Values : ARRAY[1:3] OF INTEGER\nDECLARE I : INTEGER\nFOR I ← 1 TO 3\nValues[I] ← I * 2\nNEXT I\nOUTPUT Values[2]\nFUNCTION Double (N : INTEGER) RETURNS INTEGER\nRETURN N * 2\nENDFUNCTION\nOUTPUT Double(4)';
    expect(execute(compile(code).ast).output).toEqual(['4', '8']);
  });
});
