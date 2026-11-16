import { authorize, json, readBody, requireSameOrigin, rateLimit } from '../../_lib/status-admin-auth.js';

const SERVICES=new Set(['website','mcp','oauth']);

export async function onRequest(context){
  const user=await authorize(context);
  if(user instanceof Response)return user;
  if(!context.env.DB)return json({error:'Database unavailable'},503);
  if(context.request.method==='GET'){
    try{
      const result=await context.env.DB.prepare(
        "SELECT id, source, service_id, title, reason, started_at, resolved_at, status "+
        "FROM pico_status_incidents ORDER BY started_at DESC, id DESC LIMIT 60"
      ).all();
      return json({incidents:(result.results||[]).map(r=>({
        id:r.id,source:r.source,serviceId:r.service_id,title:r.title,
        reason:r.reason,startedAt:r.started_at,resolvedAt:r.resolved_at,status:r.status,
      }))});
    }catch(error){
      console.error('Admin incident read failed',String(error));
      return json({error:'Unable to load incidents'},503);
    }
  }
  if(context.request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!requireSameOrigin(context.request))return json({error:'Invalid request origin'},403);
  const body=await readBody(context.request);
  if(!body)return json({error:'Invalid request'},400);
  const serviceId=typeof body.serviceId==='string'?body.serviceId.trim():'';
  const title=typeof body.title==='string'?body.title.trim():'';
  const message=typeof body.message==='string'?body.message.trim():'';
  if(!SERVICES.has(serviceId)||title.length<5||title.length>120||message.length<10||message.length>650){
    return json({error:'Provide a service, title (5–120 characters), and public update (10–650 characters).'},400);
  }
  try{
    if(!(await rateLimit(context.env.DB,user.email)))return json({error:'Too many updates. Try later.'},429);
    const externalId='manual-'+crypto.randomUUID();
    const updateKey='created-'+crypto.randomUUID();
    const now=new Date().toISOString();
    // D1 batch runs statements as a single transaction.
    const result=await context.env.DB.batch([
      context.env.DB.prepare(
        "INSERT INTO pico_status_incidents "+
        "(source, external_id, service_id, title, reason, started_at, status) "+
        "VALUES ('manual', ?, ?, ?, ?, ?, 'investigating')"
      ).bind(externalId,serviceId,title,message,now),
      context.env.DB.prepare(
        "INSERT INTO pico_status_updates (incident_id,event_key,stage,message,published_at) "+
        "SELECT id,?,'investigating',?,? FROM pico_status_incidents "+
        "WHERE source='manual' AND external_id=?"
      ).bind(updateKey,message,now,externalId),
      context.env.DB.prepare(
        "INSERT INTO pico_status_admin_audit (incident_id,actor_email,action,stage,message) "+
        "SELECT id,?,'create','investigating',? FROM pico_status_incidents "+
        "WHERE source='manual' AND external_id=?"
      ).bind(user.email,message,externalId),
      context.env.DB.prepare(
        "SELECT id FROM pico_status_incidents WHERE source='manual' AND external_id=?"
      ).bind(externalId),
    ]);
    const id=result[3]?.results?.[0]?.id;
    if(!Number.isSafeInteger(id)||id<1)throw Error('Missing incident ID');
    return json({ok:true,id},201);
  }catch(error){
    console.error('Admin incident create failed',String(error));
    return json({error:'Unable to create incident'},503);
  }
}
