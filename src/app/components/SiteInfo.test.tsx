// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

let host: HTMLDivElement;
let root: Root;

async function navigate(hash: string) {
  await act(async () => {
    window.history.pushState(null, '', hash || window.location.pathname);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '' })));
  localStorage.clear();
  window.history.replaceState(null, '', window.location.pathname);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.history.replaceState(null, '', window.location.pathname);
  vi.unstubAllGlobals();
});

it('opens the Authors link and supports direct links to all information pages', async () => {
  await act(async () => root.render(<App />));
  expect(host.querySelector('a[href="#authors"]')?.textContent).toBe('Authors');
  await navigate('#authors');
  expect(document.title).toBe('Pico | Authors');
  const cards = [...host.querySelectorAll('.author-card')];
  expect(cards.map(card => card.querySelector('h2')?.textContent)).toEqual(['Muhammad Mustaqim 11BR', 'Amar Ayache 11BB', 'Mohamed Hamza 11BR']);
  expect(cards.map(card => card.querySelector('.author-description')?.textContent)).toEqual(['Implements features and manages deployment and releases.', 'Built Pico’s foundation and guides its development.', 'Develops concepts and supports marketing and promotion.']);
  expect(cards.map(card => [...card.querySelectorAll('.author-roles li')].map(role => role.textContent))).toEqual([['Head of Deployment', 'Media Manager'], ['Head of Development', 'Media Manager'], ['Concept Developer', 'Media Manager']]);
  expect(host.querySelectorAll('.author-icon svg')).toHaveLength(3);
  expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe('Authors');
  expect(document.activeElement).toBe(host.querySelector('h1'));
  expect(host.querySelector('a[aria-label="Pico home"]')?.getAttribute('href')).toBe('#');
  await navigate('');
  expect(host.querySelector('.compiler-choices')).not.toBeNull();
  expect(document.title).toBe('Pico | Home');
});

it.each([
  ['#privacy', 'Privacy Policy', 'Service and storage'],
  ['#terms', 'Terms and Conditions', 'Your work'],
] as const)('loads %s on first entry and preserves saved projects', async (hash, title, section) => {
  const savedProjects = JSON.stringify([{ id: 'untouched', code: 'OUTPUT 42' }]);
  localStorage.setItem('pico.projects.v1', savedProjects);
  window.history.replaceState(null, '', hash);
  await act(async () => root.render(<App />));
  expect(host.querySelector('h1')?.textContent).toBe(title);
  expect(document.title).toBe(`Pico | ${title}`);
  expect([...host.querySelectorAll('h2')].some(heading => heading.textContent === section)).toBe(true);
  expect(localStorage.getItem('pico.projects.v1')).toBe(savedProjects);
  expect(host.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-24');
});

it('keeps policy navigation, focus, scroll and the selected theme consistent', async () => {
  localStorage.setItem('pico.settings.v6', JSON.stringify({ theme: 'high-contrast-light' }));
  window.history.replaceState(null, '', '#terms');
  await act(async () => root.render(<App />));
  const page = host.querySelector<HTMLElement>('.site-info-page')!;
  expect(page.getAttribute('data-pico-theme')).toBe('high-contrast-light');
  expect(page.getAttribute('data-high-contrast')).toBe('true');
  expect(host.querySelector('.site-info-section a[href="#privacy"]')).not.toBeNull();
  page.scrollTop = 400;
  await navigate('#privacy');
  expect(page.scrollTop).toBe(0);
  expect(document.activeElement).toBe(host.querySelector('h1'));
  expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe('Privacy Policy');
  expect(host.textContent).toContain("Cloudflare");
  expect(host.textContent).toContain("Google Fonts");
  expect(host.querySelector('a[href*="github.com"]')).toBeNull();
  expect(host.textContent).toContain('Analytics');
});
