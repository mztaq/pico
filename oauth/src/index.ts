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
// Styles and vector paths mirror the existing Pico landing without external assets or scripts.
const oauthCurves = "<svg class=\"curves\" viewBox=\"0 0 1600 1000\" preserveAspectRatio=\"xMidYMid slice\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M -170 -160 C 40 26 230 186 210 362 C 186 520 -27 624 104 814 C 222 981 376 1028 500 1108\" stroke-width=\"2.6\" opacity=\"0.72\"/><path d=\"M -230 -120 C -10 46 186 200 168 370 C 149 548 -75 659 62 850 C 174 1008 341 1080 476 1163\" stroke-width=\"1.5\" opacity=\"0.39\"/><path d=\"M 1260 -185 C 1080 30 1183 190 1375 350 C 1564 506 1459 670 1390 805 C 1334 954 1429 1075 1684 1176\" stroke-width=\"2.6\" opacity=\"0.72\"/><path d=\"M 1332 -220 C 1150 22 1246 193 1428 353 C 1599 511 1520 676 1441 819 C 1375 960 1478 1096 1743 1200\" stroke-width=\"1.5\" opacity=\"0.4\"/><path d=\"M 1010 -170 C 1080 -75 1162 -28 1190 105 C 1221 217 1286 251 1387 304\" stroke-width=\"1.3\" opacity=\"0.28\"/><path class=\"curve-flow\" pathLength=\"1000\" d=\"M -170 -160 C 40 26 230 186 210 362 C 186 520 -27 624 104 814 C 222 981 376 1028 500 1108\"/><path class=\"curve-flow curve-flow-right\" pathLength=\"1000\" d=\"M 1260 -185 C 1080 30 1183 190 1375 350 C 1564 506 1459 670 1390 805 C 1334 954 1429 1075 1684 1176\"/></svg>";
const oauthStyles = ":root{color-scheme:dark;--bg:#1e1e2e;--panel:#181825;--text:#cdd6f4;--muted:#a6adc8;--accent:#cba6f7}\n*{box-sizing:border-box}\nhtml{min-height:100%;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif}\nbody{position:relative;isolation:isolate;min-height:100svh;margin:0;display:grid;place-items:center;padding:28px 18px;overflow:hidden;background:var(--bg)}\n.curves{position:fixed;inset:-3%;width:106%;height:106%;z-index:-1;pointer-events:none;fill:none;stroke:var(--accent);opacity:.16;transform-origin:center center;will-change:transform}\n.curves path{stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}\n.curve-flow{stroke-width:3.8;stroke-dasharray:150 850;opacity:.24}\n@keyframes trace{to{stroke-dashoffset:-1000}}\n@keyframes curve-drift{0%{transform:translate3d(-1.1%,.8%,0) rotate(-1deg)}50%{transform:translate3d(1.1%,-.8%,0) rotate(1deg)}100%{transform:translate3d(-1.1%,.8%,0) rotate(-1deg)}}\n@media(prefers-reduced-motion:no-preference){.curves{animation:curve-drift 26s ease-in-out infinite}.curve-flow{animation:trace 29s linear infinite}.curve-flow-right{animation-duration:34s;animation-delay:-10s}}\n@media(prefers-reduced-motion:reduce){.curves,.curve-flow{animation:none;will-change:auto}}\n@media(forced-colors:active){.curves{display:none}}\nmain{width:min(446px,100%);position:relative;z-index:1;padding:38px 35px 30px;border:1px solid #3a3b52;border-radius:16px;background:rgba(24,24,37,.96);box-shadow:0 20px 70px rgba(0,0,0,.25)}\n.brand{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;margin:0 0 29px;font-size:47px;line-height:1;font-weight:800;letter-spacing:-2px;color:#fff}\n.brand svg{width:65px;height:65px;flex:none}.brand span{color:#fff}\nh1{font-size:20px;line-height:1.3;letter-spacing:-.025em;color:#fff;margin:0 0 12px;font-weight:700;text-align:center}\np{font-size:14px;line-height:1.6;color:var(--muted);margin:0;text-align:center}\nstrong{color:#fff;font-weight:700;overflow-wrap:anywhere}\n.permissions{margin:23px 0 25px;font-size:13px;line-height:1.7;color:var(--muted)}\n.permissions b{color:var(--text);font-weight:650}\nbutton,.primary{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;padding:11px 15px;border:0;border-radius:9px;background:var(--accent);color:#11111b;font:700 14px/1.25 system-ui,-apple-system,\"Segoe UI\",sans-serif;text-decoration:none;cursor:pointer;transition:background-color .15s ease}\nbutton:hover,.primary:hover{background:#dbbafa}\nbutton:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:3px}\n.cancel{font-size:12px;text-align:center;margin-top:15px;color:#8588a6}\n.spinner{width:27px;height:27px;border:3px solid #444054;border-top-color:var(--accent);border-radius:50%;margin:24px auto;animation:spin .8s linear infinite}\n@keyframes spin{to{transform:rotate(360deg)}}\n@media(prefers-reduced-motion:reduce){.spinner{animation:none}button,.primary{transition:none}}\n@media(max-width:480px){main{padding:30px 23px 26px}h1{font-size:19px}.brand{font-size:41px;margin-bottom:25px}.brand svg{width:57px;height:57px}}";
const oauthHead = (title: string, extraHead = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1e1e2e"><title>${title} | Pico</title>${extraHead}<style>${oauthStyles}</style></head>`;
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
  const page=`${oauthHead("Connect Pico")}<body>${oauthCurves}<main>${oauthBrand}<h1>Connect with GitHub</h1><p><strong>${display}</strong> wants permission to run Pico tools using your GitHub identity.</p><div class="permissions"><b>Allows:</b> Pseudocode, flowchart, logic and circuit tools.<br><b>Does not allow:</b> Access to your private Pico projects.</div><form method="post" action="/authorize"><input type="hidden" name="state" value="${state}"><button type="submit">Continue with GitHub</button></form><p class="cancel">Close this tab to cancel.</p></main></body></html>`;
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
  const html = `${oauthHead("Continue to GitHub", '<meta http-equiv="refresh" content="0; url=' + githubUrl + '">')}<body>${oauthCurves}<main>${oauthBrand}<h1>Taking you to GitHub</h1><p>Sign in to continue connecting Pico.</p><div class="spinner" aria-hidden="true"></div><a class="primary" href="${githubUrl}">Continue to GitHub</a></main></body></html>`;
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
