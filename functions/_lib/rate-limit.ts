import {fail, now, type Context} from './core';

/**
 * D1-backed, one-minute request counters. No raw IP addresses are stored.
 * RATE_LIMIT_SECRET must be configured as a Cloudflare Pages secret.
 */
export async function rateLimit(
  ctx: Context,
  action: 'cookies' | 'usage' | 'preferences',
  maxRequests: number,
): Promise<Response | null> {
  const secret = ctx.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) return fail(503, 'Rate limiting is not configured');
  const clientIp = ctx.request.headers.get('CF-Connecting-IP');
  if (!clientIp) return fail(403, 'Missing request identity');
  const minute = Math.floor(now() / 60);
  const material = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey('raw',material,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(action + ':' + minute + ':' + clientIp));
  const identity = [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const row = await ctx.env.DB.prepare(
    `INSERT INTO pico_rate_limits(key,hits,expires_at) VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET hits = hits + 1
     RETURNING hits`
  ).bind(identity,(minute+2)*60).first<{hits:number}>();
  if ((row?.hits ?? maxRequests+1) > maxRequests) {
    return new Response(JSON.stringify({error:'Too many requests, try again shortly'}),{
      status:429,
      headers:{'content-type':'application/json','retry-after':'60','cache-control':'no-store'}
    });
  }
  return null;
}
