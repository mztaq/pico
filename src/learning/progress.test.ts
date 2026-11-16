import { describe, expect, it } from 'vitest';
import { recordAnswer } from './progress';

describe('practice progress', () => {
  it('tracks attempts and clears a missed question after a correct retry', () => {
    const first = recordAnswer({ attempts: {}, missed: [] }, 'bits-1', false);
    expect(first).toEqual({ attempts: { 'bits-1': { correct: 0, total: 1 } }, missed: ['bits-1'] });
    const second = recordAnswer(first, 'bits-1', true);
    expect(second).toEqual({ attempts: { 'bits-1': { correct: 1, total: 2 } }, missed: [] });
  });
});
