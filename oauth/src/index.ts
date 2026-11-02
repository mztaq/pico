import { OAuthAuthorizationServer, AuthorizationError, type AuthRequest } from '@cloudflare/workers-oauth-provider';
import { WorkerEntrypoint } from 'cloudflare:workers';

interface Env {
  OAUTH_KV: KVNamespace;
  AUTH_ISSUER: string;
  MCP_RESOURCE: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_ALLOWED_ID: string;
}
const scopes = ['mcp:run', 'offline_access'];
const secureCookie = (value: string) => `__Host-pico_oauth_state=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`;
const randomState = () => crypto.randomUUID() + crypto.randomUUID();

function server(env: Env) {
  return new OAuthAuthorizationServer<Env>({
    issuer: env.AUTH_ISSUER,
    resources: [env.MCP_RESOURCE, 'https://feat-pico-mcp-github-oauth.picompiler.pages.dev/app/mcp'],
    scopesSupported: scopes,
    clientIdMetadataDocumentEnabled: true,
    clientRegistrationEndpoint: '/oauth/register',
  });
}
function fail(message: string, status = 400) {
  return new Response(message, { status, headers: { 'Cache-Control': 'no-store' } });
}
async function authorize(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_ALLOWED_ID) return fail('OAuth not configured', 503);
  const oauth = server(env).getOAuthApi(env);
  let parsed: AuthRequest;
  try { parsed = await oauth.parseAuthRequest(request); }
  catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.redirectTo) return Response.redirect(error.redirectTo, 302);
      return fail(error.description);
    }
    throw error;
  }
  // Start a fresh, browser-bound request. Require explicit consent before GitHub sign-in.
  const state = randomState();
  await env.OAUTH_KV.put('github-state:' + state, JSON.stringify(parsed), { expirationTtl: 600 });
  const client=await oauth.lookupClient(parsed.clientId);
  if(!client)return fail('Unknown OAuth client');
  const display=(client.clientName || parsed.clientId).replace(/[&<>"']/g, ch => { const map:Record<string,string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}; return map[ch] || ch; });
  const page=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize Pico MCP</title><main style="font:16px system-ui;max-width:460px;margin:9vh auto;padding:25px"><h1>Connect to Pico MCP</h1><p><strong>${display}</strong> is requesting permission to run Pico's programming tools as your GitHub account.</p><p>Only approve if you trust this AI client. The client will be able to execute code, generate flowcharts, and simulate circuits, but cannot access your private Pico projects.</p><form method="post" action="/authorize"><input type="hidden" name="state" value="${state}"><button type="submit" style="padding:12px 22px">Approve and sign in with GitHub</button></form><p>To decline, close this page.</p></main></html>`;
  return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','Set-Cookie':secureCookie(state),'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://github.com; base-uri 'none'; frame-ancestors 'none'"}});
}
async function approve(request: Request, env: Env): Promise<Response> {
  const form=await request.formData();
  const state=form.get('state');
  const cookie=request.headers.get('cookie') ?? '';
  const match=cookie.match(/(?:^|;\s*)__Host-pico_oauth_state=([^;]+)/);
  if(typeof state!=='string' || !match || match[1]!==state || !await env.OAUTH_KV.get('github-state:'+state))return fail('Invalid consent state',403);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', new URL('/callback', env.AUTH_ISSUER).href);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user');
  return new Response(null, { status: 302, headers: {
    'Location': url.href, 'Cache-Control': 'no-store',
  }});
}
async function callback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.match(/(?:^|;\s*)__Host-pico_oauth_state=([^;]+)/);
  if (state.length < 40 || !match || match[1] !== state) return fail('Authorization state mismatch', 403);
  const saved = await env.OAUTH_KV.get('github-state:' + state);
  if (!saved) return fail('Expired authorization request', 403);
  await env.OAUTH_KV.delete('github-state:' + state);
  const code = url.searchParams.get('code');
  if (!code) return fail('GitHub authorization was declined');
  const upstream = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {'Accept':'application/json','Content-Type':'application/json','User-Agent':'pico-mcp'},
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
      code, redirect_uri: new URL('/callback', env.AUTH_ISSUER).href,
    }),
  });
  if (!upstream.ok) return fail('GitHub token exchange failed', 502);
  const credentials = await upstream.json() as {access_token?:string};
  if (!credentials.access_token) return fail('GitHub authorization failed', 403);
  const userResponse = await fetch('https://api.github.com/user', {
    headers: { Authorization: 'Bearer ' + credentials.access_token,
      Accept: 'application/vnd.github+json', 'User-Agent': 'pico-mcp' },
  });
  if (!userResponse.ok) return fail('GitHub identity verification failed', 502);
  const user = await userResponse.json() as {id:number;login:string};
  // Numeric account ID is stable across GitHub username changes.
  if (String(user.id) !== env.GITHUB_ALLOWED_ID) return fail('GitHub account is not permitted', 403);
  const oauth = server(env).getOAuthApi(env);
  const requestInfo = JSON.parse(saved) as AuthRequest;
  const client = await oauth.lookupClient(requestInfo.clientId);
  if (!client) return fail('Unregistered OAuth client');
  // Allow only our single GitHub identity; the server issues resource-bound tokens.
  const {redirectTo} = await oauth.completeAuthorization({
    request: requestInfo, userId: String(user.id),
    metadata: {clientName: client.clientName},
    scope: requestInfo.scope.filter(s => scopes.includes(s)),
    props: {githubId: String(user.id), githubLogin: user.login},
  });
  return new Response(null, {status:302,headers:{
    Location: redirectTo, 'Set-Cookie': '__Host-pico_oauth_state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0', 'Cache-Control':'no-store',
  }});
}
export default class PicoOAuth extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/authorize' && request.method === 'GET') return authorize(request, this.env);
    if (pathname === '/authorize' && request.method === 'POST') return approve(request, this.env);
    if (pathname === '/callback' && request.method === 'GET') return callback(request, this.env);
    return server(this.env).fetch(request, this.env, this.ctx);
  }
  validateToken(resource: string, token: string) {
    return server(this.env).validateToken(resource, token, this.env);
  }
}
