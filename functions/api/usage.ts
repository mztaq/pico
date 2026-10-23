import {body, checkOrigin, fail, isWorkspace, json, now, ninetyDays, session, type Context} from '../_lib/core';

const columns: Record<string,string> = {
  logic:'logic_sim_seconds',python:'python_seconds',pseudocode:'pseudocode_seconds',
  flowchart:'flowchart_seconds',cpu:'cpu_studio_seconds'
};
export const onRequestPost = async (ctx: Context) => {
  const originError=checkOrigin(ctx.request); if(originError) return originError;
  const user=await session(ctx); if(!user?.analytics_allowed) return fail(403,'Analytics consent required');
  const data=await body(ctx.request);
  if (!data || !isWorkspace(data.workspace) || !Number.isInteger(data.seconds) ||
    (data.seconds as number) < 1 || (data.seconds as number) > 60)
    return fail(400,'Invalid workspace usage');
  const workspace=data.workspace;
  const col=columns[workspace];
  const timestamp=now();
  // Ignore too-frequent updates rather than trusting unbounded client-side totals.
  const old=await ctx.env.DB.prepare('SELECT last_updated FROM pico_usage WHERE visitor_id=?')
    .bind(user.visitor_id).first<{last_updated:number}>();
  if (old && timestamp-old.last_updated < 50) return json({ok:true,ignored:true});
  await ctx.env.DB.prepare(
    `INSERT INTO pico_usage(visitor_id,${col},last_updated) VALUES(?,?,?)
     ON CONFLICT(visitor_id) DO UPDATE SET ${col}=${col}+excluded.${col}, last_updated=excluded.last_updated`
  ).bind(user.visitor_id,data.seconds,timestamp).run();
  const most=await ctx.env.DB.prepare(
    'SELECT logic_sim_seconds,python_seconds,pseudocode_seconds,flowchart_seconds,cpu_studio_seconds FROM pico_usage WHERE visitor_id=?'
  ).bind(user.visitor_id).first<Record<string,number>>();
  const mostUsed=Object.entries(columns).sort((a,b)=>(most?.[b[1]] ?? 0)-(most?.[a[1]] ?? 0))[0][0];
  await ctx.env.DB.prepare(
    'UPDATE pico_visitors SET last_visit=?,expires_at=?,last_workspace=?,most_used_workspace=? WHERE visitor_id=?'
  ).bind(timestamp,timestamp+ninetyDays,workspace,mostUsed,user.visitor_id).run();
  return json({ok:true});
};
