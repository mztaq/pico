import { github, UpstreamError, type FunctionContext } from '../../../src/server/github.ts';

function failure(status: number, message: string, retryAfter?: string): Response {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Download unavailable | Pico</title><style>body{font:1rem/1.6 system-ui;background:#1e1e2e;color:#cdd6f4;margin:0;padding:10vh 8vw}main{max-width:42rem;margin:auto}a{color:#cba6f7;display:inline-block;padding:12px 0}h1{font-size:2rem}</style><main><p>Pico.</p><h1>Download unavailable</h1><p>${message}</p><a href="/downloads">Back to Downloads</a></main></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) },
  });
}

export function attachment(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\/]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function onRequestGet(context: FunctionContext): Promise<Response> {
  const id = context.params.id;
  if (typeof id !== 'string' || !/^[1-9]\d{0,15}$/.test(id)) return failure(400, 'This download address is invalid.');
  try {
    const metadata = await github(`/releases/assets/${id}`, context);
    if (metadata.response.status === 404) return failure(404, 'This file is no longer available. Please choose another release.');
    const asset = await metadata.response.json() as { name: string; state: string; browser_download_url: string };
    const source = new URL(asset.browser_download_url);
    if (source.origin !== 'https://github.com' || !source.pathname.startsWith('/mztaq/pico/releases/download/') || source.username || source.password || asset.state !== 'uploaded') {
      return failure(502, 'This file is not ready to download. Please try again later.');
    }
    const headers = new Headers({ 'User-Agent': 'Pico-Downloads' });
    const range = context.request.headers.get('Range');
    if (range) headers.set('Range', range);
    // Stream through the edge: binaries are never buffered into memory or duplicated in storage.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let upstream: Response;
    try { upstream = await fetch(source, { headers, redirect: 'follow', signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    if (!upstream.ok) {
      if (upstream.status === 416) return new Response(null, { status: 416, headers: { 'Content-Range': upstream.headers.get('Content-Range') ?? 'bytes */*' } });
      return failure(upstream.status === 404 ? 404 : 502, 'The file could not be retrieved. Please return to Downloads and try again.');
    }
    const responseHeaders = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': attachment(asset.name),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    return failure(503, 'Downloads are temporarily unavailable. Please try again shortly.', error instanceof UpstreamError ? error.retryAfter : '60');
  }
}

