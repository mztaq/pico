import {
  ADMIN_ORIGIN,SESSION_SECONDS,json,hidden,validOrigin,requireSameOrigin,
  readBody,randomBytes,hex,base64url,hash,setSessionCookie
} from '../_lib/status-admin-auth.js';

// Separate from /admin/*: an unapproved browser may redeem a private
// single-use invitation without discovering the admin interface.
export async function onRequestPost(context){
  const request=context.request,db=context.env.DB;
  if(!validOrigin(request)||!db||!requireSameOrigin(request))return hidden();
  const body=await readBody(request,512);
  const token=typeof body?.token==="string"?body.token:"";
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return hidden();
  const tokenHash=await hash(token);
  const now=Math.floor(Date.now()/1000);
  const sessionId=hex(randomBytes(16));
  const verifier=base64url(randomBytes(32));
  const verifierHash=await hash(verifier);
  try{
    // D1 batch runs both statements in a transaction. The insert depends on
    // used_by == this exact session ID, so a concurrent redemption never
    // generates a second session, even within the same second.
    const results=await db.batch([
      db.prepare(
        "UPDATE pico_status_admin_invites SET used_at=?,used_by=? "+
        "WHERE token_hash=? AND used_at IS NULL AND expires_at>?"
      ).bind(now,sessionId,tokenHash,now),
      db.prepare(
        "INSERT INTO pico_status_admin_sessions "+
        "(id,verifier_hash,label,expires_at) "+
        "SELECT ?,?,label,? FROM pico_status_admin_invites "+
        "WHERE token_hash=? AND used_by=?"
      ).bind(sessionId,verifierHash,now+SESSION_SECONDS,tokenHash,sessionId)
    ]);
    if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1){
      return hidden();
    }
    const response=json({ok:true,next:ADMIN_ORIGIN+"/admin/"});
    response.headers.append("Set-Cookie",setSessionCookie(sessionId+"."+verifier));
    response.headers.set("Referrer-Policy","no-referrer");
    return response;
  }catch(error){
    console.error("Pico admin activation failed",String(error));
    return hidden();
  }
}
