import {ADMIN_ORIGIN,LOGIN_COOKIE,SESSION_COOKIE,configReady,validOrigin,cookieValue,verify,sign,allowedId,setCookie,clearCookie,redirect,json} from '../../_lib/status-admin-auth.js';

export async function onRequestGet(context){
  const env=context.env;
  if(!validOrigin(context.request)||!configReady(env))
    return json({error:"Admin sign-in unavailable"},503);
  const url=new URL(context.request.url);
  const state=url.searchParams.get("state");
  const code=url.searchParams.get("code");
  const deny=(status=403)=>{
    const response=json({error:"GitHub sign-in failed or this account is not approved"},status);
    response.headers.append("Set-Cookie",clearCookie(LOGIN_COOKIE));
    return response;
  };
  if(url.searchParams.has("error")||!state||!code||state.length>200||code.length>300)return deny();
  const token=cookieValue(context.request,LOGIN_COOKIE);
  const value=await verify(token,env.STATUS_ADMIN_SESSION_SECRET,"pico-admin-login");
  const parts=/^v1:([A-Za-z0-9_-]{43}):([A-Za-z0-9_-]{43}):(\d{10})$/.exec(value||"");
  if(!parts||parts[1]!==state||Number(parts[3])<=Math.floor(Date.now()/1000))return deny();
  try{
    const exchange=await fetch("https://github.com/login/oauth/access_token",{
      method:"POST",
      headers:{"Accept":"application/json","Content-Type":"application/json"},
      body:JSON.stringify({
        client_id:env.GITHUB_OAUTH_CLIENT_ID,
        client_secret:env.GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri:ADMIN_ORIGIN+"/admin/auth/callback",
        code_verifier:parts[2]
      }),
      signal:AbortSignal.timeout(9000)
    });
    if(!exchange.ok)return deny();
    const payload=await exchange.json();
    const bearer=typeof payload.access_token==="string"?payload.access_token:"";
    if(!/^[A-Za-z0-9_]{16,500}$/.test(bearer))return deny();
    const userResponse=await fetch("https://api.github.com/user",{
      headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+bearer,
        "User-Agent":"Pico-Status-Admin"},
      signal:AbortSignal.timeout(9000)
    });
    if(!userResponse.ok)return deny();
    const user=await userResponse.json();
    const id=user.id;
    if(!Number.isSafeInteger(id)||id<=0||!allowedId(env,id))return deny();
    const expiry=Math.floor(Date.now()/1000)+8*3600;
    const session=await sign("v1:"+id+":"+expiry,env.STATUS_ADMIN_SESSION_SECRET,"pico-admin-session");
    return redirect(ADMIN_ORIGIN+"/admin/",[
      clearCookie(LOGIN_COOKIE),
      setCookie(SESSION_COOKIE,session,8*3600)
    ]);
  }catch{
    return deny(503);
  }
}
