import { OAuthAuthorizationServer, AuthorizationError, type AuthRequest } from '@cloudflare/workers-oauth-provider';
import { WorkerEntrypoint } from 'cloudflare:workers';

interface Env {
  OAUTH_KV: KVNamespace;
  AUTH_ISSUER: string;
  MCP_RESOURCE: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_ALLOWED_ID?: string;
  GITHUB_ACCESS_MODE?: string;
}
const scopes = ['mcp:run', 'offline_access'];
const secureCookie = (value: string) => `__Host-pico_oauth_state=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`;
const randomState = () => crypto.randomUUID() + crypto.randomUUID();

const picoLogo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Pico"><rect x="4" y="4" width="120" height="120" rx="34" fill="#8179ef"/><path d="M39 29h35a24 24 0 0 1 0 48H53v24H39V29Zm14 14v20h21a10 10 0 0 0 0-20H53Z" fill="#11121a"/><circle cx="90" cy="93" r="8" fill="#c9c4ff"/></svg>';
// Standalone styling: OAuth Worker must never rely on frontend asset loading.
const oauthStyles = `
:root{color-scheme:dark;--bg:#1e1e2e;--panel:#252536;--line:#3a3b52;--text:#cdd6f4;--muted:#a6adc8;--accent:#8179ef;--accent-hover:#938bf8}
*{box-sizing:border-box}
html{min-height:100%;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
body{min-height:100svh;margin:0;padding:32px 18px;display:grid;place-items:center;background:radial-gradient(750px 460px at 50% 0%,rgba(129,121,239,.13),transparent 78%),var(--bg)}
main{width:min(440px,100%);padding:32px;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:0 22px 70px rgba(0,0,0,.28)}
.brand{display:flex;align-items:center;gap:11px;margin-bottom:34px;font-weight:750;font-size:19px;letter-spacing:-.035em;color:var(--text)}
.brand svg{height:32px;width:32px;flex:none}.brand span{color:#a79dff}
.eyebrow{margin:0 0 12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#b6adff;font-weight:750}
h1{margin:0 0 14px;font-size:clamp(24px,5vw,29px);line-height:1.18;letter-spacing:-.04em;font-weight:730;color:#f4f1ff}
p{margin:0;color:var(--muted);font-size:14px;line-height:1.65}
strong{color:#f4f1ff;font-weight:700;overflow-wrap:anywhere}
.permissions{margin:24px 0;border:1px solid var(--line);border-radius:12px;padding:16px;background:#202031}
.permissions .label{display:block;margin-bottom:6px;color:#f2efff;font-size:13px;font-weight:700}
.permissions p{font-size:13px}
button,.primary{display:flex;width:100%;min-height:46px;align-items:center;justify-content:center;gap:10px;padding:12px 16px;border:1px solid transparent;border-radius:9px;background:var(--accent);color:#10101d;font:700 14px/1.25 inherit;text-decoration:none;cursor:pointer;transition:background .15s ease}
button{font-family:inherit;font-weight:700;font-size:14px}
button:hover,.primary:hover{background:var(--accent-hover)}
button:focus-visible,a:focus-visible{outline:2px solid #ded9ff;outline-offset:3px}
.note{margin-top:16px;text-align:center;font-size:12px}
a{color:#beb6ff;text-decoration:underline;text-underline-offset:3px}
.divider{height:1px;background:var(--line);margin:26px 0 20px}
.footer{color:#8586a2;font-size:11px;text-align:center}
.spinner{height:28px;width:28px;margin:24px 0;border:3px solid rgba(169,160,255,.22);border-top-color:#a79dff;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.spinner{animation:none;border-top-color:#a79dff}button{transition:none}}
@media(max-width:480px){main{padding:26px 22px}.brand{margin-bottom:27px}}
`;
const oauthHead = (title: string, extraHead = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1e1e2e"><title>${title} | Pico</title>${extraHead}<style>${oauthStyles}</style></head>`;
const oauthBrand = `<div class="brand">${picoLogo}<span>Pico.</span></div>`;


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
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || (env.GITHUB_ACCESS_MODE !== 'public' && !env.GITHUB_ALLOWED_ID)) return fail('OAuth not configured', 503);
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
  const page=`${oauthHead('Connect to Pico MCP')}<body><main>${oauthBrand}<div class="eyebrow">Secure connection</div><h1>Connect to Pico MCP</h1><p><strong>${display}</strong> wants permission to run Pico's programming tools using your GitHub identity.</p><div class="permissions"><span class="label">What you'll allow</span><p>Run code, generate flowcharts, and simulate circuits. Pico MCP cannot access your private Pico projects.</p></div><form method="post" action="/authorize"><input type="hidden" name="state" value="${state}"><button type="submit">Continue with GitHub <span aria-hidden="true">↗</span></button></form><p class="note">Only continue if you trust this AI client.</p><div class="divider"></div><p class="footer">To decline, close this page.</p></main></body></html>`;
  return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','Set-Cookie':secureCookie(state),'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://pico-oauth.mztaq.workers.dev https://github.com; base-uri 'none'; frame-ancestors 'none'"}});
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
  // A form POST followed by a cross-origin 302 can be blocked by Chromium's
  // form-action CSP redirect enforcement. Finish the POST with a separate
  // document navigation instead of redirecting the form submission chain.
  const githubUrl = url.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const html = `${oauthHead('Continue to GitHub', '<meta http-equiv="refresh" content="0; url=' + githubUrl + '">')}<body><main>${oauthBrand}<div class="eyebrow">Authentication</div><h1>Connecting to GitHub</h1><p>Redirecting you to GitHub to securely verify your account.</p><div class="spinner" aria-hidden="true"></div><a class="primary" href="${githubUrl}">Continue to GitHub <span aria-hidden="true">↗</span></a><p class="note">If the redirect doesn't start, use the button above.</p></main></body></html>`;
  return new Response(html, { status: 200, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
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
  if (env.GITHUB_ACCESS_MODE !== 'public' && String(user.id) !== env.GITHUB_ALLOWED_ID) return fail('GitHub account is not permitted', 403);
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
