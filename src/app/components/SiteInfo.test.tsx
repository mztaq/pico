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

async function renderApp() {
  await act(async () => root.render(<App />));
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

it('opens Pico Team above the preserved home and keeps founder/concept content', async () => {
  await renderApp();
  const opener = host.querySelector<HTMLAnchorElement>('.pico-home a[href="#team"]')!;
  expect(opener.textContent).toBe('Pico Team');
  opener.focus();
  await navigate('#team');
  expect(document.title).toBe('Pico | Pico Team');
  expect(host.querySelector('.compiler-choices')).not.toBeNull();
  expect(host.querySelector('.site-info-home-underlay[inert][aria-hidden="true"]')).not.toBeNull();
  expect(host.querySelector('.site-info-backdrop')).not.toBeNull();
  expect(host.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
  const dialog = host.querySelector<HTMLElement>('.site-info-dialog')!;
  const cards = [...dialog.querySelectorAll('.author-card')];
  expect(cards.map(card => card.querySelector('h3')?.textContent)).toEqual([
    'Muhammad Mustaqim', 'Amar Ayache', 'Mohamed Hamza', 'Mithunan Yogeswaran', 'Coming soon...',
  ]);
  expect(cards.map(card => card.querySelector('.author-description')?.textContent)).toEqual([
    'I manage Pico’s deployments and help build new features with Amar’s approval. We also consider suggestions from our concept developers.',
    'Mustaqim and I build Pico side by side, review changes, and merge pull requests. We also consider suggestions from our concept developers.',
    'I bring new ideas for Pico and share practical ways to make it better, reach more people, and grow into a product used around the world.',
    'I work with Hamza to explore new ideas and suggest improvements to Pico’s features and user experience, helping it grow worldwide.',
    'Another spot for a future Pico concept developer.',
  ]);
  expect(cards.map(card => [...card.querySelectorAll('.author-roles li')].map(role => role.textContent))).toEqual([
    ['Head of Deployment', 'Backend Dev', 'Media Manager'],
    ['Head of Development', 'Frontend Dev', 'Media Manager'],
    ['Concept Developer', 'Outreach'],
    ['Concept Developer', 'UX Feedback'],
    ['Concept Developer'],
  ]);
  expect(cards.map(card => card.classList.contains('author-card--founder'))).toEqual([true, true, false, false, false]);
  expect([...dialog.querySelectorAll('.team-group-title')].map(heading => heading.textContent)).toEqual(['Co-founders', 'Concept Developers']);
  expect(dialog.textContent).not.toMatch(/11BR|11BB/);
  expect(dialog.querySelectorAll('.site-info-links a')).toHaveLength(4);
  expect(document.activeElement).toBe(dialog.querySelector('h1'));

  await act(async () => dialog.querySelector<HTMLButtonElement>('.site-info-dialog-close')?.click());
  expect(host.querySelector('.site-info-backdrop')).toBeNull();
  expect(host.querySelector('.compiler-choices')).not.toBeNull();
  expect(window.location.hash).toBe('');
  expect(document.title).toBe('Pico | Home');
  expect(document.activeElement).toBe(opener);
});

it.each([
  ['#privacy', 'Privacy Policy', 'Service and storage'],
  ['#terms', 'Terms and Conditions', 'Your work'],
  ['#cookies', 'Cookie Policy', 'Essential storage'],
] as const)('opens %s as a dimmed dialog on initial entry without losing saved work', async (hash, title, section) => {
  const savedProjects = JSON.stringify([{ id: 'untouched', code: 'OUTPUT 42' }]);
  localStorage.setItem('pico.projects.v1', savedProjects);
  window.history.replaceState(null, '', hash);
  await renderApp();
  const dialog = host.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')!;
  expect(dialog.getAttribute('aria-labelledby')).toBe('pico-info-dialog-title');
  expect(dialog.querySelector('h1')?.textContent).toBe(title);
  expect(document.title).toBe(`Pico | ${title}`);
  expect([...dialog.querySelectorAll('h2')].some(heading => heading.textContent === section)).toBe(true);
  expect(localStorage.getItem('pico.projects.v1')).toBe(savedProjects);
  expect(dialog.querySelector('time')?.getAttribute('dateTime')).toBe('2026-10-24');
  expect(host.querySelector('.pico-home')).not.toBeNull();
});

it('keeps policy navigation, modal scrolling, focus and saved theme', async () => {
  localStorage.setItem('pico.settings.v6', JSON.stringify({ theme: 'high-contrast-light' }));
  window.history.replaceState(null, '', '#terms');
  await renderApp();
  const page = host.querySelector<HTMLElement>('.site-info-page')!;
  expect(page.getAttribute('data-pico-theme')).toBe('high-contrast-light');
  expect(page.getAttribute('data-high-contrast')).toBe('true');
  expect(page.querySelector('.site-info-section a[href="#privacy"]')).not.toBeNull();
  const scrollArea = page.querySelector<HTMLElement>('.site-info-dialog-scroll')!;
  scrollArea.scrollTop = 400;
  await navigate('#privacy');
  expect(scrollArea.scrollTop).toBe(0);
  expect(document.activeElement).toBe(page.querySelector('h1'));
  expect(page.querySelector('a[aria-current="page"]')?.textContent).toBe('Privacy Policy');
  expect(page.textContent).toContain('Cloudflare');
  expect(page.textContent).toContain('Google Fonts');
  expect(page.querySelector('a[href*="github.com"]')).toBeNull();
});

it('closes via Escape and backdrop, but not when clicking the dialog', async () => {
  await renderApp();
  const opener = host.querySelector<HTMLAnchorElement>('.pico-home a[href="#privacy"]')!;
  opener.focus();
  await navigate('#privacy');
  const dialog = host.querySelector<HTMLElement>('.site-info-dialog')!;
  const backdrop = host.querySelector<HTMLElement>('.site-info-backdrop')!;
  await act(async () => dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(host.querySelector('.site-info-dialog')).not.toBeNull();
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(host.querySelector('.site-info-dialog')).toBeNull();
  expect(document.activeElement).toBe(opener);

  await navigate('#cookies');
  const newBackdrop = host.querySelector<HTMLElement>('.site-info-backdrop')!;
  await act(async () => newBackdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(host.querySelector('.site-info-dialog')).toBeNull();
});

it('keeps Tab focus inside the dialog and supports switching policies with hash links', async () => {
  await renderApp();
  await navigate('#cookies');
  const dialog = host.querySelector<HTMLElement>('.site-info-dialog')!;
  const close = dialog.querySelector<HTMLButtonElement>('.site-info-dialog-close')!;
  const links = [...dialog.querySelectorAll<HTMLElement>('a[href]')];
  const last = links.at(-1)!;
  last.focus();
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(close);
  await navigate('#privacy');
  expect(host.querySelector('.site-info-dialog')).toBe(dialog);
  expect(dialog.querySelector('h1')?.textContent).toBe('Privacy Policy');
  expect(dialog.querySelector('a[aria-current="page"]')?.textContent).toBe('Privacy Policy');
});
