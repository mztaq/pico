import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { questions, topics } from './content';

describe('learning content', () => {
  it('keeps every practice question linked to a note-backed topic', () => {
    const ids = new Set(topics.map(topic => topic.id));
    for (const question of questions) {
      expect(ids.has(question.topic)).toBe(true);
      expect(question.choices[question.answer]).toBeTruthy();
      expect(question.explanation).toBeTruthy();
    }
  });

  it('compiles pseudocode starter tasks', () => {
    for (const topic of topics) {
      if (topic.starter?.language === 'pseudocode') expect(() => compile(topic.starter!.code)).not.toThrow();
    }
  });
});
