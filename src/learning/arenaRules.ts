import { questions, topics, type Question } from './content';

export const ARENA_COLUMNS = 5;
export const ARENA_ROWS = 4;
export const ARENA_TILES = ARENA_COLUMNS * ARENA_ROWS;
export const ARENA_ROOM_CAPACITY = 30;
export const ARENA_ROUND_SECONDS = 180;

export type ArenaAction = 'capture' | 'fortify' | 'amplify';
export type ArenaQuestion = Pick<Question, 'id' | 'prompt' | 'choices' | 'topic'>;
export type ArenaNode = { pos: number; ownerId: string | null; level: number };
export type ArenaPlayer = {
  id: string;
  nickname: string;
  charge: number;
  streak: number;
  amplifier: number;
  correct: number;
  answered: number;
  score: number;
  owned: number;
  color: number;
};

export const arenaUnits = ['all', ...new Set(topics.map(topic => topic.unit))];
const topicUnits = new Map(topics.map(topic => [topic.id, topic.unit]));

export function arenaPool(unit: string): Question[] {
  return unit === 'all'
    ? questions
    : questions.filter(question => topicUnits.get(question.topic) === unit);
}

/**
 * Walk the complete question pool before repeating anything.
 * The step is coprime to the pool size so no subset is accidentally skipped.
 */
export function questionIndex(length: number, seed: number, cursor: number): number {
  if (!Number.isSafeInteger(length) || length < 1) throw Error('Question bank is empty.');
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  let step = 7;
  while (gcd(step, length) !== 1) step += 2;
  return ((seed % length + length) % length + (cursor % length) * step) % length;
}

export function questionAt(unit: string, seed: number, cursor: number): Question {
  const pool = arenaPool(unit);
  return pool[questionIndex(pool.length, seed, cursor)]!;
}

export function visibleQuestion(question: Question): ArenaQuestion {
  return { id: question.id, prompt: question.prompt, choices: question.choices, topic: question.topic };
}

export function answerReward(isCorrect: boolean, streak: number, amplifier: number) {
  const nextStreak = isCorrect ? Math.min(streak + 1, 100) : 0;
  return {
    charge: isCorrect ? 25 + Math.min(nextStreak, 4) * 5 + amplifier * 8 : 0,
    streak: nextStreak,
    correct: Number(isCorrect),
  };
}

export function nodeCost(action: ArenaAction, node?: ArenaNode): number | null {
  if (action === 'amplify') return null;
  if (!node) return null;
  if (action === 'fortify') return node.ownerId !== null && node.level < 3
    ? 40 + node.level * 25 : null;
  if (node.ownerId === null) return 35;
  return 75 + (node.level - 1) * 35;
}

/** Hacker Heist emphasises cheaper breaching. Circuit Clash rewards careful investment. */
export function modeNodeCost(mode: 'classic' | 'circuit' | 'hacker' | 'sprint',
  action: ArenaAction, node?: ArenaNode): number | null {
  if (mode === 'hacker' && node) {
    if (action === 'capture') {
      return node.ownerId === null ? 25 : 55 + (node.level - 1) * 20;
    }
    if (action === 'fortify') return node.ownerId !== null && node.level < 3
      ? 30 + node.level * 20 : null;
  }
  return nodeCost(action, node);
}

/** Score is based on CURRENT board control, not farming the same tile repeatedly. */
export function scoreFor(ownedLevels: number[], correct: number, amplifier: number): number {
  return ownedLevels.reduce((sum, level) => sum + 100 + (level - 1) * 40, 0)
    + correct * 10 + amplifier * 30;
}

export function remainingSeconds(startsAt: number | null, duration: number, now: number): number {
  if (startsAt === null) return duration;
  return Math.max(0, Math.ceil((startsAt + duration - now) / 1000));
}

export function timeLabel(seconds: number): string {
  return Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0') + ':'
    + Math.max(0, seconds % 60).toString().padStart(2, '0');
}
