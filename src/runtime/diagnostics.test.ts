import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { findSuggestions, friendlyError } from './diagnostics';

describe('source diagnostics', () => {
  it('points missing THEN at the IF condition and includes a caret', () => {
    const source = 'OUTPUT "start"\nIF number = 5\nOUTPUT number\nENDIF';
    try {
      compile(source);
      throw new Error('Expected compilation to fail');
    } catch (error) {
      const diagnostic = friendlyError(error, source);
      expect(diagnostic.message).toContain('Expected THEN after IF condition.');
      expect(diagnostic.line).toBe(2);
      expect(diagnostic.diagnostic).toContain('✕ Syntax Error');
      expect(diagnostic.diagnostic).toContain('2  IF number = 5');
      expect(diagnostic.diagnostic).toContain('↑');
    }
  });

  it('labels misspelled keywords with a useful correction', () => {
    const source = 'DELCARE Name : STRING';
    try {
      compile(source);
      throw new Error('Expected compilation to fail');
    } catch (error) {
      expect(friendlyError(error, source).diagnostic).toContain('Did you mean DECLARE?');
    }
  });

  it('does not flag declared names or suggest control-flow keywords inside OUTPUT expressions', () => {
    const source = 'DECLARE Name : STRING\nOUTPUT "Name: ", LENGTH(Name)';
    const suggestions = findSuggestions(source);
    expect(suggestions).toEqual([]);
  });

  it('suggests a misspelled expression routine without offering unrelated control flow', () => {
    const suggestions = findSuggestions('DECLARE Name : STRING\nOUTPUT LENGHT(Name)');
    expect(suggestions).toEqual([
      { line: 2, column: 8, endColumn: 14, original: 'LENGHT', replacement: 'LENGTH' },
    ]);
  });

  it('never treats a variable being assigned or a short unrelated name as a keyword typo', () => {
    for (const source of ['name <', 'name ← ""', 'name', 'base ← 1', 'cost ← 2', 'Data[1] ← 3']) expect(findSuggestions(source)).toEqual([]);
  });

  it('still catches real keyword typos, including swapped letters', () => {
    expect(findSuggestions('OUPTUT "x"').map(s => s.replacement)).toEqual(['OUTPUT']);
    expect(findSuggestions('WHLIE TRUE').map(s => s.replacement)).toEqual(['WHILE']);
    expect(findSuggestions('DECALRE x : INTEGER').map(s => s.replacement)).toEqual(['DECLARE']);
  });
});
