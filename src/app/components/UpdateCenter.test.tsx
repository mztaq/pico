// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_SEEN_UPDATE_KEY, parseChangelog, UpdateCenter } from './UpdateCenter';

let container: HTMLDivElement;
let root: Root;
const sampleLog = '[2026-10-06] : IMPROVED UI\n[2026-10-07] : ADDED LOCAL UPDATES';
const response = (contents: string) => ({ ok: true, text: async () => contents }) as Response;

async function mount() {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<UpdateCenter />));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(sampleLog)));
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.unstubAllGlobals();
});

describe('local changelog', () => {
  it('parses dated updates and ignores malformed lines and impossible dates', () => {
    expect(parseChangelog('[2026-02-29] : NOT A REAL DATE\nnot an update\n[2026-10-07] : FIXED LOGIN BUG')).toEqual([
      { id: '3:2026-10-07:FIXED LOGIN BUG', date: '2026-10-07', update: 'FIXED LOGIN BUG' },
    ]);
  });

  it('shows a new update once, stores dismissal, and does not repeat after reload', async () => {
    await mount();
    expect(container.querySelector('.update-toast')?.textContent).toContain('ADDED LOCAL UPDATES');
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Dismiss update notification"]')!.click(); });
    expect(localStorage.getItem(LAST_SEEN_UPDATE_KEY)).toBe('2:2026-10-07:ADDED LOCAL UPDATES');
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 260)); });
    expect(container.querySelector('.update-toast')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
    await mount();
    expect(container.querySelector('.update-toast')).toBeNull();
  });

  it('opens the full changelog and marks the latest entry as seen', async () => {
    await mount();
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label^="View updates"]')!.click(); });
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('IMPROVED UI');
    expect(localStorage.getItem(LAST_SEEN_UPDATE_KEY)).toBe('2:2026-10-07:ADDED LOCAL UPDATES');
  });

  it('detects a newly appended entry on the next refresh', async () => {
    await mount();
    await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="Dismiss update notification"]')!.click(); });
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 260)); });
    vi.mocked(fetch).mockResolvedValue(response(`${sampleLog}\n[2026-10-08] : FIXED LOGIN BUG`));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelector('.update-toast')?.textContent).toContain('FIXED LOGIN BUG');
  });
});

it('keeps keyboard focus within the update dialog and removes the storage captions',async()=>{
  await mount();const trigger=container.querySelector<HTMLButtonElement>('[aria-label^="View updates"]')!;trigger.focus();
  await act(async()=>trigger.click());
  expect(container.querySelector('[role="dialog"]')?.textContent).not.toMatch(/stored locally|kept right here/i);
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Close updates');
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,cancelable:true})));
  expect(document.activeElement?.textContent).toBe('Done');
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));
  expect(container.querySelector('[role="dialog"]')).toBeNull();expect(document.activeElement).toBe(trigger);
});
