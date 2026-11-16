import {SESSION_COOKIE,clearCookie,validOrigin,requireSameOrigin,json} from '../../_lib/status-admin-auth.js';

export async function onRequestPost(context){
  if(!validOrigin(context.request)||!requireSameOrigin(context.request))
    return json({error:"Invalid request origin"},403);
  const response=json({ok:true});
  response.headers.append("Set-Cookie",clearCookie(SESSION_COOKIE));
  return response;
}
