import catalog from './bugs.json';

export interface Challenge {
  id: string;
  title: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  brief: string;
  hints: string[];
  starter: string;
  solution: string;
  explanation: string;
  tests: { name: string; inputs: string[]; expected: string[] }[];
}

/** Validate editable content before it reaches the workspace. Errors name the field to fix. */
export function parseChallengeCatalog(value: unknown): Challenge[] {
  function fail(path: string, message: string): never {
    throw new Error(`bugs.json: ${path} ${message}`);
  }
  function record(item: unknown, path: string): Record<string, unknown> {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(path, 'must be an object.');
    return item as Record<string, unknown>;
  }
  function text(item: unknown, path: string): string {
    if (typeof item !== 'string' || !item.trim()) fail(path, 'must be a non-empty string.');
    return item;
  }
  function strings(item: unknown, path: string): string[] {
    if (!Array.isArray(item) || !item.every(entry => typeof entry === 'string')) fail(path, 'must be an array of strings.');
    return item as string[];
  }
  const root = record(value, 'catalog');
  if (!Array.isArray(root.challenges) || !root.challenges.length) fail('challenges', 'must contain at least one challenge.');
  const ids = new Set<string>();
  return root.challenges.map((entry: unknown, index: number) => {
    const path = `challenges[${index}]`;
    const item = record(entry, path);
    const id = text(item.id, `${path}.id`);
    if (!/^[a-z][a-z0-9-]*$/.test(id) || ['constructor', 'prototype'].includes(id)) fail(`${path}.id`, 'must be a safe lowercase slug such as missing-number.');
    if (ids.has(id)) fail(`${path}.id`, `duplicates "${id}". Give each challenge a unique ID.`);
    ids.add(id);
    if (!['Easy', 'Medium', 'Hard'].includes(String(item.difficulty))) fail(`${path}.difficulty`, 'must be Easy, Medium or Hard.');
    if (!Array.isArray(item.tests) || !item.tests.length) fail(`${path}.tests`, 'must contain at least one test.');
    return {
      id,
      title: text(item.title, `${path}.title`),
      topic: text(item.topic, `${path}.topic`),
      difficulty: item.difficulty as Challenge['difficulty'],
      brief: text(item.brief, `${path}.brief`),
      hints: strings(item.hints, `${path}.hints`),
      starter: text(item.starter, `${path}.starter`),
      solution: text(item.solution, `${path}.solution`),
      explanation: text(item.explanation, `${path}.explanation`),
      tests: item.tests.map((test: unknown, testIndex: number) => {
        const testPath = `${path}.tests[${testIndex}]`;
        const input = record(test, testPath);
        return { name: text(input.name, `${testPath}.name`), inputs: strings(input.inputs, `${testPath}.inputs`), expected: strings(input.expected, `${testPath}.expected`) };
      }),
    };
  });
}

export const challenges = parseChallengeCatalog(catalog);
