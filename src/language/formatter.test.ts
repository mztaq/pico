import { describe, expect, it } from 'vitest';
import { formatPseudocode } from './formatter';

describe('formatPseudocode', () => {
  it('indents nested blocks and aligns closers', () => {
    expect(formatPseudocode('IF Score >= 50 THEN\nOUTPUT "Pass"\nELSE\nOUTPUT "Try again"\nENDIF')).toBe('IF Score >= 50 THEN\n    OUTPUT "Pass"\nELSE\n    OUTPUT "Try again"\nENDIF');
  });
  it('formats loops without changing program text', () => {
    expect(formatPseudocode('FOR Counter ← 1 TO 3\nOUTPUT Counter\nNEXT Counter')).toContain('    OUTPUT Counter');
  });
});
