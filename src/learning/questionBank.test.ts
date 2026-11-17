import { describe, expect, it } from 'vitest';
import { questions, topics } from './content';
import { arenaPool, questionAt, questionIndex } from './arenaRules';

function normalizedPrompt(value: string) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/\b(?:0x[0-9a-f]+|[01]{3,}|\d+)\b/g, '#')
    .replace(/[^\p{L}\p{N}#]+/gu, '');
}

describe('reviewable Computer Science question bank', () => {
  it('has unique stable IDs, unique concepts and one distinct correct answer', () => {
    const ids = new Set<string>();
    const fingerprints = new Set<string>();
    const topicIds = new Set(topics.map(topic => topic.id));

    for (const question of questions) {
      expect(topicIds.has(question.topic), question.id + ': unknown topic').toBe(true);
      expect(ids.has(question.id), question.id + ': reused ID').toBe(false);
      ids.add(question.id);

      const fingerprint = normalizedPrompt(question.prompt);
      expect(fingerprints.has(fingerprint), question.id + ': duplicate or numerical variation').toBe(false);
      fingerprints.add(fingerprint);

      expect(question.prompt.length, question.id + ': prompt too short').toBeGreaterThan(10);
      expect(question.explanation.length, question.id + ': missing explanation').toBeGreaterThan(12);
      expect(question.choices, question.id + ': expected four answer choices').toHaveLength(4);
      expect(new Set(question.choices.map(c => c.trim().toLowerCase())).size,
        question.id + ': repeated answer choice').toBe(4);
      expect(question.answer, question.id + ': invalid answer index').toBeGreaterThanOrEqual(0);
      expect(question.answer, question.id + ': invalid answer index').toBeLessThan(4);
    }
    expect(ids.size).toBe(questions.length);
    expect(fingerprints.size).toBe(questions.length);
  });

  it('covers all 30 topics with several non-template questions each', () => {
    expect(topics).toHaveLength(30);
    for (const topic of topics) {
      const matches = questions.filter(question => question.topic === topic.id);
      expect(matches.length, topic.title).toBeGreaterThanOrEqual(7);
    }
  });

  it('visits each topic-bank question once before repeating', () => {
    for (const unit of ['all', ...new Set(topics.map(t => t.unit))]) {
      const pool = arenaPool(unit);
      for (const seed of [0, 11, 92]) {
        const received = Array.from({ length: pool.length }, (_, cursor) =>
          questionAt(unit, seed, cursor).id);
        expect(new Set(received).size, unit + ': incomplete question rotation').toBe(pool.length);
        expect(questionAt(unit, seed, pool.length).id).toBe(questionAt(unit, seed, 0).id);
      }
    }
    // A fixed step of 7 would incorrectly visit only 1/7th of these banks.
    expect(new Set(Array.from({ length: 14 }, (_, cursor) =>
      questionIndex(14, 3, cursor))).size).toBe(14);
  });
});
