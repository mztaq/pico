// Fixed repository only. No client-supplied upstream URL or credential is accepted.
export const REPOSITORY_API = 'https://api.github.com/repos/mztaq/pico';
const FRESH_MS = 5 * 60 * 1000;
export interface FunctionContext {
  request: Request;
  params: Record<string, string | string[]>;
  waitUntil(promise: Promise<unknown>): void;
}
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}
export class UpstreamError extends Error {
  constructor(public status: number, public retryAfter = '60') { super('Release service unavailable'); }
}
export async function github(path: string, context: FunctionContext): Promise<{ response: Response; stale: boolean }> {
  const url = `${REPOSITORY_API}${path}`;
  const cache = (globalThis.caches as CacheStorage & { default?: EdgeCache } | undefined)?.default;
  // Separate metadata cache from any binary request to the same GitHub endpoint.
  const key = new Request(`${url}${url.includes('?') ? '&' : '?'}pico_metadata=1`);
  const cached = await cache?.match(key);
  const savedAt = Number(cached?.headers.get('X-Pico-Cached-At') ?? 0);
  if (cached && Date.now() - savedAt < FRESH_MS) return { response: cached, stale: false };
  try {
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'Pico-Downloads', 'X-GitHub-Api-Version': '2022-11-28' };
    const etag = cached?.headers.get('ETag');
    if (etag) headers['If-None-Match'] = etag;
    const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (upstream.status !== 304 && !upstream.ok && upstream.status !== 404) {
      const reset = Number(upstream.headers.get('X-RateLimit-Reset')) * 1000;
      const retry = upstream.headers.get('Retry-After') ?? String(Math.max(60, Math.ceil((reset - Date.now()) / 1000)));
      throw new UpstreamError(upstream.status, retry);
    }
    const source = upstream.status === 304 && cached ? cached : upstream;
    const responseHeaders = new Headers(source.headers);
    responseHeaders.set('X-Pico-Cached-At', String(Date.now()));
    responseHeaders.set('Cache-Control', 'public, max-age=86400');
    const response = new Response(source.body, { status: source.status, headers: responseHeaders });
    if (cache) context.waitUntil(cache.put(key, response.clone()).catch(() => {}));
    return { response, stale: false };
  } catch (error) {
    if (cached && Date.now() - savedAt < 86400000 && cached.ok) return { response: cached, stale: true };
    throw error instanceof UpstreamError ? error : new UpstreamError(502);
  }
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}

