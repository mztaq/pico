/*
 * Pico status device sessions.
 * Approved browsers receive a high-entropy bearer cookie only after
 * redeeming a private, single-use activation token. Tokens and session
 * verifiers are SHA-256 hashed in D1, never stored in plaintext.
 * The admin API is protected server-side, not by frontend hiding.
 */
export const ADMIN_ORIGIN = "https://status.picompiler.pages.dev";
export const SESSION_COOKIE = "__Host-pico_status_session";
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

export function hidden() {
  return new Response("404 Not Found",{
    status:404,
    headers:{
      "Content-Type":"text/plain; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
export function json(payload,status=200) {
  return new Response(JSON.stringify(payload),{
    status,headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff"
    }
  });
}
export function validOrigin(request){
  try {return new URL(request.url).origin===ADMIN_ORIGIN;} catch {return false;}
}
export function requireSameOrigin(request){
  return validOrigin(request)&&request.headers.get("Origin")===ADMIN_ORIGIN;
}
export function randomBytes(size){
  const out=new Uint8Array(size);
  crypto.getRandomValues(out);
  return out;
}
export function hex(bytes){
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
export function base64url(bytes){
  let raw="";for(const byte of bytes)raw+=String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
export async function hash(text){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return hex(new Uint8Array(digest));
}
export function cookieValue(request,name){
  for(const part of (request.headers.get("Cookie")||"").split(";")){
    const pos=part.indexOf("=");
    if(pos>0&&part.slice(0,pos).trim()===name)return part.slice(pos+1).trim();
  }
  return null;
}
export function setSessionCookie(value){
  return SESSION_COOKIE+"="+value+"; Path=/; Max-Age="+SESSION_SECONDS+
    "; Secure; HttpOnly; SameSite=Strict";
}
export function clearSessionCookie(){
  return SESSION_COOKIE+"=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict";
}
export async function authorize(context){
  const db=context.env?.DB;
  if(!validOrigin(context.request)||!db)return hidden();
  const cookie=cookieValue(context.request,SESSION_COOKIE);
  const match=/^([a-f0-9]{32})\.([A-Za-z0-9_-]{43})$/.exec(cookie||"");
  if(!match)return hidden();
  try {
    const verifierHash=await hash(match[2]);
    const record=await db.prepare(
      "SELECT id, label FROM pico_status_admin_sessions "+
      "WHERE id=? AND verifier_hash=? AND revoked_at IS NULL AND expires_at>?"
    ).bind(match[1],verifierHash,Math.floor(Date.now()/1000)).first();
    if(!record)return hidden();
    return {actor:"device:"+record.id,label:record.label,sessionId:record.id,verifierHash};
  }catch(error){
    console.error("Admin session verification failed",String(error));
    return hidden();
  }
}
export async function readBody(request,max=4096){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))return null;
  if(Number(request.headers.get("Content-Length")||0)>max || !request.body)return null;
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>max){void reader.cancel().catch(()=>{});return null;}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    return body&&typeof body==="object"&&!Array.isArray(body)?body:null;
  }catch{return null}
  finally{reader.releaseLock()}
}
export async function rateLimit(db,actor){
  const result=await db.prepare(
    "SELECT COUNT(*) AS total FROM pico_status_admin_audit "+
    "WHERE actor_email=? AND created_at>=datetime('now','-1 minute')"
  ).bind(actor).first();
  return Number(result?.total||0)<12;
}
