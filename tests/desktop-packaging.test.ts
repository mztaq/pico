import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

it('provides installers for Windows, macOS and Linux', () => {
  const manifest = JSON.parse(read('desktop/package.json')) as {
    main: string;
    build: { win: { target: unknown[] }; mac: { target: unknown[] }; linux: { target: unknown[] } };
  };
  expect(manifest.main).toBe('main.cjs');
  expect(JSON.stringify(manifest.build.win.target)).toContain('nsis');
  expect(JSON.stringify(manifest.build.mac.target)).toContain('dmg');
  expect(JSON.stringify(manifest.build.linux.target)).toContain('AppImage');
  expect(JSON.stringify(manifest.build.linux.target)).toContain('deb');
  expect(read('.github/workflows/desktop.yml')).toContain('windows-latest');
  expect(read('.github/workflows/desktop.yml')).toContain('macos-latest');
  expect(read('.github/workflows/desktop.yml')).toContain('ubuntu-latest');
});

it('uses the live Pico website with a restricted desktop renderer', () => {
  const main = read('desktop/main.cjs');
  expect(main).toContain('https://picompiler.pages.dev/');
  expect(main).toContain('nodeIntegration: false');
  expect(main).toContain('contextIsolation: true');
  expect(main).toContain('sandbox: true');
  expect(main).toContain("action: 'deny'");
  expect(main).toContain('pico-online.txt');
  expect(read('desktop/offline.html')).toContain("You're offline");
});
