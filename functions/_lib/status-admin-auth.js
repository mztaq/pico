/*
 * Pico Status Admin: Cloudflare Access JWT verification.
 * No shared password or browser-stored API key.
 * REQUIRED env: CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD, STATUS_ADMIN_EMAILS.
 *
 * A valid JWT alone is insufficient: the verified email must also be allowlisted.
 * Protect /admin/* with the matching Cloudflare Access application.
 */
const KEY_CACHE = new Map();
const KEY_TTL_MS = 10 * 60 * 1000;
function forbidden() {
  return new Response(JSON.stringify({error:"Access denied"}), {
    status:403, headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });
}
function decodeBase64Url(value) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw Error("Invalid encoding");
  const normalized=value.replace(/-/g,"+").replace(/_/g,"/");
  const binary=atob(normalized+"=".repeat((4-normalized.length%4)%4));
  return Uint8Array.from(binary,char=>char.charCodeAt(0));
}
function domain(value) {
  if (typeof value!=="string"||!value.trim()) return null;
  try {
    const url=new URL(value.startsWith("https://")?value:"https://"+value);
    if (url.protocol!=="https:" || url.pathname!=="/" || url.search || url.hash
        || url.username || url.password || url.port
        || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname)) return null;
    return url.origin;
  } catch {return null;}
}
async function publicKey(origin,kid) {
  const cacheId=origin+":"+kid;
  const cached=KEY_CACHE.get(cacheId);
  if(cached && cached.expires>Date.now())return cached.key;
  const reply=await fetch(origin+"/cdn-cgi/access/certs",{
    headers:{Accept:"application/json"},
    signal:AbortSignal.timeout(7000)
  });
  if(!reply.ok)throw Error("Key fetch failed");
  const jwks=await reply.json();
  const jwk=Array.isArray(jwks?.keys)?jwks.keys.find(key=>
    key.kid===kid && key.kty==="RSA" && (!key.alg||key.alg==="RS256")
    && key.use!=="enc"):null;
  if(!jwk)throw Error("Signing key unavailable");
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  KEY_CACHE.set(cacheId,{key,expires:Date.now()+KEY_TTL_MS});
  return key;
}
export async function authorize(context) {
  const env=context.env||{};
  const issuer=domain(env.CF_ACCESS_TEAM_DOMAIN);
  const aud=typeof env.CF_ACCESS_AUD==="string"?env.CF_ACCESS_AUD.trim():"";
  const allowed=new Set(String(env.STATUS_ADMIN_EMAILS||"").split(",").map(e=>e.trim().toLowerCase()).filter(e=>e.includes("@")));
  if(!issuer||!aud||allowed.size===0)return forbidden();
  const token=context.request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token||token.length>8192)return forbidden();
  try {
    const parts=token.split(".");
    if(parts.length!==3||parts.some(s=>s.length===0))return forbidden();
    const head=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    if(head.alg!=="RS256" || typeof head.kid!=="string" || head.kid.length>200)return forbidden();
    const key=await publicKey(issuer,head.kid);
    const payload=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if(!payload||typeof payload!=="object")return forbidden();
    const now=Math.floor(Date.now()/1000);
    const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(payload.iss!==issuer||!audiences.includes(aud)||!Number.isFinite(payload.exp)
      ||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+60
      ||(payload.nbf!=null&&(!Number.isFinite(payload.nbf)||payload.nbf>now+60)))return forbidden();
    const email=typeof payload.email==="string"?payload.email.trim().toLowerCase():"";
    if(!allowed.has(email))return forbidden();
    const valid=await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]),
      new TextEncoder().encode(parts[0]+"."+parts[1])
    );
    return valid?{email}:forbidden();
  } catch {
    return forbidden();
  }
}
export function json(payload,status=200){
  return new Response(JSON.stringify(payload),{
    status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}
export function requireSameOrigin(request){
  const origin=request.headers.get("Origin");
  try {return origin===new URL(request.url).origin} catch {return false}
}
export async function readBody(request,max=4096){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("Content-Type")||""))return null;
  if(Number(request.headers.get("Content-Length")||0)>max)return null;
  if(!request.body)return null;
  const reader=request.body.getReader();
  let size=0;
  const chunks=[];
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>max){void reader.cancel().catch(()=>{});return null;}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const parsed=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:null;
  }catch{return null}finally{reader.releaseLock()}
}
export async function rateLimit(db,email){
  const result=await db.prepare(
    "SELECT COUNT(*) AS total FROM pico_status_admin_audit "+
    "WHERE actor_email = ? AND created_at >= datetime('now','-1 minute')"
  ).bind(email).first();
  return Number(result?.total||0)<12;
}
