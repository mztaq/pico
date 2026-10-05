import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { execute, RuntimeError } from './interpreter';
const run = (source: string, inputs: string[] = []) => execute(compile(source).ast, inputs);

describe('routine scopes and calls', () => {
  it('calls procedures and preserves global writes', () => {
    expect(run('DECLARE Count : INTEGER\nCount ← 0\nPROCEDURE Inc(N : INTEGER)\nCount ← Count + N\nENDPROCEDURE\nCALL Inc(2)\nOUTPUT Count').output).toEqual(['2']);
  });
  it('evaluates every argument in the caller before binding parameters', () => {
    expect(run('FUNCTION Pick(A : INTEGER, B : INTEGER) RETURNS INTEGER\nRETURN B\nENDFUNCTION\nDECLARE A : INTEGER\nA ← 9\nOUTPUT Pick(1, A)').output).toEqual(['9']);
  });
  it('allows parameter and local shadowing without leaking locals', () => {
    expect(run('DECLARE N : INTEGER\nN ← 9\nFUNCTION F(N : INTEGER) RETURNS INTEGER\nDECLARE Count : INTEGER\nCount ← N\nRETURN Count\nENDFUNCTION\nOUTPUT F(2)\nOUTPUT N').output).toEqual(['2', '9']);
    expect(run('DECLARE N : INTEGER\nN ← 9\nFUNCTION F() RETURNS INTEGER\nDECLARE N : INTEGER\nN ← 3\nRETURN N\nENDFUNCTION\nOUTPUT F()\nOUTPUT N').output).toEqual(['3','9']);
  });
  it('creates a fresh local array for every call', () => {
    expect(run('FUNCTION F() RETURNS INTEGER\nDECLARE A : ARRAY[1:1] OF INTEGER\nA[1] ← 3\nRETURN A[1]\nENDFUNCTION\nOUTPUT F()\nOUTPUT F()').output).toEqual(['3','3']);
  });
  it('does not expose a caller local to another routine', () => {
    expect(() => compile('FUNCTION F() RETURNS INTEGER\nRETURN N\nENDFUNCTION\nFUNCTION G() RETURNS INTEGER\nDECLARE N : INTEGER\nN ← 7\nRETURN F()\nENDFUNCTION')).toThrow(/not been declared/);
  });
  it('requires function results and rejects procedure values and CALL functions', () => {
    expect(() => compile('FUNCTION F() RETURNS INTEGER\nIF TRUE THEN\nRETURN 1\nENDIF\nENDFUNCTION')).toThrow(/every path/);
    expect(() => compile('PROCEDURE P()\nENDPROCEDURE\nOUTPUT P()')).toThrow(/PROCEDURE/);
    expect(() => compile('FUNCTION F() RETURNS INTEGER\nRETURN 1\nENDFUNCTION\nCALL F()')).toThrow(/FUNCTION/);
    expect(() => compile('FUNCTION LENGTH() RETURNS INTEGER\nRETURN 1\nENDFUNCTION')).toThrow(/reserved/);
  });
  it('limits recursive calls with a positioned error', () => {
    expect(() => run('FUNCTION F() RETURNS INTEGER\nRETURN F()\nENDFUNCTION\nOUTPUT F()')).toThrow(/call depth/);
  });
});

describe('arrays, types, and execution bounds', () => {
  it('honors zero, negative, and non-one lower bounds in two dimensions', () => {
    const result=run('DECLARE A, B : ARRAY[-1:1,5:6] OF INTEGER\nA[-1,5] ← 4\nB[0,6] ← 8\nOUTPUT A[-1,5], ",", B[0,6]');
    expect(result.output).toEqual(['4,8']);
    expect(result.variables.A).toEqual([[4,null],[null,null],[null,null]]);
  });
  it('checks both dimensions on reads and writes', () => {
    for (const statement of ['A[3,1] ← 4','A[1,0] ← 4','OUTPUT A[1,3]']) {
      expect(() => run(`DECLARE A : ARRAY[1:2,1:2] OF INTEGER\n${statement}`)).toThrow(/outside/);
    }
  });
  it('rejects unassigned elements and whole-array values', () => {
    expect(() => run('DECLARE A : ARRAY[1:2] OF INTEGER\nOUTPUT A[1] + 1')).toThrow(/does not have a value/);
    expect(() => compile('DECLARE A : ARRAY[1:2] OF INTEGER\nOUTPUT A')).toThrow(/needs an index/);
  });
  it('supports CHAR literals and single-character assignment', () => {
    expect(run('DECLARE C : CHAR\nC ← "A"\nOUTPUT C\nC ← \'b\'\nOUTPUT UCASE(C)').output).toEqual(['A','B']);
    expect(() => compile('DECLARE C : CHAR\nC ← "AB"')).toThrow(/Cannot assign/);
  });
  it('rejects fractional FOR values and constant counters', () => {
    expect(() => compile('DECLARE I : INTEGER\nFOR I ← 1.5 TO 2\nNEXT I')).toThrow(/INTEGER/);
    expect(() => compile('CONSTANT I ← 1\nFOR I ← 1 TO 2\nNEXT I')).toThrow(/CONSTANT/);
  });
  it('counts empty loop iterations and limits allocations', () => {
    expect(() => run('DECLARE I : INTEGER\nFOR I ← 1 TO 1000000000\nNEXT I')).toThrow(/steps/);
    expect(() => run('WHILE TRUE DO\nENDWHILE')).toThrow(/steps/);
    expect(() => run('REPEAT\nUNTIL FALSE')).toThrow(/steps/);
    expect(() => run('DECLARE A : ARRAY[1:1000000] OF INTEGER')).toThrow(/allocation limit/);
    expect(() => compile('OUTPUT 9007199254740992')).toThrow(/safe range/);
  });
  it('rejects division by zero, invalid integer operators and blank REAL input', () => {
    expect(() => run('OUTPUT MOD(3,0)')).toThrow(/zero/);
    expect(() => run('OUTPUT 3 MOD 0')).toThrow(/zero/);
    expect(() => compile('OUTPUT 5.5 MOD 2')).toThrow(/INTEGER/);
    expect(() => run('DECLARE N : REAL\nINPUT N', [''])).toThrow(/REAL/);
  });
  it('recreates block locals on each iteration', () => {
    expect(run('DECLARE I : INTEGER\nFOR I ← 1 TO 2\nDECLARE N : INTEGER\nN ← I\nOUTPUT N\nNEXT I').output).toEqual(['1','2']);
  });
  it('preserves literal and comment contents during arrow normalization', () => {
    expect(run('OUTPUT "<--", "“text”"\n// <--\nDECLARE N : INTEGER\nN <-- 2\nOUTPUT N').output).toEqual(['<--“text”','2']);
  });
  it('accepts next-line THEN, requires THEN, and handles negative CASE labels', () => {
    expect(run('IF TRUE\nTHEN\nOUTPUT "yes"\nENDIF').output).toEqual(['yes']);
    expect(() => compile('IF TRUE\nOUTPUT "yes"\nENDIF')).toThrow(/requires THEN/);
    expect(run('DECLARE N : INTEGER\nN ← -1\nCASE OF N\n0 :\nOUTPUT "zero"\n-1 :\nOUTPUT "negative"\nENDCASE').output).toEqual(['negative']);
  });
});

