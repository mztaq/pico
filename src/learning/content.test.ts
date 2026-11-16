import { describe, expect, it } from 'vitest';
import { compile } from '../language';
import { questions, topics } from './content';
import { topicNotes } from './notes';

describe('learning content', () => {
  it('keeps every practice question linked to a note-backed topic', () => {
    const ids = new Set(topics.map(topic => topic.id));
    for (const question of questions) {
      expect(ids.has(question.topic)).toBe(true);
      expect(question.choices[question.answer]).toBeTruthy();
      expect(question.explanation).toBeTruthy();
    }
  });

  it('provides useful revision notes and examples for all existing topics', () => {
    expect(Object.keys(topicNotes)).toHaveLength(topics.length);
    for (const topic of topics) {
      const detail = topicNotes[topic.id];
      expect(detail, `Missing notes for ${topic.title}`).toBeDefined();
      expect(detail.points.length).toBeGreaterThanOrEqual(3);
      expect(detail.points.every(point => point.trim().length > 25)).toBe(true);
      expect(detail.exampleSteps?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('compiles pseudocode starter tasks', () => {
    for (const topic of topics) {
      if (topic.starter?.language === 'pseudocode') expect(() => compile(topic.starter!.code)).not.toThrow();
    }
  });
});
