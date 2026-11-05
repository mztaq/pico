import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { runRequests } from '../runtime/worker';
import { challenges } from './challenges';

describe('Bug Fix Lab challenge contracts', () => {
  it.each(challenges)('$id starts broken and can be solved for every advertised case', challenge => {
    const run = (code: string) => runRequests({ ast: compile(code).ast, runs: challenge.tests.map(test => ({ inputs: test.inputs, options: { limit: 2_000, trace: false } })) });
    const broken = run(challenge.starter);
    expect(broken.some((reply, index) => reply.error || JSON.stringify(reply.result?.output) !== JSON.stringify(challenge.tests[index].expected))).toBe(true);
    const fixed = run(challenge.solution);
    fixed.forEach((reply, index) => {
      expect(reply.error).toBeUndefined();
      expect(reply.result?.output).toEqual(challenge.tests[index].expected);
    });
  });
  it('bounds the intentional infinite loop', () => {
    const challenge = challenges.find(item => item.id === 'stuck-countdown')!;
    const [reply] = runRequests({ ast: compile(challenge.starter).ast, runs: [{ inputs: ['3'], options: { limit: 2_000, trace: false } }] });
    expect(reply.error).toBeDefined();
  });
});
