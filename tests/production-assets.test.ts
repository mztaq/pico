import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

it('includes installable Pico manifest and offline fallback', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest')) as {name:string;start_url:string;icons:{src:string}[]};
  expect(manifest.name).toContain('Pico');
  expect(manifest.start_url).toBe('/');
  expect(manifest.icons.some(icon => icon.src === '/pico-logo.svg')).toBe(true);
  expect(read('public/offline.html')).toContain('Pico is offline');
});

it('never caches API calls, user projects or the Python interpreter in the service worker', () => {
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
  expect(read('public/robots.txt')).toContain('Sitemap:');
  expect(read('public/sitemap.xml')).toContain('https://picompiler.pages.dev/');
});
