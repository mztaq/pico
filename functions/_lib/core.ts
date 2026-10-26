export interface Env {
  DB: D1Database;
  RATE_LIMIT_SECRET: string;
  RESEND_API_KEY?: string;
  BUG_REPORT_TO?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}
export interface Context {
  request: Request;
  env: Env;
}
export const COOKIE = '__Host-pico_id';
const encoder = new TextEncoder();
export const now = () => Math.floor(Date.now() / 1000);
export const ninetyDays = 90 * 86400;
export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status, headers: {'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store', ...headers},
  });
}
export function fail(status: number, message: string) { return json({error: message}, status); }
export function cookie(request: Request): string | null {
  const match = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-pico_id=([A-Za-z0-9_-]{43})(?:;|$)/);
  return match?.[1] ?? null;
}
export function setCookie(value: string): string {
  return `${COOKIE}=${value}; Path=/; Max-Age=${ninetyDays}; Secure; HttpOnly; SameSite=Lax`;
}
export const clearCookie = `${COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
export function renewedCookieHeaders(request: Request): HeadersInit {
  const token = cookie(request);
  return token ? {'Set-Cookie':setCookie(token)} : {};
}
export async function hash(token: string) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function checkOrigin(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return fail(403, 'Invalid origin');
  return null;
}
export type JsonBodyResult = {data: Record<string, unknown> | null; tooLarge: boolean};

/**
 * Read at most maxBytes of JSON. Never use request.text() here: a missing or
 * dishonest Content-Length must not cause unbounded body buffering.
 */
export async function readJsonBody(request: Request, maxBytes = 4096): Promise<JsonBodyResult> {
  const invalid = {data: null, tooLarge: false};
  const tooLarge = {data: null, tooLarge: true};
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return invalid;
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) return invalid;
    if (Number(declared) > maxBytes) return tooLarge;
  }
  if (!request.body) return invalid;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        return tooLarge;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid;
    return {data: parsed as Record<string, unknown>, tooLarge: false};
  } catch {
    return invalid;
  } finally {
    reader.releaseLock();
  }
}
export async function body(request: Request): Promise<Record<string, unknown> | null> {
  return (await readJsonBody(request)).data;
}
export async function session(ctx: Context) {
  const token = cookie(ctx.request);
  if (!token) return null;
  const id = await hash(token);
  const visitor = await ctx.env.DB.prepare(
    `SELECT v.visitor_id, c.analytics_allowed, c.preferences_allowed
     FROM pico_visitors v JOIN pico_consent c ON c.visitor_id = v.visitor_id
     WHERE v.visitor_id = ? AND v.expires_at > ? AND c.expires_at > ?`
  ).bind(id, now(), now()).first<{
    visitor_id: string; analytics_allowed: number; preferences_allowed: number
  }>();
  return visitor;
}
export function isWorkspace(v: unknown): v is string {
  return typeof v === 'string' && [
    'logic','python','pseudocode','flowchart','cpu'
  ].includes(v);
}
