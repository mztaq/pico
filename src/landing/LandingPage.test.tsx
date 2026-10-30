// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import LandingPage from './LandingPage';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render() { await act(async () => root.render(<LandingPage />)); }
describe('Pico public landing', () => {
  it('uses the actual Pico logo and exact introduction', async () => {
    await render();
    expect(container.querySelector('.lp-brand img')?.getAttribute('src')).toBe('/pico-logo.svg');
    expect(container.querySelector('h1')?.textContent).toBe('A project for students built by students.');
    expect(container.textContent).toContain('A helpful computer science tool to support learning and academic thriving.');
  });
  it('points users to the studio and a verified hosted installer', async () => {
    await render();
    const links=[...container.querySelectorAll('a')];
    expect(links.find(a=>a.textContent?.includes('Use Pico in browser'))?.getAttribute('href')).toBe('/app');
    expect(links.find(a=>a.textContent?.includes('Download the Pico app'))?.getAttribute('href')).toBe('/downloads/Pico_x64-setup.exe');
    expect(links.find(a=>a.textContent?.includes('Meet the Pico team'))?.getAttribute('href')).toBe('/app#team');
  });
  it('lists only confirmed workspaces', async () => {
    await render();
    for(const name of ['Pseudocode','Python','Flowcharts','Logic Sim','CPU Studio','Binary Lab']) {
      expect(container.textContent).toContain(name);
    }
  });
});
