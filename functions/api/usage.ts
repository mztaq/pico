import {body, checkOrigin, fail, isWorkspace, json, now, ninetyDays, session, type Context} from '../_lib/core';
import {rateLimit} from '../_lib/rate-limit';

export const WORKSPACE_COLUMNS: Record<string,string> = {
  logic:'logic_sim_seconds',
  python:'python_seconds',
  pseudocode:'pseudocode_seconds',
  flowchart:'flowchart_seconds',
  cpu:'cpu_studio_seconds'
};
type Entry = {workspace:string,seconds:number};

export function validateBatch(input: Record<string,unknown> | null): {id:string,entries:Entry[]} | null {
  if (!input || typeof input.batchId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(input.batchId) ||
      !Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 5) return null;
  const seen = new Set<string>();
  let total = 0;
  const entries: Entry[] = [];
  for (const item of input.entries) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const entry = item as Record<string,unknown>;
    if (!isWorkspace(entry.workspace) || !Number.isInteger(entry.seconds) ||
        Number(entry.seconds) < 1 || Number(entry.seconds) > 60 || seen.has(entry.workspace)) return null;
    total += Number(entry.seconds);
    seen.add(entry.workspace);
    entries.push({workspace:entry.workspace,seconds:Number(entry.seconds)});
  }
  return total <= 60 ? {id:input.batchId,entries} : null;
}

export const onRequestPost = async (ctx: Context) => {
  const originError=checkOrigin(ctx.request);
  if(originError) return originError;
  const limited=await rateLimit(ctx,'usage',24);
  if(limited) return limited;
  const user=await session(ctx);
  if(!user?.analytics_allowed) return fail(403,'Analytics consent required');
  const parsed=validateBatch(await body(ctx.request));
  if (!parsed) return fail(400,'Invalid usage batch');
  const timestamp=now();
  const id=user.visitor_id;
  const increments=Object.entries(WORKSPACE_COLUMNS).map(([workspace,col]) =>
    `${col}=${col}+${parsed.entries.find(e=>e.workspace===workspace)?.seconds ?? 0}`).join(',');
  const mostRecent=parsed.entries[parsed.entries.length-1]!.workspace;
  // D1 batch executes the claim and update together as a transaction.
  // Only the first request with this batch ID sees applied=0 and increments usage.
  const results=await ctx.env.DB.batch([
    ctx.env.DB.prepare(`INSERT OR IGNORE INTO pico_usage_events
      (visitor_id,batch_id,created_at,applied) VALUES(?,?,?,0)`).bind(id,parsed.id,timestamp),
    ctx.env.DB.prepare(`INSERT OR IGNORE INTO pico_usage
      (visitor_id,last_updated) VALUES(?,?)`).bind(id,timestamp),
    ctx.env.DB.prepare(`UPDATE pico_usage SET ${increments},last_updated=?
      WHERE visitor_id=? AND EXISTS (
        SELECT 1 FROM pico_usage_events WHERE visitor_id=? AND batch_id=? AND applied=0
      )`).bind(timestamp,id,id,parsed.id),
    ctx.env.DB.prepare(`UPDATE pico_usage_events SET applied=1
      WHERE visitor_id=? AND batch_id=? AND applied=0`).bind(id,parsed.id),
  ]);
  const applied=(results[2]?.meta?.changes ?? 0)>0;
  if(applied) {
    const usage=await ctx.env.DB.prepare(
      'SELECT logic_sim_seconds,python_seconds,pseudocode_seconds,flowchart_seconds,cpu_studio_seconds FROM pico_usage WHERE visitor_id=?'
    ).bind(id).first<Record<string,number>>();
    const mostUsed=Object.entries(WORKSPACE_COLUMNS).sort((a,b)=>
      (usage?.[b[1]] ?? 0)-(usage?.[a[1]] ?? 0))[0]![0];
    await ctx.env.DB.prepare(
      'UPDATE pico_visitors SET last_visit=?,expires_at=?,last_workspace=?,most_used_workspace=? WHERE visitor_id=?'
    ).bind(timestamp,timestamp+ninetyDays,mostRecent,mostUsed,id).run();
  }
  return json({ok:true,applied});
};