describe('virtual files', () => {
  it('writes expressions without discarding a token and reopens non-destructively', () => {
    const source='DECLARE Line : STRING\nOPENFILE "x" FOR WRITE\nWRITEFILE "x", "hello world"\nCLOSEFILE "x"\nOPENFILE "x" FOR READ\nREADFILE "x", Line\nOUTPUT Line\nCLOSEFILE "x"\nOPENFILE "x" FOR READ\nREADFILE "x", Line\nOUTPUT Line';
    const result=run(source);
    expect(result.output).toEqual(['hello world','hello world']);
    expect(result.files).toEqual({x:['hello world']});
  });
  it('persists supplied files across runs without mutating the caller', () => {
    const files={x:[' first line ']};
    const result=execute(compile('DECLARE Line : STRING\nOPENFILE "x" FOR READ\nREADFILE Line\nOUTPUT Line').ast, [], {files});
    expect(result.output).toEqual([' first line ']); expect(files.x).toEqual([' first line ']);
    expect(run('OPENFILE "x" FOR WRITE\nWRITEFILE "hello"\nCLOSEFILE').files).toEqual({x:['hello']});
  });
  it('checks modes, missing files and EOF', () => {
    expect(() => execute(compile('OPENFILE "x" FOR READ\nWRITEFILE "hello"').ast,[],{files:{x:[]}})).toThrow(/FOR WRITE/);
    expect(() => run('DECLARE Line : STRING\nOPENFILE "x" FOR WRITE\nREADFILE Line')).toThrow(/FOR READ/);
    expect(() => run('OPENFILE "missing" FOR READ')).toThrow(/does not exist/);
    expect(() => execute(compile('DECLARE Line : STRING\nOPENFILE "x" FOR READ\nREADFILE Line').ast,[],{files:{x:[]}})).toThrow(/End of file/);
  });
  it('tracks independent file handles and truncates WRITE files', () => {
    expect(execute(compile('OPENFILE "x" FOR WRITE\nOPENFILE "y" FOR WRITE\nWRITEFILE "x", "one"\nWRITEFILE "y", "two"').ast,[],{files:{x:['old']}}).files).toEqual({x:['one'],y:['two']});
  });
});

describe('debugger snapshots', () => {
  it('keeps historical arrays immutable and records the final state', () => {
    const result=run('DECLARE A : ARRAY[1:1] OF INTEGER\nA[1] ← 1\nA[1] ← 2\nOUTPUT A[1]');
    expect(result.trace.find(s => s.line===3)?.variables.A).toEqual([1]);
    expect(result.trace.at(-1)?.variables.A).toEqual([2]);
    expect(result.trace.at(-1)?.output).toEqual(['2']);
  });
  it('preserves partial output and trace on errors', () => {
    try { run('OUTPUT "before"\nOUTPUT 1 / 0'); throw new Error('Expected runtime error'); }
    catch (error) { expect(error).toBeInstanceOf(RuntimeError); expect((error as RuntimeError).result?.output).toEqual(['before']); expect((error as RuntimeError).result?.trace.length).toBeGreaterThan(0); }
  });
  it('bounds trace memory and permits disabling recording', () => {
    const source='DECLARE A : ARRAY[1:50000] OF INTEGER\nDECLARE I : INTEGER\nFOR I ← 1 TO 20\nA[1] ← I\nNEXT I';
    const result=run(source); expect(result.traceTruncated).toBe(true); expect(result.variables.A).toHaveLength(50000);
    expect(execute(compile('OUTPUT 1').ast,[],{trace:false}).trace).toEqual([]);
  });
});
