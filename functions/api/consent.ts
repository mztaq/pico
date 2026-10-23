import {body, checkOrigin, clearCookie, cookie, fail, hash, json, now, ninetyDays, randomId, session, setCookie, type Context} from '../_lib/core';

export const onRequestGet = async (ctx: Context) => {
  const user = await session(ctx);
  return json({analytics: !!user?.analytics_allowed, preferences: !!user?.preferences_allowed});
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
  const timestamp = now();
  const expiry = timestamp + ninetyDays;
  if (!existing) {
    await ctx.env.DB.prepare(
      'INSERT INTO pico_visitors (visitor_id,first_visit,last_visit,expires_at) VALUES (?,?,?,?)'
    ).bind(id,timestamp,timestamp,expiry).run();
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
