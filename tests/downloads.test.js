import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/downloads/[filename].js';

const filename = 'Pico_amd64.AppImage';
const chunks = [
  new Uint8Array([0, 1, 2, 3]),
  new Uint8Array([4, 5, 6, 7]),
  new Uint8Array([8, 9]),
];
const manifest = {
  chunk: 4,
  files: {
    [filename]: {
      size: 10,
      parts: 3,
      sha256: 'a'.repeat(64),
    },
  },
};
function make(method = 'GET', range) {
  const request = new Request('https://example.pages.dev/downloads/' + filename, {
    method,
    headers: range ? { Range: range } : undefined,
  });
  const env = {
    ASSETS: {
      async fetch(url) {
        const path = new URL(url).pathname;
        if (path.endsWith('/manifest.json')) return Response.json(manifest);
        const match = /\.part(\d{3})$/.exec(path);
        if (!match) return new Response('not found', { status: 404 });
        const index = Number(match[1]);
        const chunk = chunks[index];
        return chunk ? new Response(chunk) : new Response('missing', { status: 404 });
      },
    },
  };
  return onRequest({ request, env, params: { filename } });
}

describe('Cloudflare Pages installer download', () => {
  it('streams the exact file in order', async () => {
    const response = await make();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Length')).toBe('10');
    expect(response.headers.get('Content-Disposition')).toContain(filename);
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0,1,2,3,4,5,6,7,8,9]);
  });
  it('serves partial requests across chunk boundaries', async () => {
    const response = await make('GET', 'bytes=3-8');
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 3-8/10');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([3,4,5,6,7,8]);
  });
  it('supports suffix ranges', async () => {
    const response = await make('GET', 'bytes=-3');
    expect(response.status).toBe(206);
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([7,8,9]);
  });
  it('returns headers for HEAD without a body', async () => {
    const response = await make('HEAD');
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
  });
  it('returns 416 for invalid ranges', async () => {
    expect((await make('GET', 'bytes=15-20')).status).toBe(416);
    expect((await make('GET', 'bytes=8-4')).status).toBe(416);
    expect((await make('GET', 'bytes=1-4,6-8')).status).toBe(416);
  });
  it('rejects unknown installer names', async () => {
    const request = new Request('https://example.pages.dev/downloads/foo.exe');
    const response = await onRequest({request,env:{},params:{filename:'foo.exe'}});
    expect(response.status).toBe(404);
  });
});
