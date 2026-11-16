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

it('routes packets across the network and reassembles them by number', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LearningVisual topicId="transmission" />));
    const send = () => [...host.querySelectorAll('button')].find(item => item.textContent === 'Send message')!;
    const reassemble = () => [...host.querySelectorAll('button')].find(item => item.textContent?.includes('Reassemble'))!;
    await act(async () => send().click());
    expect(host.textContent).toContain('Packets sent');
    expect(host.textContent).toContain('Order of arrival');
    expect(host.querySelectorAll('.learning-packet-log li').length).toBeGreaterThan(0);
    await act(async () => reassemble().click());
    expect(host.textContent).toContain('Rebuilt message: HELLO PICO');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

it('drops a packet when every route to a broken router is blocked', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LearningVisual topicId="transmission" />));
    for (const id of ['R1', 'R2']) await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label^="${id},"]`)!.click());
    expect(host.textContent).toContain('0 routes currently open');
    const send = () => [...host.querySelectorAll('button')].find(item => item.textContent === 'Send message')!;
    await act(async () => send().click());
    expect(host.textContent).toContain('packet dropped');
    expect(host.textContent).toContain('never arrived');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

it('detects a single-bit parity error but misses a two-bit error', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<LearningVisual topicId="error-detection" />));
    const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent === label)!;
    await act(async () => button('Simulate a single-bit error').click());
    expect(host.textContent).toContain('Parity check fails');
    await act(async () => button('Simulate a two-bit error').click());
    expect(host.textContent).toContain('Parity check passes');
    expect(host.textContent).toContain('slip through undetected');
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
