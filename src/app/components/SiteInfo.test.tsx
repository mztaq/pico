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

it('shows both co-founders and concept developers with their roles', async () => {
  await act(async () => root.render(<App />));
  expect(host.querySelector('a[href="#team"]')?.textContent).toBe('Pico Team');
  await navigate('#team');
  expect(document.title).toBe('Pico | Pico Team');
  const cards = [...host.querySelectorAll('.author-card')];
  expect(cards.map(card => card.querySelector('h3')?.textContent)).toEqual([
    'Muhammad Mustaqim', 'Amar Ayache', 'Mohamed Hamza', 'Mithunan Yogeswaran', 'Coming soon...', 
  ]);
  expect(cards.map(card => card.querySelector('.author-description')?.textContent)).toEqual([
    'I manage Pico’s deployments and help build new features with Amar’s approval. We also consider suggestions from our concept developers.',
    'Mustaqim and I build Pico side by side, review changes, and merge pull requests. We also consider suggestions from our concept developers.',
    'I bring new ideas for Pico and share practical ways to make it better, reach more people, and grow into a product used around the world.',
    'I work with Hamza to explore new possibilities for Pico and suggest creative improvements to its features and user experience. I want to help Pico grow worldwide.',
    'Another spot for a future Pico concept developer.',
  ]);
  expect(cards.map(card => [...card.querySelectorAll('.author-roles li')].map(role => role.textContent))).toEqual([
    ['Head of Deployment', 'Backend Dev', 'Media Manager'],
    ['Head of Development', 'Frontend Dev', 'Media Manager'],
    ['Concept Developer'],
    ['Concept Developer'],
    ['Concept Developer'],
  ]);
  expect(cards.map(card => card.classList.contains('author-card--founder'))).toEqual([true, true, false, false, false]);
  expect([...host.querySelectorAll('.team-group-title')].map(heading => heading.textContent)).toEqual(['Co-founders', 'Concept Developers']);
  expect(host.querySelectorAll('.author-founder-label')).toHaveLength(0);
  expect(host.querySelectorAll('.author-index')).toHaveLength(0);
  expect(cards.every(card => card.querySelector('.author-roles')?.compareDocumentPosition(card.querySelector('.author-description')!) === Node.DOCUMENT_POSITION_PRECEDING)).toBe(true);
  expect(host.textContent).not.toMatch(/11BR|11BB/);
  expect(host.querySelectorAll('.author-icon')).toHaveLength(0);
  expect(host.querySelector('a[aria-current="page"]')?.textContent).toBe('Pico Team');
  expect(document.activeElement).toBe(host.querySelector('h1'));
  expect(host.querySelector('a[aria-label="Pico home"]')?.getAttribute('href')).toBe('#');
  expect(host.querySelectorAll('.site-info-links a')).toHaveLength(4);
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
  expect(host.textContent).toContain('analytics');
});
