// Run: node --test scripts/test-status-admin-auth.mjs
// No GitHub network calls or Cloudflare credentials needed.
import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const auth=await import("../functions/_lib/status-admin-auth.js");
const {onRequestGet:start}=await import("../functions/admin/auth/start.js");
const {onRequestGet:callback}=await import("../functions/admin/auth/callback.js");
const {onRequest:middleware}=await import("../functions/admin/_middleware.js");

const SECRET="x".repeat(64);
const envBase={
  GITHUB_OAUTH_CLIENT_ID:"Ov23li_ExampleClient",
  GITHUB_OAUTH_CLIENT_SECRET:"test_client_secret_long_enough",
  STATUS_ADMIN_SESSION_SECRET:SECRET,
  STATUS_ADMIN_GITHUB_IDS:"12345"
};
const context=(path,db,cookie)=>({
  env:{...envBase,DB:db},
  request:new Request(auth.ADMIN_ORIGIN+path,{
    headers:cookie?{Cookie:cookie}:{}
  }),
  next:()=>new Response("private admin", {status:200})
});
const fakeDB=record=>({
  prepare(){return{bind(...args){return{
    first:async()=>record,
    run:async()=>({success:true,args})
  }}}}
});

test("unauthorized visitors get HTTP 404, not an admin page",async()=>{
  const res=await middleware(context("/admin/",fakeDB(null)));
  assert.equal(res.status,404);
  const api=await middleware(context("/admin/api/incidents",fakeDB(null)));
  assert.equal(api.status,404);
});

test("signed PKCE login state rejects tampering, mismatches and expiry",async()=>{
  const state=auth.base64url(auth.randomBytes(32));
  const verifier=auth.base64url(auth.randomBytes(32));
  const now=Math.floor(Date.now()/1000);
  const signed=await auth.signLogin(state,verifier,now,SECRET);
  assert.deepEqual(await auth.checkLogin(signed,state,SECRET),{verifier});
  assert.equal(await auth.checkLogin(signed,"wrong",SECRET),null);
  assert.equal(await auth.checkLogin("a"+signed.slice(1),state,SECRET),null);
  const expired=await auth.signLogin(state,verifier,now-601,SECRET);
  assert.equal(await auth.checkLogin(expired,state,SECRET),null);
});

test("existing GitHub session requires current allowlist and D1 approval",async()=>{
  const id=auth.hex(auth.randomBytes(16));
  const verifier=auth.base64url(auth.randomBytes(32));
  const cookie=auth.SESSION_COOKIE+"="+id+"."+verifier;
  const allowed=await auth.authorize(context("/admin/",fakeDB({id,label:"github:12345"}),cookie));
  assert.equal(allowed.actor,"github:12345");
  const unapproved=await auth.authorize(context("/admin/",fakeDB({id,label:"github:9999"}),cookie));
  assert.equal(unapproved.status,404);
  const oldDevice=await auth.authorize(context("/admin/",fakeDB({id,label:"Old laptop"}),cookie));
  assert.equal(oldDevice.status,404);
  const revoked=await auth.authorize(context("/admin/",fakeDB(null),cookie));
  assert.equal(revoked.status,404);
});

test("OAuth authorization requests use PKCE and no extra permissions",async()=>{
  const res=await start(context("/admin/auth/start",fakeDB(null)));
  assert.equal(res.status,302);
  const url=new URL(res.headers.get("Location"));
  assert.equal(url.origin,"https://github.com");
  assert.equal(url.searchParams.get("scope"),"");
  assert.equal(url.searchParams.get("code_challenge_method"),"S256");
  assert.equal(url.searchParams.get("redirect_uri"),auth.ADMIN_ORIGIN+"/admin/auth/callback");
  assert.ok(res.headers.get("Set-Cookie")?.includes(auth.LOGIN_COOKIE));
});

test("callback allows approved GitHub ID and denies everyone else",async()=>{
  const state=auth.base64url(auth.randomBytes(32));
  const verifier=auth.base64url(auth.randomBytes(32));
  const signed=await auth.signLogin(state,verifier,Math.floor(Date.now()/1000),SECRET);
  const cookie=auth.LOGIN_COOKIE+"="+signed;
  let userId=12345,scope="",inserts=0;
  const db={
    prepare(statement){
      assert.match(statement,/INSERT INTO pico_status_admin_sessions/);
      return{bind(...args){return{run:async()=>{
        assert.equal(args[2],"github:"+userId);
        inserts++;return{success:true};
      }}}};
    }
  };
  const realFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(url==="https://github.com/login/oauth/access_token"){
      assert.equal(options.body.get("code_verifier"),verifier);
      return new Response(JSON.stringify({
        access_token:"gho_abcdefghijklmnopqrstuvwxyz12345",
        scope,token_type:"bearer"
      }),{status:200});
    }
    assert.equal(url,"https://api.github.com/user");
    assert.match(options.headers.Authorization,/^Bearer gho_/);
    return new Response(JSON.stringify({id:userId}),{status:200});
  };
  const request=()=>context("/admin/auth/callback?code=sample&state="+state,db,cookie);
  try{
    const yes=await callback(request());
    assert.equal(yes.status,302);
    assert.equal(yes.headers.get("Location"),auth.ADMIN_ORIGIN+"/admin/");
    assert.equal(inserts,1);
    userId=99999;
    const no=await callback(request());
    assert.equal(no.status,404);
    assert.equal(inserts,1);
    userId=12345;scope="repo";
    const scoped=await callback(request());
    assert.equal(scoped.status,404);
    assert.equal(inserts,1);
  }finally{globalThis.fetch=realFetch;}
});
