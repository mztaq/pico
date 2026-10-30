// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DownloadsPage, { assetArchitecture, assetPlatform } from './DownloadsPage';
import type { Release, ReleasePage } from '../../releases/types';

const stable: Release = { id: 1, tag_name: 'fixture-v1', name: 'Fixture stable', body: 'A fixture release.\n\n**Installation**\n\n- First item\n- Second item\n\n<script>alert(1)</script>', published_at: '2026-01-02T00:00:00Z', prerelease: false, draft: false, assets: [
  { id: 11, name: 'Fixture_x64.exe', label: '', size: 2048, content_type: 'application/octet-stream', state: 'uploaded' },
  { id: 12, name: 'Fixture_aarch64.dmg', label: '', size: 4096, content_type: 'application/x-apple-diskimage', state: 'uploaded' },
] };
const data = (overrides: Partial<ReleasePage> = {}): ReleasePage => ({ latest: stable, releases: [stable], nextPage: null, stale: false, ...overrides });
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  localStorage.clear(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async () => act(async () => root.render(<DownloadsPage />));

it('shows the latest stable metadata, real asset names and same-origin download actions', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data())));
  await render();
  expect(container.textContent).toContain('Latest stable');
  expect(container.textContent).toContain('fixture-v1');
  expect(container.textContent).toContain('2 Jan 2026');
  expect(container.textContent).toContain('2 KiB');
  expect(container.querySelector('[aria-label="Download Fixture_x64.exe"]')?.getAttribute('href')).toBe('/api/downloads/11');
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('.release-notes strong')?.textContent).toBe('Installation');
  expect(container.querySelectorAll('.release-notes li')).toHaveLength(2);
});

it('keeps prereleases in the expandable archive and loads older pages', async () => {
  const preview = { ...stable, id: 2, tag_name: 'fixture-v2-beta', name: 'Fixture preview', prerelease: true, assets: [] };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(data({ releases: [preview, stable], nextPage: 2 }))).mockResolvedValueOnce(Response.json(data({ releases: [{ ...stable, id: 3, tag_name: 'fixture-v0' }] })));
  vi.stubGlobal('fetch', fetcher); await render();
  const entry = container.querySelector('details.release-history-item')!;
  expect(entry.hasAttribute('open')).toBe(false);
  expect(entry.querySelector('summary')?.textContent).toContain('Prerelease');
  await act(async () => (entry.querySelector('summary') as HTMLElement).click());
  expect(entry.hasAttribute('open')).toBe(true);
  expect(entry.textContent).toContain('No download files');
  await act(async () => container.querySelector<HTMLButtonElement>('.downloads-load-more')!.click());
  expect(fetcher.mock.calls[1][0]).toBe('/api/releases?page=2');
  expect(container.querySelectorAll('.release-history-item')).toHaveLength(2);
});

it('shows a loading state, then an honest empty state without download controls', async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(done => { resolve = done; })));
  await render();
  expect(container.textContent).toContain('Finding the latest Pico release');
  await act(async () => resolve(Response.json(data({ latest: null, releases: [] }))));
  expect(container.textContent).toContain('The first release is on its way');
  expect(container.querySelector('.download-action')).toBeNull();
});

it('retries failures and handles a stable release with no assets', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(Response.json(data({ latest: { ...stable, assets: [] } })));
  vi.stubGlobal('fetch', fetcher); await render();
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  await act(async () => container.querySelector<HTMLButtonElement>('.downloads-feedback button')!.click());
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain('No download files');
  expect(container.querySelector('.download-action')).toBeNull();
});

it('labels unknown files conservatively and reads explicit architecture tokens only', () => {
  expect(assetPlatform({ ...stable.assets[0], name: 'universal.zip' })).toBe('Other files');
  expect(assetArchitecture('universal.zip')).toBeNull();
  expect(assetArchitecture('Pico_aarch64.dmg')).toBe('ARM64');
  expect(assetArchitecture('Pico_amd64.deb')).toBe('x64');
});
