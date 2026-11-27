// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../App';

let host: HTMLDivElement;
let root: Root;

async function navigate(path: string) {
  await act(async () => {
    window.history.pushState(null, '', path || '/app');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

async function renderApp() {
  await act(async () => root.render(<App />));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '' })));
  localStorage.clear();
  window.history.replaceState(null, '', '/app');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.history.replaceState(null, '', '/app');
  vi.unstubAllGlobals();
});

it('opens Pico Team above the preserved home and keeps founder/concept content', async () => {
  await renderApp();
  const opener = host.querySelector<HTMLAnchorElement>('.pico-home a[href="/app/team"]')!;
  expect(opener.textContent).toBe('Pico Team');
  opener.focus();
  await navigate('/app/team');
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
  expect(dialog.querySelectorAll('.site-info-links, .site-info-toc')).toHaveLength(0);
  expect(dialog.querySelectorAll('a[href^="#"]')).toHaveLength(0);
  expect([...host.querySelectorAll<HTMLAnchorElement>('.pico-home .site-info-links a')].map(link => link.getAttribute('href'))).toEqual([
    '/app/team', '/app/privacy', '/app/cookies', '/app/terms', '/app/ai-usage',
  ]);
  expect(document.activeElement).toBe(dialog.querySelector('h1'));

  await act(async () => dialog.querySelector<HTMLButtonElement>('.site-info-dialog-close')?.click());
  expect(host.querySelector('.site-info-backdrop')).toBeNull();
  expect(host.querySelector('.compiler-choices')).not.toBeNull();
  expect(window.location.pathname).toBe('/app');
  expect(document.title).toBe('Pico | Home');
  expect(document.activeElement).toBe(opener);
});

it.each([
  ['/app/privacy', 'Privacy Policy', 'Service and storage'],
  ['/app/terms', 'Terms and Conditions', 'Your work'],
  ['/app/cookies', 'Cookie Policy', 'Essential storage'],
  ['/app/ai-usage', 'Copyright & AI Usage', '1. Copyright and ownership'],
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
  expect(dialog.querySelector('time')?.getAttribute('dateTime')).toBe(hash === '/app/privacy' ? '2026-11-27' : hash === '/app/ai-usage' ? '2026-11-14' : '2026-10-24');
  expect(host.querySelector('.pico-home')).not.toBeNull();
});

it('discloses current workspace analytics and separately submitted reports', async () => {
  window.history.replaceState(null, '', '/app/privacy');
  await renderApp();
  const page = host.querySelector('.site-info-page')!;
  expect(page.textContent).toContain('Binary Lab and Traffic Storm');
  expect(page.textContent).toContain('Learn and Games do not have separate workspace-time tracking');
  expect(page.textContent).toContain('Traffic Storm and SQL Playground');
  expect(page.textContent).toContain('not database contents, table or field names, imported files, SQL statements or query results');
  expect(page.textContent).toContain('through Resend');
  expect(page.textContent).toContain('Cloudflare Turnstile');
  expect(page.textContent).toContain('Pico MCP');
});
it('displays only the requested policy, scroll area, focus and saved theme', async () => {
  localStorage.setItem('pico.settings.v6', JSON.stringify({ theme: 'high-contrast-light' }));
  window.history.replaceState(null, '', '/app/terms');
  await renderApp();
  const page = host.querySelector<HTMLElement>('.site-info-page')!;
  expect(page.getAttribute('data-pico-theme')).toBe('high-contrast-light');
  expect(page.getAttribute('data-high-contrast')).toBe('true');
  expect(page.querySelector('.site-info-section .site-info-policy-reference')?.textContent).toBe('Privacy Policy');
  expect(page.querySelectorAll('.site-info-aside, .site-info-links, .site-info-toc, a[href^="#"]')).toHaveLength(0);
  const scrollArea = page.querySelector<HTMLElement>('.site-info-dialog-scroll')!;
  expect(scrollArea).not.toBeNull();
  expect(document.activeElement).toBe(page.querySelector('h1'));
  expect(page.textContent).toContain('These terms may change');
  expect(page.textContent).not.toContain('Cloudflare');
  expect(page.textContent).not.toContain('Google Fonts');
  expect(page.querySelector('a[href*="github.com"]')).toBeNull();
});

