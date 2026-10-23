export interface Env {
  DB: D1Database;
  RATE_LIMIT_SECRET: string;
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
export async function body(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null;
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 4096) return null;
  try {
    const text = await request.text();
    if (text.length > 4096) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch { return null; }
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
