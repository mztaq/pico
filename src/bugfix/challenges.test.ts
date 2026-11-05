import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { runRequests } from '../runtime/worker';
import { challenges, parseChallengeCatalog } from './challenges';

describe('Bug Fix Lab challenge contracts', () => {
  it.each(challenges)('$id starts broken and can be solved for every advertised case', challenge => {
    const run = (code: string) => runRequests({ ast: compile(code).ast, runs: challenge.tests.map(test => ({ inputs: test.inputs, options: { limit: 2_000, trace: false } })) });
    let broken;
    try { broken = run(challenge.starter); } catch { broken = [{ error: { message: 'Invalid starter syntax' } }]; }
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

describe('Editable bugs.json validation', () => {
  const catalog = () => ({ challenges: [structuredClone(challenges[0])] });
  it('accepts a new exercise with no hints and Hard difficulty', () => {
    const value = catalog(); value.challenges[0].hints = []; value.challenges[0].difficulty = 'Hard';
    expect(parseChallengeCatalog(value)[0].difficulty).toBe('Hard');
  });
  it('rejects empty catalogs and duplicate IDs with useful errors', () => {
    expect(() => parseChallengeCatalog({ challenges: [] })).toThrow('must contain at least one');
    expect(() => parseChallengeCatalog({ challenges: [challenges[0], challenges[0]] })).toThrow('duplicates');
  });
  it('rejects malformed cases and unsafe IDs', () => {
    const value = catalog();
    expect(() => parseChallengeCatalog({ challenges: [{ ...value.challenges[0], id: 'constructor' }] })).toThrow('safe lowercase slug');
    expect(() => parseChallengeCatalog({ challenges: [{ ...value.challenges[0], tests: [] }] })).toThrow('.tests');
    expect(() => parseChallengeCatalog({ challenges: [{ ...value.challenges[0], tests: [{ name: 'Example', inputs: [3], expected: ['3'] }] }] })).toThrow('.inputs');
    expect(() => parseChallengeCatalog({ challenges: [{ ...value.challenges[0], starter: ' ' }] })).toThrow('.starter');
  });
});
