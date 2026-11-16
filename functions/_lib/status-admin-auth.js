/*
 * Pico Status Admin authentication.
 * GitHub OAuth authorizes a numeric GitHub user ID, not a mutable username.
 * Authenticated browser sessions have random verifiers stored only as SHA-256
 * hashes in D1, and are revocable. No GitHub tokens are persisted.
 */
export const ADMIN_ORIGIN = "https://status.picompiler.pages.dev";
export const SESSION_COOKIE = "__Host-pico_status_session";
export const LOGIN_COOKIE = "__Host-pico_status_oauth";
export const SESSION_SECONDS = 14 * 24 * 60 * 60;
export const LOGIN_SECONDS = 10 * 60;

export function hidden() {
  return new Response("404 Not Found",{
    status:404,
    headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}
  });
}
export function json(payload,status=200) {
  return new Response(JSON.stringify(payload),{
    status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}
export function validOrigin(request){
  try{return new URL(request.url).origin===ADMIN_ORIGIN;}catch{return false;}
}
export function requireSameOrigin(request){
  return validOrigin(request)&&request.headers.get("Origin")===ADMIN_ORIGIN;
}
export function randomBytes(size){
  const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return bytes;
}
export function hex(bytes){
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
export function base64url(bytes){
  let raw="";for(const b of bytes)raw+=String.fromCharCode(b);
  return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
function fromBase64url(input){
  if(!/^[A-Za-z0-9_-]+$/.test(input))throw Error("Invalid encoding");
  const raw=atob(input.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-input.length%4)%4));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export async function hash(text){
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))));
}
export async function challenge(verifier){
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
}
export function cookieValue(request,name){
  for(const part of (request.headers.get("Cookie")||"").split(";")){
    const pos=part.indexOf("=");
    if(pos>0&&part.slice(0,pos).trim()===name)return part.slice(pos+1).trim();
  }
  return null;
}
export function setCookie(name,value,seconds,sameSite="Lax"){
  return name+"="+value+"; Path=/; Max-Age="+seconds+"; Secure; HttpOnly; SameSite="+sameSite;
}
export function clearCookie(name){
  return setCookie(name,"",0);
}
export function setSessionCookie(value){
  return setCookie(SESSION_COOKIE,value,SESSION_SECONDS,"Lax");
}
export function clearSessionCookie(){return clearCookie(SESSION_COOKIE);}
export function redirect(destination,cookies=[]){
  const response=new Response(null,{status:302,headers:{
    "Location":destination,"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"
  }});
  for(const cookie of cookies)response.headers.append("Set-Cookie",cookie);
  return response;
}
export function allowedIds(env){
  const values=String(env?.STATUS_ADMIN_GITHUB_IDS||"").split(",").map(x=>x.trim());
  return new Set(values.filter(x=>/^[1-9]\d{0,15}$/.test(x)));
}
export function allowedId(env,id){return allowedIds(env).has(String(id));}
export function configReady(env){
  return !!env?.DB &&
    typeof env.GITHUB_OAUTH_CLIENT_ID==="string" &&
    /^[A-Za-z0-9_]{8,100}$/.test(env.GITHUB_OAUTH_CLIENT_ID) &&
    typeof env.GITHUB_OAUTH_CLIENT_SECRET==="string" &&
    env.GITHUB_OAUTH_CLIENT_SECRET.length>=16 &&
    typeof env.STATUS_ADMIN_SESSION_SECRET==="string" &&
    env.STATUS_ADMIN_SESSION_SECRET.length>=40 &&
    allowedIds(env).size>0;
}
async function key(secret){
  return crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function signLogin(state,verifier,issued,secret){
  const value="v1:"+state+":"+verifier+":"+issued;
  const signature=await crypto.subtle.sign("HMAC",await key(secret),new TextEncoder().encode("pico-status-oauth:"+value));
  return value+":"+base64url(new Uint8Array(signature));
}
export async function checkLogin(value,state,secret){
  const match=/^v1:([A-Za-z0-9_-]{43}):([A-Za-z0-9_-]{43}):(\d{10}):([A-Za-z0-9_-]{43})$/.exec(value||"");
  if(!match||match[1]!==state)return null;
  const issued=Number(match[3]),now=Math.floor(Date.now()/1000);
  if(issued>now+60||issued<now-LOGIN_SECONDS)return null;
  try{
    const body=match[0].slice(0,match[0].lastIndexOf(":"));
    const ok=await crypto.subtle.verify("HMAC",await key(secret),fromBase64url(match[4]),new TextEncoder().encode("pico-status-oauth:"+body));
    return ok?{verifier:match[2]}:null;
  }catch{return null;}
}
export async function authorize(context){
  if(!validOrigin(context.request)||!configReady(context.env))return hidden();
  const cookie=cookieValue(context.request,SESSION_COOKIE);
  const match=/^([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/.exec(cookie||"");
  if(!match)return hidden();
  try{
    const verifierHash=await hash(match[2]);
    const record=await context.env.DB.prepare(
      "SELECT id,label FROM pico_status_admin_sessions "+
      "WHERE id=? AND verifier_hash=? AND revoked_at IS NULL AND expires_at>?"
    ).bind(match[1],verifierHash,Math.floor(Date.now()/1000)).first();
    const label=String(record?.label||"");
    const github=/^github:([1-9]\d{0,15})$/.exec(label);
    if(!record||!github||!allowedId(context.env,github[1]))return hidden();
    return {actor:"github:"+github[1],githubId:github[1],sessionId:record.id,verifierHash};
  }catch(error){
    console.error("Pico admin session check failed",String(error));
    return hidden();
  }
}
export async function readBody(request,max=4096){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))return null;
  if(Number(request.headers.get("Content-Length")||0)>max||!request.body)return null;
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>max){void reader.cancel().catch(()=>{});return null;}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let pos=0;
    for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
    const value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    return value&&typeof value==="object"&&!Array.isArray(value)?value:null;
  }catch{return null}
  finally{reader.releaseLock();}
}
export async function rateLimit(db,actor){
  const result=await db.prepare(
    "SELECT COUNT(*) AS total FROM pico_status_admin_audit "+
    "WHERE actor_email=? AND created_at>=datetime('now','-1 minute')"
  ).bind(actor).first();
  return Number(result?.total||0)<12;
}
