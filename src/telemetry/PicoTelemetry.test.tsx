// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PicoTelemetry } from './PicoTelemetry';

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  localStorage.clear();
  document.title = 'Pico | Home';
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<PicoTelemetry />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function openSettings() {
  const button = container.querySelector<HTMLButtonElement>('.pico-cookie-banner .pico-cookie-outline');
  expect(button).not.toBeNull();
  await act(async () => button!.click());
  expect(container.querySelector('[role="dialog"]')).not.toBeNull();
}

function expectBannerRestored() {
  expect(container.querySelector('[role="dialog"]')).toBeNull();
  expect(container.querySelector('.pico-cookie-banner')).not.toBeNull();
  expect(localStorage.getItem('pico.consent.v1')).toBeNull();
}

it('lets first-time visitors close cookie settings without recording consent', async () => {
  await openSettings();
  const close = container.querySelector<HTMLButtonElement>('[aria-label="Close cookie settings"]');
  expect(close).not.toBeNull();
  await act(async () => close!.click());
  expectBannerRestored();
});

it('dismisses first-time cookie settings when clicking outside the dialog', async () => {
  await openSettings();
  const overlay = container.querySelector<HTMLElement>('.pico-cookie-overlay')!;
  await act(async () => overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expectBannerRestored();
});

it('dismisses first-time cookie settings with Escape', async () => {
  await openSettings();
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expectBannerRestored();
});
