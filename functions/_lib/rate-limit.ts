import {fail, now, type Context} from './core';

/**
 * D1-backed request limits with HMAC-anonymized IPs.
 * Bug reports use a true rolling 60-second window to avoid minute-boundary bursts.
 * Other endpoints retain their existing fixed-minute counters.
 */
export async function rateLimit(
  ctx: Context,
  action: 'cookies' | 'usage' | 'preferences' | 'bug-report',
  maxRequests: number,
): Promise<Response | null> {
  const secret = ctx.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) return fail(503, 'Rate limiting is not configured');
  const clientIp = ctx.request.headers.get('CF-Connecting-IP');
  if (!clientIp) return fail(403, 'Missing request identity');

  const minute = Math.floor(now() / 60);
  const material = new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey('raw', material, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(action + ':' + (action === 'bug-report' ? '' : minute + ':') + clientIp));
  const identity = [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');

  const limited = () => new Response(JSON.stringify({error: 'Too many requests, try again shortly'}), {
    status: 429,
    headers: {'content-type': 'application/json', 'retry-after': '60', 'cache-control': 'no-store'}
  });

  if (action === 'bug-report') {
    // One short-lived row per attempt. The count and conditional insert happen in
    // a single SQL statement, so crossing a clock-minute boundary cannot reset it.
    const time = Date.now() / 1000;
    const prefix = 'bug:' + identity + ':';
    const accepted = await ctx.env.DB.prepare(
      `INSERT INTO pico_rate_limits(key,hits,expires_at)
       SELECT ?,1,?
       WHERE (SELECT COUNT(*) FROM pico_rate_limits
              WHERE key >= ? AND key < ? AND expires_at > ?) < ?
       RETURNING hits`
    ).bind(prefix + crypto.randomUUID(), time + 60, prefix, prefix + '~', time, maxRequests)
      .first<{hits: number}>();
    return accepted ? null : limited();
  }

  const row = await ctx.env.DB.prepare(
    `INSERT INTO pico_rate_limits(key,hits,expires_at) VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET hits = hits + 1
     RETURNING hits`
  ).bind(identity, (minute + 2) * 60).first<{hits: number}>();
  return (row?.hits ?? maxRequests + 1) > maxRequests ? limited() : null;
}
