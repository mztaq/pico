import { questions } from './content';

export type Progress = { attempts: Record<string, { correct: number; total: number }>; missed: string[] };
const KEY = 'pico.learning.progress.v1';
const empty = (): Progress => ({ attempts: {}, missed: [] });

export function readProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!value || typeof value !== 'object' || !value.attempts || !Array.isArray(value.missed)) return empty();
    const ids = new Set(questions.map(question => question.id));
    return { attempts: value.attempts, missed: value.missed.filter((id: unknown) => typeof id === 'string' && ids.has(id)) };
  } catch { return empty(); }
}

export function recordAnswer(progress: Progress, id: string, correct: boolean): Progress {
  const previous = progress.attempts[id] ?? { correct: 0, total: 0 };
  const missed = new Set(progress.missed);
  if (correct) missed.delete(id);
  else missed.add(id);
  return {
    attempts: { ...progress.attempts, [id]: { correct: previous.correct + Number(correct), total: previous.total + 1 } },
    missed: [...missed],
  };
}

export function saveProgress(progress: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* Practice remains usable without browser storage. */ }
}
