// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LearningHub } from './LearningHub';

const host = document.createElement('div');
const root = createRoot(host);
afterEach(async () => { await act(async () => root.render(<></>)); host.remove(); vi.unstubAllGlobals(); });

function button(label: string) {
  const found = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label));
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

it('guides a learner through sound before showing topic practice', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  document.body.append(host);
  await act(async () => root.render(<LearningHub onBack={() => {}} onOpenTool={() => {}} onStartCode={() => {}} />));
  expect(host.textContent).not.toContain('Source: CS.zip');
  expect(host.textContent).not.toContain('Practise this topic');
  await act(async () => button('Text, sound and images').click());
  expect(host.textContent).toContain('Lesson 1 of 5');
  await act(async () => button('Next: Worked example').click());
  await act(async () => button('Next: Explore').click());
  expect(host.querySelector('.learning-sound-chart')).not.toBeNull();
  await act(async () => button('Next: Now try').click());
  await act(async () => button('Finish lesson').click());
  expect(host.textContent).toContain('Practise this topic (2)');
});
