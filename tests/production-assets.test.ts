import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

it('includes installable Pico manifest and offline fallback', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest')) as {name:string;start_url:string;icons:{src:string}[]};
  expect(manifest.name).toContain('Pico');
  expect(manifest.start_url).toBe('/app');
  expect(manifest.icons.some(icon => icon.src === '/pico-logo.svg')).toBe(true);
  expect(read('public/offline.html')).toContain('Pico is offline');
});

it('disables offline caching and requires live connectivity', () => {
  const source = read('public/sw.js');
  expect(source).toContain("request.method !== 'GET'");
  expect(source).toContain("url.pathname.startsWith('/api/')");
  expect(source).toContain("url.pathname.startsWith('/python-runtime/')");
  expect(source).toContain("url.pathname.startsWith('/assets/')");
  expect(source).not.toMatch(/localStorage|indexedDB|\.picochart|\.logic\.json/);
});

it('publishes static security headers and search metadata', () => {
  const headers = read('public/_headers');
  const index = read('index.html');
  expect(headers).toContain('X-Content-Type-Options: nosniff');
  expect(headers).toContain("Content-Security-Policy: frame-ancestors 'none'");
  expect(index).toContain('rel="manifest"');
  expect(index).toContain('property="og:title"');
  expect(index.match(/name="mobile-web-app-capable" content="yes"/g)).toHaveLength(1);
  expect(index.match(/name="apple-mobile-web-app-capable" content="yes"/g)).toHaveLength(1);
  expect(read('public/robots.txt')).toContain('Sitemap:');
  expect(read('public/sitemap.xml')).toContain('https://picompiler.pages.dev/');
});

it('shares a compact social card with the Pico student slogan and all six tools', () => {
  const index=read('index.html');
  const preview=read('public/social-preview.svg');
  const publisher=read('.github/workflows/publish-downloads.yml');
  expect(index).toContain('property="og:title" content="Pico."');
  expect(index).not.toContain('property="og:site_name"');
  expect(index).toContain('property="og:description" content="Built by students, for students."');
  expect(index).toContain('name="twitter:card" content="summary_large_image"');
  expect(index).toContain('property="og:image" content="https://picompiler.pages.dev/social-preview.png"');
  expect(index).toContain('name="twitter:image" content="https://picompiler.pages.dev/social-preview.png"');
  expect(index).toContain('property="og:image:width" content="1200"');
  expect(index).toContain('property="og:image:height" content="630"');
  expect(preview).toContain('width="1200" height="630"');
  expect(preview).toContain('Built by students, for students.');
  for(const tool of ['PSEUDOCODE','PYTHON','FLOWCHARTS','LOGIC','CPU STUDIO','BINARY LAB']){
    expect(preview).toContain(tool);
  }
  expect(preview).toContain('picompiler.pages.dev');
  expect(publisher).toContain('rsvg-convert --width 1200 --height 630 public/social-preview.svg --output public/social-preview.png');
});
