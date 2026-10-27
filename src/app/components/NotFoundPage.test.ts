import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('../../../public/404.html', import.meta.url)), 'utf8');

it('keeps the 404 page focused on Pico, without team conversations', () => {
  expect(html).not.toContain('id="conversation"');
  expect(html).not.toContain('conversation-line');
  expect(html).not.toContain('The team is investigating.');
  const match = html.match(/const messages = (\[[\s\S]*?\]);\s*\/\/ Avoid showing the same joke/);
  expect(match).not.toBeNull();
  const messages = JSON.parse(match![1]) as [string, string][];
  expect(messages).toHaveLength(300);
  expect(new Set(messages.map(([headline, detail]) => `${headline}\u0000${detail}`)).size).toBe(300);
  expect(messages.every(([headline, detail]) => headline.startsWith('Pico') && detail.length > 0)).toBe(true);
  expect(html).toContain('Pico logic simulator confirms');
});
