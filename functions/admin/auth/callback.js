import {
  ADMIN_ORIGIN,LOGIN_COOKIE,SESSION_SECONDS,configReady,validOrigin,
  cookieValue,checkLogin,allowedId,randomBytes,base64url,hex,hash,
  redirect,hidden,setSessionCookie,clearCookie
} from '../../_lib/status-admin-auth.js';

export async function onRequestGet(context){
  const env=context.env;
  if(!validOrigin(context.request)||!configReady(env))return hidden();
  const url=new URL(context.request.url);
  const state=url.searchParams.get("state");
  const code=url.searchParams.get("code");
  const reject=()=>{
    const response=hidden();
    response.headers.append("Set-Cookie",clearCookie(LOGIN_COOKIE));
    return response;
  };
  if(url.searchParams.has("error")||!state||!code||
    !/^[A-Za-z0-9_-]{43}$/.test(state)||code.length>500)return reject();
  const login=await checkLogin(cookieValue(context.request,LOGIN_COOKIE),state,env.STATUS_ADMIN_SESSION_SECRET);
  if(!login)return reject();
  try{
    const exchange=await fetch("https://github.com/login/oauth/access_token",{
      method:"POST",
      headers:{"Accept":"application/json","Content-Type":"application/x-www-form-urlencoded","User-Agent":"Pico-Status-Admin"},
      body:new URLSearchParams({
        client_id:env.GITHUB_OAUTH_CLIENT_ID,
        client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,
        code,redirect_uri:ADMIN_ORIGIN+"/admin/auth/callback",
        code_verifier:login.verifier
      }),
      signal:AbortSignal.timeout(10000)
    });
    if(!exchange.ok)return reject();
    const details=await exchange.json();
    const token=typeof details.access_token==="string"?details.access_token:"";
    // Reject unexpected permissions, including scopes inherited from a prior grant.
    if(details.error||!/^[-._A-Za-z0-9]{16,512}$/.test(token)||
      (typeof details.scope==="string"&&details.scope.trim()!==""))return reject();
    const userResponse=await fetch("https://api.github.com/user",{
      headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"User-Agent":"Pico-Status-Admin"},
      signal:AbortSignal.timeout(10000)
    });
    if(!userResponse.ok)return reject();
    const user=await userResponse.json();
    if(!Number.isSafeInteger(user.id)||user.id<1||!allowedId(env,user.id))return reject();
    const id=hex(randomBytes(16));
    const verifier=base64url(randomBytes(32));
    const verifierHash=await hash(verifier);
    const expiresAt=Math.floor(Date.now()/1000)+SESSION_SECONDS;
    await env.DB.prepare(
      "INSERT INTO pico_status_admin_sessions (id,verifier_hash,label,expires_at) VALUES (?,?,?,?)"
    ).bind(id,verifierHash,"github:"+user.id,expiresAt).run();
    return redirect(ADMIN_ORIGIN+"/admin/",[
      clearCookie(LOGIN_COOKIE),
      setSessionCookie(id+"."+verifier)
    ]);
  }catch(error){
    console.error("Pico GitHub sign-in failed",String(error));
    return reject();
  }
}
