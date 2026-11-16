import {ADMIN_ORIGIN,LOGIN_COOKIE,configReady,validOrigin,randomToken,challenge,sign,setCookie,redirect,json} from '../../_lib/status-admin-auth.js';

export async function onRequestGet(context){
  const env=context.env;
  if(!validOrigin(context.request))return json({error:"Not available on this hostname"},403);
  if(!configReady(env))return json({error:"Admin sign-in has not been configured"},503);
  const state=randomToken();
  const verifier=randomToken();
  const expires=Math.floor(Date.now()/1000)+600;
  const value=await sign("v1:"+state+":"+verifier+":"+expires,env.STATUS_ADMIN_SESSION_SECRET,"pico-admin-login");
  const url=new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id",env.GITHUB_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri",ADMIN_ORIGIN+"/admin/auth/callback");
  url.searchParams.set("state",state);
  url.searchParams.set("code_challenge",await challenge(verifier));
  url.searchParams.set("code_challenge_method","S256");
  url.searchParams.set("allow_signup","false");
  // Do not request repo access or other privileged OAuth scopes.
  url.searchParams.set("scope","");
  return redirect(url.href,[setCookie(LOGIN_COOKIE,value,600)]);
}
