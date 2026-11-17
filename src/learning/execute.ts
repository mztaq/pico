import { compile } from '../language';
import { startExecution, type ExecutionJob } from '../runtime/runner';
import type { RunResult } from '../runtime/interpreter';
import type { Challenge } from './challenges';

export interface CodeRun {
  result?: RunResult;
  error?: string;
}
export interface CheckedCase {
  passed: boolean;
  inputs: string[];
  expected: string[];
  received: string[];
  error?: string;
}
export interface ChallengeResult {
  passed: number;
  total: number;
  cases: CheckedCase[];
}

/** Run bounded pseudocode in Pico's existing isolated Web Worker. */
export function runCode(source: string, inputs: string[], trace = true): ExecutionJob {
  const ast = compile(source).ast;
  return startExecution({
    ast,
    runs: [{ inputs, options: { trace, limit: 10000 } }],
  });
}

export function checkChallenge(code: string, challenge: Challenge): ExecutionJob {
  const ast = compile(code).ast;
  return startExecution({
    ast,
    runs: challenge.cases.map(test => ({
      inputs: test.inputs,
      options: { trace: false, limit: 10000 },
    })),
  });
}

const normalized = (values: string[]) => values.map(value => value.trim());

export function gradeChallenge(
  challenge: Challenge,
  replies: Awaited<ExecutionJob['promise']>,
): ChallengeResult {
  const cases = challenge.cases.map((test, index): CheckedCase => {
    const reply = replies[index];
    const received = normalized(reply?.result?.output ?? []);
    const expected = normalized(test.expected);
    return {
      passed: !reply?.error && Boolean(reply?.result)
        && expected.length === received.length
        && expected.every((value, i) => value === received[i]),
      inputs: test.inputs,
      expected: test.expected,
      received: reply?.result?.output ?? [],
      error: reply?.error?.message,
    };
  });
  return { passed: cases.filter(test => test.passed).length, total: cases.length, cases };
}

const STORAGE_KEY = 'pico.challenges.v1';

export function readSolved(): string[] {
  try {
    const known = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
    return [...known].filter(id => challengesIds.has(id));
  } catch { return []; }
}

const challengesIds = new Set(['hello', 'even-odd', 'largest', 'sum-to-n',
  'countdown', 'password-length', 'times-table', 'factorial']);

export function recordSolved(id: string): string[] {
  const next = [...new Set([...readSolved(), id])].filter(item => challengesIds.has(item));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Private browsing */ }
  return next;
}
