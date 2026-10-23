import {body, checkOrigin, clearCookie, cookie, fail, hash, json, now, ninetyDays, randomId, session, setCookie, type Context} from '../_lib/core';

export const onRequestGet = async (ctx: Context) => {
  // A request without a cookie still verifies the actual D1 binding and tables.
  if (!ctx.env.DB) return fail(503, 'D1 binding DB is missing');
  try {
    await ctx.env.DB.prepare('SELECT visitor_id FROM pico_visitors LIMIT 1').first();
    const user = await session(ctx);
    return json({
      status: 'ok',
      database: 'connected',
      analytics: !!user?.analytics_allowed,
      preferences: !!user?.preferences_allowed,
    });
  } catch {
    return fail(503, 'Database unavailable');
  }
};

export const onRequestPost = async (ctx: Context) => {
  const error = checkOrigin(ctx.request);
  if (error) return error;
  const data = await body(ctx.request);
  if (!data || typeof data.analytics !== 'boolean' || typeof data.preferences !== 'boolean')
    return fail(400, 'Expected boolean analytics and preferences');
  const analytics = data.analytics, preferences = data.preferences;
  const existing = await session(ctx);
  const previousToken = cookie(ctx.request);
  if (!analytics && !preferences) {
    if (existing) await ctx.env.DB.prepare('DELETE FROM pico_visitors WHERE visitor_id = ?')
      .bind(existing.visitor_id).run();
    // The client keeps a local consent-denied choice without creating a visitor record.
    return json({analytics:false, preferences:false}, 200, {'Set-Cookie':clearCookie});
  }
  const token = existing && previousToken ? previousToken : randomId();
  const id = await hash(token);
  const ua = ctx.request.headers.get('user-agent') ?? '';
  const operatingSystem = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Mac OS X/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Unknown';
  const browser = /Edg\//i.test(ua) ? 'Edge' : /Firefox\//i.test(ua) ? 'Firefox' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : 'Other';
  const timestamp = now();
  const expiry = timestamp + ninetyDays;
  if (!existing) {
    await ctx.env.DB.prepare(
      'INSERT INTO pico_visitors (visitor_id,first_visit,last_visit,expires_at,operating_system,browser) VALUES (?,?,?,?,?,?)'
    ).bind(id,timestamp,timestamp,expiry,operatingSystem,browser).run();
  }
  await ctx.env.DB.prepare(
    `INSERT INTO pico_consent (visitor_id,analytics_allowed,preferences_allowed,updated_at,expires_at)
     VALUES (?,?,?,?,?)
     ON CONFLICT(visitor_id) DO UPDATE SET analytics_allowed=excluded.analytics_allowed,
       preferences_allowed=excluded.preferences_allowed,updated_at=excluded.updated_at,
       expires_at=excluded.expires_at`
  ).bind(id,Number(analytics),Number(preferences),timestamp,expiry).run();
  if (!analytics) await ctx.env.DB.prepare('DELETE FROM pico_usage WHERE visitor_id=?').bind(id).run();
  if (!preferences) await ctx.env.DB.prepare('DELETE FROM pico_preferences WHERE visitor_id=?').bind(id).run();
  return json({analytics,preferences},200,{'Set-Cookie':setCookie(token)});
};