it('closes via Escape and backdrop, but not when clicking the dialog', async () => {
  await renderApp();
  const opener = host.querySelector<HTMLAnchorElement>('.pico-home a[href="/app/privacy"]')!;
  opener.focus();
  await navigate('/app/privacy');
  const dialog = host.querySelector<HTMLElement>('.site-info-dialog')!;
  await act(async () => dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(host.querySelector('.site-info-dialog')).not.toBeNull();
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(host.querySelector('.site-info-dialog')).toBeNull();
  expect(document.activeElement).toBe(opener);

  await navigate('/app/cookies');
  const newBackdrop = host.querySelector<HTMLElement>('.site-info-backdrop')!;
  await act(async () => newBackdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(host.querySelector('.site-info-dialog')).toBeNull();
});

it('shows one policy at a time and requires closing it before opening another from home', async () => {
  await renderApp();
  const privacyLink = host.querySelector<HTMLAnchorElement>('.pico-home a[href="/app/privacy"]')!;
  privacyLink.focus();
  await navigate('/app/privacy');
  const firstDialog = host.querySelector<HTMLElement>('.site-info-dialog')!;
  expect(firstDialog.querySelector('h1')?.textContent).toBe('Privacy Policy');
  expect(firstDialog.querySelectorAll('.site-info-aside, .site-info-links, .site-info-toc')).toHaveLength(0);
  expect(firstDialog.querySelectorAll('a[href]')).toHaveLength(0);

  const close = firstDialog.querySelector<HTMLButtonElement>('.site-info-dialog-close')!;
  close.focus();
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(close);

  await act(async () => close.click());
  expect(host.querySelector('.site-info-dialog')).toBeNull();
  expect(document.activeElement).toBe(privacyLink);

  const cookieLink = host.querySelector<HTMLAnchorElement>('.pico-home a[href="/app/cookies"]')!;
  cookieLink.focus();
  await navigate('/app/cookies');
  const cookieDialog = host.querySelector<HTMLElement>('.site-info-dialog')!;
  expect(cookieDialog.querySelector('h1')?.textContent).toBe('Cookie Policy');
  expect(host.querySelectorAll('.site-info-backdrop')).toHaveLength(1);
  expect(cookieDialog.querySelectorAll('a[href]')).toHaveLength(0);
});

it('opens Copyright & AI Usage from the home footer without replacing the homepage', async () => {
  await renderApp();
  const home = host.querySelector('.pico-home');
  const link = host.querySelector<HTMLAnchorElement>('.site-info-links a[href="/app/ai-usage"]')!;
  link.focus();
  await act(async () => link.click());
  const dialog = host.querySelector<HTMLElement>('.site-info-dialog[data-page="ai-usage"]')!;
  expect(window.location.pathname).toBe('/app/ai-usage');
  expect(dialog.querySelector('h1')?.textContent).toBe('Copyright & AI Usage');
  expect(dialog.querySelectorAll('.site-info-section')).toHaveLength(7);
  expect(dialog.textContent).toContain('Amar Abdelhak Ayache');
  expect(dialog.querySelector('a[href="/robots.txt"]')).not.toBeNull();
  expect(host.querySelector('.pico-home')).toBe(home);
  expect(host.querySelector('.site-info-home-underlay[inert]')).not.toBeNull();
  await act(async () => dialog.querySelector<HTMLButtonElement>('.site-info-dialog-close')?.click());
  expect(window.location.pathname).toBe('/app');
  expect(host.querySelector('.site-info-dialog')).toBeNull();
  expect(host.querySelector('.pico-home')).toBe(home);
  expect(document.activeElement).toBe(link);
});
