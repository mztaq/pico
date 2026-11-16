import {
  authorize,hidden,json,requireSameOrigin,clearSessionCookie
} from '../../_lib/status-admin-auth.js';

export async function onRequestPost(context){
  if(!requireSameOrigin(context.request))return hidden();
  const user=await authorize(context);
  if(user instanceof Response)return user;
  try {
    await context.env.DB.prepare(
      "UPDATE pico_status_admin_sessions SET revoked_at=? "+
      "WHERE id=? AND verifier_hash=? AND revoked_at IS NULL"
    ).bind(Math.floor(Date.now()/1000),user.sessionId,user.verifierHash).run();
    const response=json({ok:true});
    response.headers.append("Set-Cookie",clearSessionCookie());
    return response;
  }catch(error){
    console.error("Pico admin session revocation failed",String(error));
    return hidden();
  }
}
