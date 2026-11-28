import { describe, expect, it } from 'vitest';
import { isPicoDesktopWebview, shouldRenderPicoWorkspace } from './entry-route';

describe('Pico browser and desktop entry routes', () => {
  it('shows the landing at / in a normal browser', () => {
    expect(shouldRenderPicoWorkspace('/', false)).toBe(false);
    expect(shouldRenderPicoWorkspace('/index.html', false)).toBe(false);
  });

  it('serves the full app under /app to all clients', () => {
    for (const native of [false, true]) {
      expect(shouldRenderPicoWorkspace('/app', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/cpu', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/sql', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/games', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/games/', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/algorithm', native)).toBe(true);
    }
  });

  it('renders AI Usage inside the workspace shell on browser and desktop', () => {
    for (const native of [false, true]) {
      expect(shouldRenderPicoWorkspace('/app/ai-usage', native)).toBe(true);
      expect(shouldRenderPicoWorkspace('/app/ai-usage/', native)).toBe(true);
    }
  });

  it('preserves / as the workspace for previously shipped Tauri installers', () => {
    expect(isPicoDesktopWebview({ __TAURI_INTERNALS__: { plugins: {} } })).toBe(true);
    expect(isPicoDesktopWebview({ isTauri: true })).toBe(true);
    expect(isPicoDesktopWebview({ isTauri: false })).toBe(false);
    expect(isPicoDesktopWebview({ __TAURI_INTERNALS__: null })).toBe(false);
    expect(shouldRenderPicoWorkspace('/', isPicoDesktopWebview({ __TAURI_INTERNALS__: {} }))).toBe(true);
  });

  it('never intercepts API, download or other website routes', () => {
    for (const path of ['/downloads/Pico_x64-setup.exe', '/api/cookies', '/application', '/about']) {
      expect(shouldRenderPicoWorkspace(path, false)).toBe(false);
      expect(shouldRenderPicoWorkspace(path, true)).toBe(false);
    }
  });
});
