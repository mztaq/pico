// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LearningVisual } from './LearningVisuals';

it('updates the binary readout when a bit is switched', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LearningVisual topicId="number-systems" />));
    expect(host.textContent).toContain('Denary 45');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Bit worth 1"]')!.click());
    expect(host.textContent).toContain('Denary 44');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

it('reassembles received packets by their numbers', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LearningVisual topicId="transmission" />));
    const action = () => host.querySelector<HTMLButtonElement>('.learning-actions button')!;
    await act(async () => action().click());
    expect(host.textContent).toContain('Arrival order: 2, 1, 3');
    await act(async () => action().click());
    expect(host.textContent).toContain('Rebuilt message: PICO!');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
