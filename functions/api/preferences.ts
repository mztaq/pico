import {body, checkOrigin, fail, isWorkspace, json, now, ninetyDays, session, type Context} from '../_lib/core';

export const onRequestGet = async (ctx: Context) => {
  const user = await session(ctx);
  if (!user?.preferences_allowed) return fail(403,'Preferences consent required');
  const row = await ctx.env.DB.prepare(
    'SELECT p.theme,v.last_workspace,p.settings_json FROM pico_preferences p JOIN pico_visitors v ON v.visitor_id=p.visitor_id WHERE p.visitor_id=?'
  ).bind(user.visitor_id).first<{theme:string,last_workspace:string|null,settings_json:string}>();
  return json(row ? {theme:row.theme,lastWorkspace:row.last_workspace,settings:JSON.parse(row.settings_json)} : null);
};
export const onRequestPut = async (ctx: Context) => {
  const originError = checkOrigin(ctx.request); if (originError) return originError;
  const user = await session(ctx);
  if (!user?.preferences_allowed) return fail(403,'Preferences consent required');
  const data = await body(ctx.request);
  if (!data || !['dark','light'].includes(String(data.theme)) ||
      (data.lastWorkspace !== null && data.lastWorkspace !== undefined && !isWorkspace(data.lastWorkspace)) ||
      !data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))
    return fail(400,'Invalid preferences');
  const settings = JSON.stringify(data.settings);
  if (settings.length > 2048) return fail(400,'Settings too large');
  const timestamp = now(), expiry = timestamp + ninetyDays;
  await ctx.env.DB.prepare(
    `INSERT INTO pico_preferences(visitor_id,theme,settings_json,updated_at)
     VALUES(?,?,?,?)
     ON CONFLICT(visitor_id) DO UPDATE SET
     theme=excluded.theme,settings_json=excluded.settings_json,updated_at=excluded.updated_at`
  ).bind(user.visitor_id,data.theme,settings,timestamp).run();
  await ctx.env.DB.prepare(
    'UPDATE pico_visitors SET last_workspace=?,last_visit=?,expires_at=? WHERE visitor_id=?'
  ).bind(data.lastWorkspace ?? null,timestamp,expiry,user.visitor_id).run();
  return json({ok:true});
};
export const onRequestDelete = async (ctx: Context) => {
  const error=checkOrigin(ctx.request); if(error) return error;
  const user=await session(ctx); if (!user) return json({ok:true});
  await ctx.env.DB.prepare('DELETE FROM pico_preferences WHERE visitor_id=?').bind(user.visitor_id).run();
  return json({ok:true});
};
