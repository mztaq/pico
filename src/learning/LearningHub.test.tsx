// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LearningHub, sectionFromSearch } from './LearningHub';
import { getTheme } from '../app/themes';

const host = document.createElement('div');
const root = createRoot(host);
afterEach(async () => { await act(async () => root.render(<></>)); host.remove(); vi.unstubAllGlobals(); });

function button(label: string) {
  const found = [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label));
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

it('shows a focused tool chooser then full notes without a tab bar', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState(null, '', '/app/learn');
  document.body.append(host);
  await act(async () => root.render(<LearningHub onBack={() => {}} onOpenTool={() => {}} onStartCode={() => {}} />));
  expect(host.querySelector('.learn-landing-game')).not.toBeNull();
  expect(host.textContent).toContain('Notes');
  expect(host.textContent).toContain('Circuit Clash');
  expect(host.textContent).toContain('Report a Bug');
  expect(host.querySelector('.learning-catalogue')).toBeNull();
  await act(async () => button('Notes').click());
  expect(host.querySelector('.learn-landing')).toBeNull();
  expect(window.location.search).toBe('?section=notes');
  expect(host.textContent).not.toContain('Study notes, made practical');
  expect(host.textContent).not.toContain('Learn a concept. Try it in Pico.');
  expect(host.textContent).not.toContain('Classroom');
  expect(host.querySelectorAll('.learning-sections button')).toHaveLength(0);
  expect(host.textContent).toContain('Key points');
  expect(host.textContent).toContain('Worked example');
  expect(host.textContent).toContain('Interactive example');
  expect(host.querySelector('.learning-note-list')?.querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
  expect(host.textContent).toContain('Practice questions (7)');

  await act(async () => button('Text, sound and images').click());
  expect(host.querySelector('.learning-sound-chart')).not.toBeNull();
  expect(host.textContent).toContain('A bitmap image is made from pixels.');
  expect(host.textContent).toContain('8 × 3 = 24 bits');
  expect(host.textContent).toContain('Try it yourself');

  await act(async () => button('Practice questions (7)').click());
  expect(host.textContent).toContain('Question 1 of 7');
  await act(async () => button('Exit practice').click());
  expect(host.textContent).toContain('Worked example');
});

it('updates Learn panels when Pico theme settings change without remounting', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const saved = localStorage.getItem('pico.settings.v6');
  document.body.append(host);
  try {
    localStorage.setItem('pico.settings.v6', JSON.stringify({ theme: 'catppuccin-mocha' }));
    await act(async () => root.render(<LearningHub onBack={() => {}} onOpenTool={() => {}} onStartCode={() => {}} />));
    const learn = host.querySelector<HTMLElement>('.learning-hub')!;
    expect(learn.style.getPropertyValue('--ds-panel')).toBe(getTheme('catppuccin-mocha').ui.surfaceRaised);
    await act(async () => {
      localStorage.setItem('pico.settings.v6', JSON.stringify({ theme: 'catppuccin-latte' }));
      window.dispatchEvent(new Event('pico:settings-saved'));
    });
    expect(learn.style.getPropertyValue('--ds-panel')).toBe(getTheme('catppuccin-latte').ui.surfaceRaised);
    expect(learn.style.colorScheme).toBe('light');
    expect(learn.style.getPropertyValue('--ds-text')).toBe(getTheme('catppuccin-latte').text);
  } finally {
    if (saved === null) localStorage.removeItem('pico.settings.v6');
    else localStorage.setItem('pico.settings.v6', saved);
  }
});

it('opens each homepage destination through a shareable Learn URL', () => {
  for (const section of ['notes', 'arena'] as const) {
    expect(sectionFromSearch('?section=' + section)).toBe(section);
    expect(sectionFromSearch('?ref=home&section=' + section)).toBe(section);
  }
  expect(sectionFromSearch('?section=notes')).toBe('notes');
  expect(sectionFromSearch('?section=unknown')).toBeNull();
  expect(sectionFromSearch('')).toBeNull();
});

it('returns from an individual tool to the learning chooser', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.history.replaceState(null, '', '/app/learn');
  document.body.append(host);
  await act(async () => root.render(<LearningHub onBack={() => {}} onOpenTool={() => {}} onStartCode={() => {}} />));
  await act(async () => button('Play Pico Arena').click());
  expect(window.location.search).toBe('?section=arena&mode=circuit');
  expect(host.querySelector('.learn-landing')).toBeNull();
  expect(host.querySelector('.learning-feature')).not.toBeNull();
  await act(async () => button('All tools').click());
  expect(window.location.pathname + window.location.search).toBe('/app/learn');
  expect(host.querySelector('.learn-landing-game')).not.toBeNull();
  expect(host.querySelector('.learning-feature')).toBeNull();
});
