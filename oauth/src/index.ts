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
    resources: [env.MCP_RESOURCE],
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
  // Start a fresh, single-use state tied to the originating browser by a secure cookie.
  const state = randomState();
  await env.OAUTH_KV.put('github-state:' + state, JSON.stringify(parsed), { expirationTtl: 600 });
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', new URL('/callback', env.AUTH_ISSUER).href);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user');
  return new Response(null, { status: 302, headers: {
    'Location': url.href, 'Set-Cookie': secureCookie(state), 'Cache-Control': 'no-store',
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
    Location: redirectTo, 'Set-Cookie': secureCookie(''), 'Cache-Control':'no-store',
  }});
}
export default class PicoOAuth extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/authorize' && request.method === 'GET') return authorize(request, this.env);
    if (pathname === '/callback' && request.method === 'GET') return callback(request, this.env);
    return server(this.env).fetch(request, this.env, this.ctx);
  }
  validateToken(resource: string, token: string) {
    return server(this.env).validateToken(resource, token, this.env);
  }
}
