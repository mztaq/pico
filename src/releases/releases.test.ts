import { afterEach, expect, it, vi } from 'vitest';
import { onRequestGet as releases } from '../../functions/api/releases';
import { attachment, onRequestGet as download } from '../../functions/api/downloads/[id]';
import { github, type FunctionContext } from '../server/github';
import { fileFormat, formatSize } from './types';

const context = (path = '/api/releases', id?: string): FunctionContext => ({ request: new Request(`https://pico.test${path}`), params: id ? { id } : {}, waitUntil: promise => { void promise; } });
const release = (id: number, prerelease = false) => ({ id, name: 'Fixture release', tag_name: `test-${id}`, draft: false, prerelease, assets: [] });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('uses GitHub latest independently of listing order and paginates without drafts', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json([release(2, true), release(1), { ...release(3), draft: true }], { headers: { Link: '<https://api.github.com/repos/mztaq/pico/releases?page=2>; rel="next"' } })).mockResolvedValueOnce(Response.json(release(1)));
  vi.stubGlobal('fetch', fetcher);
  const response = await releases(context());
  const data = await response.json();
  expect(data.latest.id).toBe(1);
  expect(data.releases.map((item: { id: number }) => item.id)).toEqual([2, 1]);
  expect(data.nextPage).toBe(2);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.github.com/repos/mztaq/pico/releases?per_page=20&page=1');
});

it('handles no releases and no stable release without inventing one', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(new Response(null, { status: 404 })));
  expect(await (await releases(context())).json()).toMatchObject({ latest: null, releases: [], nextPage: null });
});

it('validates page numbers before accessing GitHub', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  expect((await releases(context('/api/releases?page=-1'))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
});

it('returns an actionable retry interval on rate limits', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 403, headers: { 'Retry-After': '120' } }))));
  const response = await releases(context());
  expect(response.status).toBe(503);
  expect(response.headers.get('Retry-After')).toBe('120');
});

it('uses fresh edge metadata without requesting GitHub', async () => {
  vi.stubGlobal('caches', { default: { match: vi.fn().mockResolvedValue(Response.json({ name: 'cached' }, { headers: { 'X-Pico-Cached-At': String(Date.now()) } })) } });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const result = await github('/releases/latest', context());
  expect(result.stale).toBe(false);
  expect(await result.response.json()).toEqual({ name: 'cached' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('revalidates cached metadata using ETags and tolerates a transient outage', async () => {
  const cached = () => Response.json({ name: 'cached' }, { headers: { 'X-Pico-Cached-At': String(Date.now() - 360000), ETag: 'fixture-etag' } });
  const put = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('caches', { default: { match: vi.fn().mockImplementation(cached), put } });
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 304 })).mockRejectedValueOnce(new Error('offline'));
  vi.stubGlobal('fetch', fetcher);
  expect((await github('/releases/latest', context())).stale).toBe(false);
  expect(fetcher.mock.calls[0][1].headers['If-None-Match']).toBe('fixture-etag');
  expect(put).toHaveBeenCalled();
  const fallback = await github('/releases/latest', context());
  expect(fallback.stale).toBe(true);
  expect(await fallback.response.json()).toEqual({ name: 'cached' });
});

it('streams exact bytes with original UTF-8 filename, forwards ranges, and does not expose redirects', async () => {
  const bytes = new Uint8Array([0, 255, 128, 10]);
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ name: 'Pico résumé.zip', state: 'uploaded', browser_download_url: 'https://github.com/mztaq/pico/releases/download/test/file.zip' })).mockResolvedValueOnce(new Response(bytes, { status: 206, headers: { 'Content-Length': '4', 'Content-Range': 'bytes 0-3/10', 'Accept-Ranges': 'bytes' } }));
  vi.stubGlobal('fetch', fetcher);
  const requestContext = context('/api/downloads/123', '123');
  requestContext.request.headers.set('Range', 'bytes=0-3');
  const response = await download(requestContext);
  expect(response.status).toBe(206);
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  expect(response.headers.get('Content-Disposition')).toContain("filename*=UTF-8''Pico%20r%C3%A9sum%C3%A9.zip");
  expect(response.headers.get('Location')).toBeNull();
  expect(response.headers.get('Content-Range')).toBe('bytes 0-3/10');
  expect(fetcher.mock.calls[1][1].headers.get('Range')).toBe('bytes=0-3');
  expect(fetcher.mock.calls[1][1].headers.has('Authorization')).toBe(false);
});

it('rejects foreign upstream URLs and malformed IDs', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ name: 'file.zip', state: 'uploaded', browser_download_url: 'https://example.com/file.zip' }));
  vi.stubGlobal('fetch', fetcher);
  expect((await download(context('/api/downloads/bad', '../bad'))).status).toBe(400);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await download(context('/api/downloads/123', '123'))).status).toBe(502);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('shows a first-party error page when a file is gone', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  const response = await download(context('/api/downloads/123', '123'));
  expect(response.status).toBe(404);
  expect(response.headers.get('Content-Disposition')).toBeNull();
  expect(await response.text()).toContain('href="/downloads"');
});

it('escapes response filenames and describes only actual file information', () => {
  expect(attachment('bad"\r\nname.zip')).not.toMatch(/[\r\n]/);
  expect(formatSize(0)).toBe('0 B');
  expect(formatSize(1536)).toBe('1.5 KiB');
  expect(fileFormat('package.tar.gz')).toBe('TAR.GZ');
  expect(fileFormat('LICENSE')).toBe('File');
});
