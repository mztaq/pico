import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { documentationFor } from '../runtime/diagnostics';
import { execute } from '../runtime/interpreter';
import { referenceExamples, referenceTerms, type ReferenceExample } from './reference';

describe('quick reference programs', () => {
  it.each(referenceTerms)('%s has a documented, runnable example', keyword => {
    const example: ReferenceExample = referenceExamples[keyword];
    expect(documentationFor(keyword)).toBeTruthy();
    expect(example.code).toMatch(new RegExp(`\\b${keyword}\\b`));
    // Compile directly: examples must work without the editor's Auto-declare.
    const result = execute(compile(example.code).ast, example.inputs ?? [], { trace: false });
    if (keyword === 'RANDOM') {
      expect(result.output).toHaveLength(1);
      expect(Number(result.output[0])).toBeGreaterThanOrEqual(0);
      expect(Number(result.output[0])).toBeLessThan(1);
    } else {
      expect(example.expectedOutput).toBeDefined();
      expect(result.output).toEqual(example.expectedOutput);
    }
  });
});
