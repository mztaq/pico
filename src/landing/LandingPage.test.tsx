// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage, { installerDownloadHref } from './LandingPage';

vi.mock('../cpu/CpuStudio', () => ({
  CpuStudio: ({landingPreview}:{landingPreview?:boolean}) => <div data-testid="live-cpu">{landingPreview?'Actual CPU Studio':'CPU Studio'}</div>,
}));

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Release metadata unavailable')));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() { await act(async () => root.render(<LandingPage />)); }
describe('Pico landing page', () => {
  it('uses the real Pico logo and one student-focused headline', async () => {
    await render();
    expect(container.querySelector('.lp-brand img')?.getAttribute('src')).toBe('/pico-logo.svg');
    expect(container.querySelector('h1')?.textContent).toBe('By thePico Team.');
    expect(container.querySelector('h1 .lp-hero-highlight')?.textContent).toBe('Pico Team.');
    expect(container.querySelector('h1 br')).not.toBeNull();
    expect(container.querySelector('.lp-hero-copy > p')?.textContent).toBe('Built by Students, for Students');
    expect(container.textContent).not.toContain('Write and run code, build flowcharts');
    expect(container.textContent).not.toContain('Curiosity looks');
    expect(container.textContent).not.toContain('Learn by building');
  });
  it('links to the browser app and download section', async () => {
    await render();
    const links=[...container.querySelectorAll('a')];
    expect(links.find(a=>a.textContent?.includes('Use Pico in browser'))?.getAttribute('href')).toBe('/app');
    expect(links.find(a=>a.textContent?.includes('Download for desktop'))?.getAttribute('href')).toBe('#downloads');
    expect(container.querySelectorAll('.lp-hero-actions a[href="/app"]')).toHaveLength(1);
    expect(container.querySelector('header.lp-header a[href="/app"]')).toBeNull();
    expect(container.querySelector('.lp-nav-start')).toBeNull();
    expect(container.querySelector('.lp-nav-mobile-cta')).toBeNull();
    expect(container.querySelectorAll('.lp-hero .lp-hero-copy')).toHaveLength(1);
    expect(container.querySelectorAll('.lp-hero .lp-hero-cpu')).toHaveLength(1);
  });
  it('keeps navbar layout stable and ignores small scroll reversals', async () => {
    Object.defineProperty(window, 'scrollY', { configurable:true, writable:true, value:0 });
    await render();
    const navbar=container.querySelector('header.lp-header');
    const slot=container.querySelector('.lp-header-slot');
    expect(navbar?.parentElement).toBe(slot);
    expect(slot?.children).toHaveLength(1);
    expect(navbar?.classList.contains('lp-header-compact')).toBe(false);
    await act(async () => {
      window.scrollY=200;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(navbar?.classList.contains('lp-header-compact')).toBe(true);
    // Small wheel or trackpad movements must not make the navbar bounce.
    for(const y of [196,200,193,198,189,192]){
      await act(async () => {
        window.scrollY=y;
        window.dispatchEvent(new Event('scroll'));
      });
      expect(navbar?.classList.contains('lp-header-compact')).toBe(true);
    }
    await act(async () => {
      window.scrollY=150;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(navbar?.classList.contains('lp-header-compact')).toBe(false);
    for(const y of [153,149,155,151]){
      await act(async () => {
        window.scrollY=y;
        window.dispatchEvent(new Event('scroll'));
      });
      expect(navbar?.classList.contains('lp-header-compact')).toBe(false);
    }
    await act(async () => {
      window.scrollY=240;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(navbar?.classList.contains('lp-header-compact')).toBe(true);
    await act(async () => {
      window.scrollY=0;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(navbar?.classList.contains('lp-header-compact')).toBe(false);
  });
  it('enables smooth anchor navigation only while landing is mounted', async () => {
    await render();
    expect(document.documentElement.classList.contains('pico-landing-scroll')).toBe(true);
    expect(container.querySelector('a[href="#features"]')).not.toBeNull();
    expect(container.querySelector('a[href="#downloads"]')).not.toBeNull();
    expect(container.querySelector('header.lp-header a[href="/mcp-docs"]')?.textContent).toBe('MCP Docs');
  });
  it('uses only one small copyright line in the footer', async () => {
    await render();
    const footer=container.querySelector('footer.lp-footer');
    expect(footer?.querySelector('small')?.textContent)
      .toBe('© 2026 Pico Development Team. All rights reserved.');
    expect(footer?.querySelectorAll('a')).toHaveLength(0);
    expect(footer?.querySelector('img')).toBeNull();
    expect(footer?.querySelector('nav')).toBeNull();
  });
  it('orders tools as three deliberate pairs without placeholder copy', async () => {
    await render();
    const groups=[...container.querySelectorAll('.lp-feature-group')];
    expect(groups).toHaveLength(3);
    expect(groups.map(group=>group.querySelector('h3')?.textContent)).toEqual(['Programming','Visual tools','Computer systems']);
    expect(groups.map(group=>group.querySelectorAll('.lp-feature-item').length)).toEqual([2,2,2]);
    expect(container.textContent).not.toContain('Six workspaces for programming, algorithms and computer architecture.');
    expect(container.textContent).not.toContain('Inside Pico');
    expect(container.querySelector('#lp-features-title')?.textContent).toBe("Pico's tools");
    expect(container.querySelector('.lp')?.getAttribute('data-landing-theme')).toBe('catppuccin-mocha');
    expect(container.querySelector('#about')).toBeNull();
    expect(container.querySelector('.lp-feature-card')).toBeNull();
    const links=[...container.querySelectorAll<HTMLAnchorElement>('.lp-feature-item')];
    expect(links.map(link=>link.getAttribute('href'))).toEqual([
      '/app/pseudocode','/app/python','/app/flowchart',
      '/app/logic','/app/cpu','/app/binary',
    ]);
    expect(links.every(link=>link.getAttribute('aria-label')?.startsWith('Open '))).toBe(true);
    const layout=container.querySelector('main > .lp-tools-downloads');
    expect(layout).not.toBeNull();
    expect([...layout!.children].map(section=>section.id)).toEqual(['features','downloads']);
    expect([...container.querySelectorAll('main > section')]).toHaveLength(2);
  });
  it('reuses the app home-screen curves without extra download text', async () => {
    await render();
    const paths=container.querySelectorAll('.lp-ambient-curves path');
    expect(paths).toHaveLength(7);
    expect(paths[0]?.getAttribute('d')).toContain('M -170 -160 C 40 26');
    expect(paths[2]?.getAttribute('d')).toContain('M 1260 -185 C 1080 30');
    expect(container.querySelectorAll('.lp-ambient-curve-flow')).toHaveLength(2);
    expect(container.textContent).not.toContain('The desktop app requires an internet connection.');
    expect(container.querySelector('.lp-download-note')).toBeNull();
    expect(container.querySelector('a[href="#about"]')).toBeNull();
  });
  it('keeps navigation and footer text intact without duplicate content', async () => {
    await render();
    expect(container.querySelector('.lp-header')).not.toBeNull();
    expect(container.querySelector('.lp-nav-start')).toBeNull();
    expect(container.querySelector('footer small')?.textContent)
      .toBe('© 2026 Pico Development Team. All rights reserved.');
  });
  it('serves the three current Pico installers through Cloudflare when GitHub is private', () => {
    const names=['Pico_x64-setup.exe','Pico_universal.dmg','Pico_amd64.AppImage'];
    for(const name of names){
      expect(installerDownloadHref(name,'feat-site-info-dialogs.picompiler.pages.dev'))
        .toBe('https://picompiler.pages.dev/downloads/'+name);
      expect(installerDownloadHref(name,'picompiler.pages.dev'))
        .toBe('/downloads/'+name);
    }
  });
  it('shows exactly one installer per OS even if a preview has no manifest', async () => {
    await render();
    const options=[...container.querySelectorAll<HTMLAnchorElement>('.lp-download-option')];
    expect(options).toHaveLength(3);
    expect(options.map(link=>link.querySelector('strong')?.textContent)).toEqual([
      'Pico_x64-setup.exe','Pico_universal.dmg','Pico_amd64.AppImage'
    ]);
    expect(options.map(link=>link.getAttribute('href'))).toEqual([
      'https://picompiler.pages.dev/downloads/Pico_x64-setup.exe',
      'https://picompiler.pages.dev/downloads/Pico_universal.dmg',
      'https://picompiler.pages.dev/downloads/Pico_amd64.AppImage',
    ]);
    expect(options[1]?.querySelector('small')?.textContent).toBe('Universal DMG');
    expect(container.textContent).not.toContain('Pico_aarch64.dmg');
    expect(container.textContent).not.toContain('Pico_x64.dmg');
    expect(container.textContent).not.toContain('Pico_amd64.deb');
    expect(container.textContent).not.toContain('Pico_x64_en-US.msi');
  });
  it('updates sizes from a published Cloudflare manifest without adding obsolete installers', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:true,
      json:async()=>({files:{
        'Pico_x64-setup.exe':{size:2000000},
        'Pico_universal.dmg':{size:4100000},
        'Pico_amd64.AppImage':{size:81300000},
      }}),
    }));
    await render();
    await act(async()=>{await Promise.resolve();await Promise.resolve();});
    const options=[...container.querySelectorAll<HTMLAnchorElement>('.lp-download-option')];
    expect(options).toHaveLength(3);
    expect(options.map(option=>option.querySelector('small')?.textContent))
      .toEqual(['2.00 MB','4.10 MB','81.30 MB']);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/download-assets/manifest.json',expect.any(Object));
  });
  it('shows real CPU Studio, without mock product or decorative feature previews', async () => {
    await render();
    expect(container.querySelector('.lp-hero .lp-hero-cpu [data-testid="live-cpu"]')).not.toBeNull();
    expect(container.querySelector('.lp-cpu-section')).toBeNull();
    expect(container.querySelector('.lp-hero-cpu-bar')).toBeNull();
    expect(container.querySelector('.lp-cpu-live')).not.toBeNull();
    expect(container.querySelector('.lp-product-window')).toBeNull();
    expect(container.querySelector('.lp-visual-code')).toBeNull();
    expect(container.querySelector('.lp-processor-svg')).toBeNull();
  });
});
