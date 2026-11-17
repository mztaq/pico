import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { execute } from '../runtime/interpreter';
import { challenges, challengeById } from './challenges';
import { gradeChallenge } from './execute';

const solutions: Record<string, string> = {
  hello: [
    'DECLARE Name : STRING', 'INPUT Name', 'OUTPUT "Hello, ", Name',
  ].join('\n'),
  'even-odd': [
    'DECLARE Number : INTEGER', 'INPUT Number',
    'IF Number MOD 2 = 0 THEN', '    OUTPUT "Even"', 'ELSE',
    '    OUTPUT "Odd"', 'ENDIF',
  ].join('\n'),
  largest: [
    'DECLARE A : INTEGER', 'DECLARE B : INTEGER', 'INPUT A', 'INPUT B',
    'IF A > B THEN', '    OUTPUT A', 'ELSE', '    OUTPUT B', 'ENDIF',
  ].join('\n'),
  'sum-to-n': [
    'DECLARE N : INTEGER', 'DECLARE Total : INTEGER', 'DECLARE I : INTEGER',
    'INPUT N', 'Total <- 0', 'FOR I <- 1 TO N',
    '    Total <- Total + I', 'NEXT I', 'OUTPUT Total',
  ].join('\n'),
  countdown: [
    'DECLARE N : INTEGER', 'DECLARE I : INTEGER', 'INPUT N',
    'FOR I <- N TO 1 STEP -1', '    OUTPUT I', 'NEXT I',
  ].join('\n'),
  'password-length': [
    'DECLARE Password : STRING', 'INPUT Password',
    'IF LENGTH(Password) >= 8 THEN',
    '    OUTPUT "Long"', 'ELSE', '    OUTPUT "Short"', 'ENDIF',
  ].join('\n'),
  'times-table': [
    'DECLARE N : INTEGER', 'DECLARE I : INTEGER', 'INPUT N',
    'FOR I <- 1 TO 5', '    OUTPUT N * I', 'NEXT I',
  ].join('\n'),
  factorial: [
    'DECLARE N : INTEGER', 'DECLARE I : INTEGER',
    'DECLARE Result : INTEGER', 'INPUT N', 'Result <- 1',
    'FOR I <- 1 TO N', '    Result <- Result * I', 'NEXT I', 'OUTPUT Result',
  ].join('\n'),
};

describe('Pico coding challenges', () => {
  it('has unique IDs, safe bounded cases and working starter code', () => {
    expect(new Set(challenges.map(c => c.id)).size).toBe(challenges.length);
    expect(challenges.length).toBeGreaterThanOrEqual(8);
    for (const challenge of challenges) {
      expect(challenge.cases.length).toBeGreaterThanOrEqual(3);
      expect(challengeById(challenge.id)).toBe(challenge);
      expect(() => compile(challenge.starter)).not.toThrow();
      expect(challenge.hint.length).toBeGreaterThan(10);
    }
  });

  it.each(challenges)('$title accepts a correct reference solution', challenge => {
    const compiled = compile(solutions[challenge.id]!);
    for (const testcase of challenge.cases) {
      const run = execute(compiled.ast, testcase.inputs, { trace: false, limit: 3000 });
      expect(run.output, challenge.id + ' with inputs ' + testcase.inputs.join(',')).toEqual(testcase.expected);
    }
  });

  it('rejects output that differs from expected results', () => {
    const challenge = challenges[0]!;
    const result = gradeChallenge(challenge, challenge.cases.map(() => ({
      result: {
        output: ['incorrect'], variables: {}, coverage: [], trace: [], steps: 1, files: {}, traceTruncated: false,
      },
    })));
    expect(result.passed).toBe(0);
    expect(result.cases.every(test => !test.passed)).toBe(true);
  });
});
