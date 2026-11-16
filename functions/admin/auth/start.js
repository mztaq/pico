import {
  ADMIN_ORIGIN,LOGIN_COOKIE,LOGIN_SECONDS,configReady,validOrigin,
  randomBytes,base64url,challenge,signLogin,setCookie,redirect,hidden
} from '../../_lib/status-admin-auth.js';

export async function onRequestGet(context){
  const env=context.env;
  if(!validOrigin(context.request)||!configReady(env))return hidden();
  const state=base64url(randomBytes(32));
  const verifier=base64url(randomBytes(32));
  const issued=Math.floor(Date.now()/1000);
  const loginCookie=await signLogin(state,verifier,issued,env.STATUS_ADMIN_SESSION_SECRET);
  const github=new URL("https://github.com/login/oauth/authorize");
  github.searchParams.set("client_id",env.GITHUB_OAUTH_CLIENT_ID);
  github.searchParams.set("redirect_uri",ADMIN_ORIGIN+"/admin/auth/callback");
  github.searchParams.set("state",state);
  github.searchParams.set("code_challenge",await challenge(verifier));
  github.searchParams.set("code_challenge_method","S256");
  github.searchParams.set("allow_signup","false");
  // No repo, profile, email or other OAuth scopes are requested.
  return redirect(github.toString(),[setCookie(LOGIN_COOKIE,loginCookie,LOGIN_SECONDS)]);
}
