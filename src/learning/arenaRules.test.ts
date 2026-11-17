import { describe, expect, it } from 'vitest';
import {
  ARENA_TILES, arenaPool, arenaUnits, answerReward, modeNodeCost,
  questionAt, remainingSeconds, scoreFor, visibleQuestion,
} from './arenaRules';

describe('Pico Arena question selection', () => {
  it('uses the real topic-specific question bank with no missing units', () => {
    expect(arenaPool('all').length).toBeGreaterThanOrEqual(60);
    for (const unit of arenaUnits) {
      expect(arenaPool(unit).length).toBeGreaterThan(0);
    }
  });
  it('selects questions deterministically for synced rooms without leaking correct choices', () => {
    const first = questionAt('all', 7, 0);
    expect(questionAt('all', 7, 0)).toEqual(first);
    const safe = visibleQuestion(first);
    expect(safe.id).toBe(first.id);
    expect(safe).not.toHaveProperty('answer');
    expect(safe).not.toHaveProperty('explanation');
  });
});

describe('Arena economies and gameplay', () => {
  it('keeps different hacking and circuit costs for each node', () => {
    const empty = { pos: 0, ownerId: null, level: 1 };
    const claimed = { pos: 0, ownerId: 'rival', level: 2 };
    expect(modeNodeCost('circuit', 'capture', empty)).toBe(35);
    expect(modeNodeCost('hacker', 'capture', empty)).toBe(25);
    expect(modeNodeCost('circuit', 'capture', claimed)).toBe(110);
    expect(modeNodeCost('hacker', 'capture', claimed)).toBe(75);
    expect(modeNodeCost('hacker', 'fortify', claimed)).toBe(70);
    expect(modeNodeCost('hacker', 'fortify', { ...claimed, level: 3 })).toBeNull();
  });

  it('rewards correct answers and resets streak after mistakes', () => {
    expect(answerReward(false, 3, 1)).toEqual({ charge: 0, streak: 0, correct: 0 });
    const result = answerReward(true, 2, 1);
    expect(result.streak).toBe(3);
    expect(result.charge).toBe(25 + 3 * 5 + 8);
  });

  it('calculates final scores only from current node control and answer performance', () => {
    expect(scoreFor([1, 2, 3], 4, 2)).toBe(100 + 140 + 180 + 40 + 60);
    expect(scoreFor([], 0, 0)).toBe(0);
    expect(ARENA_TILES).toBe(20);
  });

  it('ends the round at the configured server deadline', () => {
    expect(remainingSeconds(100, 180, 279)).toBe(1);
    expect(remainingSeconds(100, 180, 100)).toBe(180);
    expect(remainingSeconds(100, 180, 101)).toBe(179);
    expect(remainingSeconds(100, 180, 220)).toBe(60);
    expect(remainingSeconds(100, 180, 280)).toBe(0);
    expect(remainingSeconds(null, 180, 500)).toBe(180);
  });
});
