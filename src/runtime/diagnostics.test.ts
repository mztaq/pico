import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { friendlyError } from './diagnostics';

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
});
