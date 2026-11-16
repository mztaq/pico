/*
 * Pico Status Admin - GitHub OAuth session verification.
 * Only selected GitHub numeric IDs can publish. No user OAuth token is retained.
 * Env (Preview secrets): GITHUB_OAUTH_CLIENT_ID,
 * GITHUB_OAUTH_CLIENT_SECRET, STATUS_ADMIN_GITHUB_IDS,
 * STATUS_ADMIN_SESSION_SECRET.
 */
export const ADMIN_ORIGIN="https://status.picompiler.pages.dev";
export const SESSION_COOKIE="__Host-pico_status_session";
export const LOGIN_COOKIE="__Host-pico_status_login";
const MAX_AGE=8*3600;
const encoder=new TextEncoder();
function bytes64(bytes){
  let binary="";for(const b of new Uint8Array(bytes))binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function from64(text){
  if(!/^[A-Za-z0-9_-]+$/.test(text))throw Error("Invalid value");
  let binary=atob(text.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-text.length%4)%4));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export function randomToken(){
  const value=new Uint8Array(32);crypto.getRandomValues(value);return bytes64(value);
}
export async function challenge(verifier){
  return bytes64(await crypto.subtle.digest("SHA-256",encoder.encode(verifier)));
}
export function validOrigin(request){
  try{return new URL(request.url).origin===ADMIN_ORIGIN;}catch{return false;}
}
function allowlist(env){
  return new Set(String(env.STATUS_ADMIN_GITHUB_IDS||"")
    .split(",").map(x=>x.trim()).filter(x=>/^[1-9]\d{0,15}$/.test(x)));
}
export function configReady(env){
  return typeof env.GITHUB_OAUTH_CLIENT_ID==="string" &&
    /^[A-Za-z0-9_]{8,100}$/.test(env.GITHUB_OAUTH_CLIENT_ID) &&
    typeof env.GITHUB_OAUTH_CLIENT_SECRET==="string" && env.GITHUB_OAUTH_CLIENT_SECRET.length>=20 &&
    typeof env.STATUS_ADMIN_SESSION_SECRET==="string" && env.STATUS_ADMIN_SESSION_SECRET.length>=40 &&
    allowlist(env).size>0;
}
export function allowedId(env,id){return allowlist(env).has(String(id));}
async function hmacKey(secret){
  return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function sign(value,secret,purpose){
  const body=purpose+"|"+value;
  return value+"."+bytes64(await crypto.subtle.sign("HMAC",await hmacKey(secret),encoder.encode(body)));
}
export async function verify(token,secret,purpose){
  if(typeof token!=="string"||token.length>1024)return null;
  const cut=token.lastIndexOf(".");
  if(cut<1)return null;
  const value=token.slice(0,cut), mac=token.slice(cut+1);
  try{
    const key=await hmacKey(secret);
    const ok=await crypto.subtle.verify("HMAC",key,from64(mac),encoder.encode(purpose+"|"+value));
    return ok?value:null;
  }catch{return null;}
}
export function cookieValue(request,name){
  const raw=request.headers.get("Cookie")||"";
  for(const pair of raw.split(";")){
    const mark=pair.indexOf("=");
    if(mark>0&&pair.slice(0,mark).trim()===name)
      return pair.slice(mark+1).trim();
  }
  return null;
}
export function setCookie(name,value,maxAge){
  return name+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age="+maxAge;
}
export function clearCookie(name){return setCookie(name,"",0);}
export function noStore(response){response.headers.set("Cache-Control","no-store");return response;}
export function redirect(url,extraCookies=[]){
  const response=new Response(null,{status:302,headers:{Location:url,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  for(const c of extraCookies)response.headers.append("Set-Cookie",c);
  return response;
}
export function json(payload,status=200){
  return new Response(JSON.stringify(payload),{
    status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}
export function deny(){return json({error:"Unauthorized"},401);}
export async function authorize(context){
  const env=context.env||{};
  if(!validOrigin(context.request)||!configReady(env))return deny();
  const token=cookieValue(context.request,SESSION_COOKIE);
  if(!token)return deny();
  const value=await verify(token,env.STATUS_ADMIN_SESSION_SECRET,"pico-admin-session");
  if(!value)return deny();
  const match=/^v1:([1-9]\d{0,15}):(\d{10})$/.exec(value);
  if(!match)return deny();
  const id=match[1], expiry=Number(match[2]),now=Math.floor(Date.now()/1000);
  if(expiry<=now||expiry>now+MAX_AGE||!allowedId(env,id))return deny();
  return {actor:"github:"+id,githubId:id};
}
export function requireSameOrigin(request){
  return validOrigin(request) && request.headers.get("Origin")===ADMIN_ORIGIN;
}
export async function readBody(request,max=4096){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))return null;
  if(Number(request.headers.get("Content-Length")||0)>max)return null;
  if(!request.body)return null;
  const reader=request.body.getReader();
  let size=0;const chunks=[];
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;size+=value.byteLength;
      if(size>max){void reader.cancel().catch(()=>{});return null;}chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:null;
  }catch{return null}finally{reader.releaseLock();}
}
export async function rateLimit(db,actor){
  const result=await db.prepare(
    "SELECT COUNT(*) AS total FROM pico_status_admin_audit "+
    "WHERE actor_email=? AND created_at>=datetime('now','-1 minute')"
  ).bind(actor).first();
  return Number(result?.total||0)<12;
}
