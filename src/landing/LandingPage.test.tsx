// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

vi.mock('../cpu/CpuStudio', () => ({
  CpuStudio: ({landingPreview}:{landingPreview?:boolean}) => <div data-testid="live-cpu">{landingPreview?'Actual CPU Studio':'CPU Studio'}</div>,
}));

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
describe('Pico landing page', () => {
  it('uses the real Pico logo and one student-focused headline', async () => {
    await render();
    expect(container.querySelector('.lp-brand img')?.getAttribute('src')).toBe('/pico-logo.svg');
    expect(container.querySelector('h1')?.textContent).toBe('Built by Students,for Students.');
    expect(container.textContent).not.toContain('Curiosity looks');
    expect(container.textContent).not.toContain('Learn by building');
  });
  it('links to the browser app, team and download section', async () => {
    await render();
    const links=[...container.querySelectorAll('a')];
    expect(links.find(a=>a.textContent?.includes('Use Pico in browser'))?.getAttribute('href')).toBe('/app');
    expect(links.find(a=>a.textContent?.includes('Desktop downloads'))?.getAttribute('href')).toBe('#downloads');
    expect(links.find(a=>a.textContent?.includes('Pico Team'))?.getAttribute('href')).toBe('/app#team');
  });
  it('lists all six platform-specific installers', async () => {
    await render();
    const expected=[
      'Pico_x64-setup.exe','Pico_x64_en-US.msi',
      'Pico_aarch64.dmg','Pico_x64.dmg',
      'Pico_amd64.deb','Pico_amd64.AppImage',
    ];
    for(const file of expected){
      expect(container.querySelector('a[href="/downloads/'+file+'"]')).not.toBeNull();
    }
  });
  it('shows real CPU Studio, without mock product or decorative feature previews', async () => {
    await render();
    expect(container.querySelector('.lp-hero .lp-hero-cpu [data-testid="live-cpu"]')).not.toBeNull();
    expect(container.querySelector('.lp-cpu-section')).toBeNull();
    expect(container.querySelector('.lp-product-window')).toBeNull();
    expect(container.querySelector('.lp-visual-code')).toBeNull();
    expect(container.querySelector('.lp-processor-svg')).toBeNull();
  });
});
