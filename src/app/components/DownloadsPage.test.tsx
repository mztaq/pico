// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DownloadsPage, { assetArchitecture, assetPlatform } from './DownloadsPage';
import type { HostedDownloadManifest, ReleaseAsset } from '../../releases/types';

const manifest = (files: HostedDownloadManifest['files'] = {
  'Fixture_x64.exe': { size: 2048, sha256: 'a'.repeat(64), parts: 1, version: 'fixture-v1' },
  'Fixture_aarch64.dmg': { size: 4096, sha256: 'b'.repeat(64), parts: 1, version: 'fixture-v1' },
}): HostedDownloadManifest => ({
  chunk: 16 * 1024 * 1024,
  release: {
    version: 'fixture-v1', title: 'Fixture stable', publishedAt: '2026-01-02T00:00:00Z', prerelease: false,
    summary: 'A fixture release.', notes: 'Choose an installer for your computer.',
  },
  files,
});
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  localStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async () => act(async () => root.render(<DownloadsPage />));

it('loads Pico-hosted metadata and links directly to Pico-hosted installers', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(manifest()));
  vi.stubGlobal('fetch', fetcher); await render();
  expect(fetcher).toHaveBeenCalledWith('/download-assets/manifest.json', expect.any(Object));
  expect(container.textContent).toContain('Latest stable');
  expect(container.textContent).toContain('fixture-v1');
  expect(container.textContent).toContain('2 Jan 2026');
  expect(container.textContent).toContain('2 KiB');
  expect(container.querySelector('[aria-label="Download Fixture_x64.exe"]')?.getAttribute('href')).toBe('/downloads/Fixture_x64.exe');
  expect(container.querySelectorAll('.release-history-item')).toHaveLength(0);
});

it('shows a loading state and retries when the hosted manifest is unavailable', async () => {
  let resolve!: (response: Response) => void;
  const fetcher = vi.fn().mockReturnValueOnce(new Promise<Response>(done => { resolve = done; })).mockResolvedValueOnce(Response.json(manifest()));
  vi.stubGlobal('fetch', fetcher); await render();
  expect(container.textContent).toContain('Finding the latest Pico release');
  await act(async () => resolve(new Response(null, { status: 503 })));
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => container.querySelector<HTMLButtonElement>('.downloads-feedback button')!.click());
  expect(container.textContent).toContain('Fixture stable');
});

it('rejects malformed hosted metadata instead of displaying invented downloads', async () => {
  const invalid = manifest({ 'bad.exe': { size: 1, sha256: 'invalid', parts: 1, version: 'fixture-v1' } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(invalid))); await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(container.querySelector('.download-action')).toBeNull();
});

it('labels unknown files conservatively and reads explicit architecture tokens only', () => {
  const asset = { id: 1, name: 'universal.zip', label: null, size: 1, content_type: 'application/zip', state: 'uploaded' } satisfies ReleaseAsset;
  expect(assetPlatform(asset)).toBe('Other files');
  expect(assetArchitecture('universal.zip')).toBeNull();
  expect(assetArchitecture('Pico_aarch64.dmg')).toBe('ARM64');
  expect(assetArchitecture('Pico_amd64.deb')).toBe('x64');
});
