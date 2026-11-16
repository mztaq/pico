import { authorize, json, readBody, requireSameOrigin, rateLimit } from '../../_lib/status-admin-auth.js';

const STAGES=['investigating','identified','monitoring','resolved'];

export async function onRequest(context){
  const user=await authorize(context);
  if(user instanceof Response)return user;
  if(context.request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!context.env.DB)return json({error:'Database unavailable'},503);
  if(!requireSameOrigin(context.request))return json({error:'Invalid request origin'},403);
  const body=await readBody(context.request);
  if(!body)return json({error:'Invalid request'},400);
  const id=body.incidentId;
  const stage=body.stage;
  const message=typeof body.message==='string'?body.message.trim():'';
  if(!Number.isSafeInteger(id)||id<1||!STAGES.includes(stage)||message.length<10||message.length>650){
    return json({error:'Choose an incident, stage, and message (10–650 characters).'},400);
  }
  try{
    if(!(await rateLimit(context.env.DB,user.actor)))return json({error:'Too many updates. Try later.'},429);
    const existing=await context.env.DB.prepare(
      'SELECT id, status FROM pico_status_incidents WHERE id=?'
    ).bind(id).first();
    if(!existing)return json({error:'Incident not found'},404);
    if(STAGES.indexOf(stage)<STAGES.indexOf(existing.status)){
      return json({error:'Incident stages cannot move backwards.'},409);
    }
    const now=new Date().toISOString();
    const updateKey='team-'+crypto.randomUUID();
    await context.env.DB.batch([
      context.env.DB.prepare(
        "UPDATE pico_status_incidents SET status=?, "+
        "resolved_at=CASE WHEN ?='resolved' THEN COALESCE(resolved_at,?) ELSE resolved_at END, "+
        "updated_at=CURRENT_TIMESTAMP WHERE id=?"
      ).bind(stage,stage,now,id),
      context.env.DB.prepare(
        'INSERT INTO pico_status_updates (incident_id,event_key,stage,message,published_at) VALUES (?,?,?,?,?)'
      ).bind(id,updateKey,stage,message,now),
      context.env.DB.prepare(
        "INSERT INTO pico_status_admin_audit (incident_id,actor_email,action,stage,message) "+
        "VALUES (? ,?,'update',?,?)"
      ).bind(id,user.actor,stage,message),
    ]);
    return json({ok:true});
  }catch(error){
    console.error('Admin incident update failed',String(error));
    return json({error:'Unable to publish update'},503);
  }
}
