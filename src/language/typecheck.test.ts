import { describe, expect, it } from 'vitest';
import { compile } from './index';
import { execute } from '../runtime/interpreter';

describe('Cambridge semantic type checking', () => {
  it('rejects assigning an INTEGER to a STRING variable', () => {
    expect(() => compile('DECLARE Score : STRING\nScore ← 4\nOUTPUT Score')).toThrow(/Cannot assign INTEGER to Score \(STRING\)/);
  });
  it('rejects incorrect types in conditions and operators', () => {
    expect(() => compile('DECLARE Name : STRING\nIF Name THEN\nOUTPUT Name\nENDIF')).toThrow(/IF condition must be BOOLEAN/);
    expect(() => compile('OUTPUT "score" - 4')).toThrow(/needs numeric values/);
  });
<<<<<<< HEAD
  it('allows INTEGER to REAL promotion but not the reverse', () => {
    expect(() => compile('DECLARE Average : REAL\nAverage ← 4\nOUTPUT Average')).not.toThrow();
    expect(() => compile('DECLARE Count : INTEGER\nCount ← 4.5')).toThrow(/Cannot assign REAL to Count \(INTEGER\)/);
  });
=======
  it('keeps REAL expressions numeric while rejecting reverse assignment', () => {
    expect(() => compile('DECLARE Average : REAL\nAverage ← 4')).not.toThrow();
    expect(() => compile('DECLARE Average : REAL\nAverage ← 4.0\nOUTPUT Average')).not.toThrow();
    expect(() => compile('DECLARE Count : INTEGER\nCount ← 4.5')).toThrow(/Cannot assign REAL to Count \(INTEGER\)/);
  });
  it('explains misspelled keywords at the statement boundary', () => {
    expect(() => compile('DELCARE Name : STRING')).toThrow(/Did you mean DECLARE/);
  });
>>>>>>> 66dc25c (Initial commit)
  it('checks arrays, function returns, and procedure calls', () => {
    expect(() => compile('DECLARE Values : ARRAY[1:3] OF INTEGER\nValues["one"] ← 1')).toThrow(/ARRAY indexes must be INTEGER/);
    expect(() => compile('FUNCTION Name (N : INTEGER) RETURNS STRING\nRETURN N\nENDFUNCTION')).toThrow(/FUNCTION must return STRING/);
  });
  it('keeps the interpreter safe if an invalid AST is supplied directly', () => {
    const program = compile('DECLARE Score : INTEGER\nScore ← 4').ast;
    (program.statements[1] as any).value = { kind: 'StringLiteral', value: 'bad', line: 2, column: 9, endColumn: 14 };
    expect(() => execute(program)).toThrow(/Cannot assign bad to Score \(INTEGER\)/);
  });
});
