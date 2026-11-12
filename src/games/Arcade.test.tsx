// @vitest-environment jsdom
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Arcade, type ArcadePage } from './Arcade';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render(page: ArcadePage) {
  act(() => root.render(<StrictMode><Arcade page={page} onChoose={() => {}} onHome={() => {}} /></StrictMode>));
}

function click(name: string) {
  const button = [...container.querySelectorAll('button')].find(button =>
    (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name);
  expect(button, name).toBeDefined();
  expect(button?.disabled, name).toBe(false);
  act(() => button?.click());
}

function press(key: string) {
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key })));
}

function tick() {
  act(() => vi.advanceTimersByTime(1000));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  const canvas = {
    setTransform: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(), clearRect: vi.fn(), fillText: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => canvas);
  vi.stubGlobal('matchMedia', () => ({
    matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
  localStorage.clear();
  localStorage.setItem('pico.sound.v1', 'off');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Pico Games UI', () => {
  it('pauses Siege, awards a win once, and restores the next mission', () => {
    render('games/siege');
    click('Launch mission');
    press('w');
    click('Pause');
    tick();
    tick();
    expect(container.querySelector('progress[aria-label="Time left"]')?.getAttribute('value')).toBe('24');
    click('Resume');
    for (let time = 0; time < 12 && !container.textContent?.includes('Target down.'); time++) {
      press('q');
      press('w');
      tick();
    }
    expect(container.textContent).toContain('Target down. Coins earned.');
    expect(container.textContent).toContain('36 coins');
    render('games');
    expect(container.textContent).toContain('Continue Server Siege');
    render('games/siege');
    expect(container.querySelector('h2')?.textContent).toBe('Relay Station');
    expect(container.textContent).toContain('36 coins');
  });

  it('defaults to Low, pauses during graphics settings, and remembers Standard', () => {
    render('games/siege');
    expect(container.querySelector('canvas')?.width).toBe(440);
    click('Launch mission');
    click('Settings');
    tick();
    expect(container.querySelector('progress[aria-label="Time left"]')?.getAttribute('value')).toBe('24');
    click('Standard');
    expect(container.querySelector('canvas')?.width).toBe(880);
    click('Done');
    tick();
    expect(container.querySelector('progress[aria-label="Time left"]')?.getAttribute('value')).toBe('23');
    expect(localStorage.getItem('pico.games.graphics')).toBe('standard');
  });

  it('routes the defense, earns a wave reward, and restores a purchased proxy', () => {
    render('games/defense');
    click('Buy Reverse proxies');
    click('Start wave');
    click('Route North');
    expect([...container.querySelectorAll('[aria-pressed="true"]')].some(button => button.textContent === 'Route North')).toBe(true);
    for (let time = 0; time < 15; time++) tick();
    expect(container.textContent).toContain('Wave cleared. Budget earned.');
    expect(container.textContent).toContain('41 budget');
    render('games');
    render('games/defense');
    expect(container.querySelector('h2')?.textContent).toBe('Proxy Pressure');
    expect(container.textContent).toContain('Reverse proxies · Lv 1');
  });
});
