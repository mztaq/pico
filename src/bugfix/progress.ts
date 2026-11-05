import { challenges } from './challenges';
export interface Attempt { code: string; hints: number; solved: boolean }
export type Progress = Record<string, Attempt>;
const KEY = 'pico.bugfix.v1';
export function loadProgress(): Progress {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(challenges.flatMap(challenge => {
      const item = (raw as Record<string, unknown>)[challenge.id];
      if (!item || typeof item !== 'object') return [];
      const attempt = item as Partial<Attempt>;
      if (typeof attempt.code !== 'string' || attempt.code.length > 100_000) return [];
      return [[challenge.id, { code: attempt.code, hints: typeof attempt.hints === 'number' && Number.isInteger(attempt.hints) ? Math.max(0, Math.min(challenge.hints.length, attempt.hints)) : 0, solved: attempt.solved === true }]];
    }));
  } catch { return {}; }
}
export function saveProgress(progress: Progress): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
