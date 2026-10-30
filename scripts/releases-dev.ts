import type { Plugin } from 'vite';
import { Readable } from 'node:stream';
import { onRequestGet as releases } from '../functions/api/releases.ts';
import { onRequestGet as download } from '../functions/api/downloads/[id].ts';

// Exercise the same handlers locally; production uses the existing Pages Functions routing.
export function releasesDev(): Plugin {
  return {
    name: 'pico-releases-dev',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const asset = url.pathname.match(/^\/api\/downloads\/([^/]+)\/?$/);
        if (url.pathname !== '/api/releases' && !asset) { next(); return; }
        if (request.method !== 'GET') { response.writeHead(405, { Allow: 'GET' }); response.end(); return; }
        try {
          const headers = new Headers();
          if (request.headers.range) headers.set('Range', request.headers.range);
          const result = await (asset ? download : releases)({
            request: new Request(url, { headers }), params: asset ? { id: asset[1] } : {},
            waitUntil: promise => { void promise.catch(() => {}); },
          });
          response.writeHead(result.status, Object.fromEntries(result.headers));
          if (result.body) Readable.fromWeb(result.body as import('node:stream/web').ReadableStream).on('error', () => response.destroy()).pipe(response);
          else response.end();
        } catch { response.writeHead(500); response.end('Release service unavailable'); }
      });
    },
  };
}
