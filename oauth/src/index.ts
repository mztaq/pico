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
const oauthStyles = ":root{color-scheme:dark;--bg:#1e1e2e;--panel:#181825;--text:#cdd6f4;--muted:#a6adc8;--accent:#cba6f7}\n*{box-sizing:border-box}\nhtml{min-height:100%;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif}\nbody{position:relative;isolation:isolate;min-height:100svh;margin:0;display:grid;place-items:center;padding:28px 18px;overflow:hidden;background:var(--bg)}\n.curves{position:fixed;inset:-3%;width:106%;height:106%;z-index:-1;pointer-events:none;fill:none;stroke:var(--accent);opacity:.16;transform-origin:center center;will-change:transform}\n.curves path{stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}\n.curve-flow{stroke-width:3.8;stroke-dasharray:150 850;opacity:.24}\n@keyframes trace{to{stroke-dashoffset:-1000}}\n@keyframes curve-drift{0%{transform:translate3d(-1.6%,1%,0) rotate(-1.4deg)}50%{transform:translate3d(1.6%,-1%,0) rotate(1.4deg)}100%{transform:translate3d(-1.6%,1%,0) rotate(-1.4deg)}}\n@media(prefers-reduced-motion:no-preference){.curves{animation:curve-drift 16s ease-in-out infinite}.curve-flow{animation:trace 16s linear infinite}.curve-flow-right{animation-duration:19s;animation-delay:-6s}}\n@media(prefers-reduced-motion:reduce){.curves,.curve-flow{animation:none;will-change:auto}}\n@media(forced-colors:active){.curves{display:none}}\nmain{width:min(430px,100%);position:relative;z-index:1;padding:34px 32px 28px;border:1px solid #38394d;border-radius:16px;background:rgba(24,24,37,.96);box-shadow:0 20px 70px rgba(0,0,0,.22)}\n.brand{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;margin:0 0 24px;font-size:44px;line-height:1;font-weight:700;letter-spacing:-1.6px;color:#fff}\n.brand svg{width:62px;height:62px;flex:none}.brand span{color:#fff}\nh1{font-size:18px;line-height:1.3;letter-spacing:-.02em;color:#fff;margin:0 0 10px;font-weight:600;text-align:center}\np{font-size:14px;line-height:1.55;color:var(--muted);margin:0;text-align:center}\nstrong{color:#f1eefa;font-weight:600;overflow-wrap:anywhere}\n.permissions{margin:18px 0 22px;font-size:13px;line-height:1.65;color:var(--muted);text-align:center}\n.permissions b{color:var(--text);font-weight:600}\nbutton,.primary{display:flex;align-items:center;justify-content:center;width:100%;min-height:46px;padding:11px 15px;border:0;border-radius:9px;background:var(--accent);color:#11111b;font:600 14px/1.25 system-ui,-apple-system,\"Segoe UI\",sans-serif;text-decoration:none;cursor:pointer;transition:background-color .15s ease,transform .15s ease}\nbutton:hover,.primary:hover{background:#dbbafa}\nbutton:focus-visible,a:focus-visible{outline:2px solid #fff;outline-offset:3px}\n.cancel{font-size:12px;text-align:center;margin-top:15px;color:#8588a6}\n.spinner{width:27px;height:27px;border:3px solid #444054;border-top-color:var(--accent);border-radius:50%;margin:24px auto;animation:spin .8s linear infinite}\n@keyframes spin{to{transform:rotate(360deg)}}\n@media(prefers-reduced-motion:reduce){.spinner{animation:none}button,.primary{transition:none}}\n@media(max-width:480px){main{padding:30px 23px 26px}h1{font-size:18px}.brand{font-size:40px;margin-bottom:24px}.brand svg{width:58px;height:58px}}\n/* The app initiating consent is shown separately from Pico. */\n.brand{margin-bottom:22px}\n.consent-section{padding:18px 0;border-top:1px solid #38394d}\n.client-identity{display:flex;align-items:center;justify-content:center;gap:12px;min-width:0}\n.client-icon{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border:1px solid #4b4b60;border-radius:12px;background:#262638;overflow:hidden;color:#eae6fa;font-size:18px;font-weight:600}\n.client-icon img{width:100%;height:100%;object-fit:contain;display:block}\n.client-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px}\n.client-copy .client-name{max-width:260px;overflow-wrap:anywhere;color:#fff;font-size:14px;font-weight:600;line-height:1.35}\n.client-copy .client-caption{font-size:12px;color:var(--muted)}\n.consent-section h1{margin-bottom:9px}\n.consent-section p{font-size:13px}\n.permissions{margin:0;text-align:left;max-width:340px;margin-inline:auto;line-height:1.85}\n.permissions>div{display:flex;gap:9px;align-items:baseline}\n.permissions b{min-width:82px;white-space:nowrap;color:#ded9f1;font-weight:600}\n.consent-actions{padding-top:20px;border-top:1px solid #38394d}\n.consent-actions .cancel{margin-top:13px}\n@media(max-width:480px){.consent-section{padding:16px 0}.permissions{font-size:12px}.permissions b{min-width:75px}}\n/* OAuth connection pair: Pico and the requesting client, as in GitHub consent. */\n.connection-header{display:flex;align-items:flex-start;justify-content:center;gap:14px;padding:2px 0 25px}\n.connection-party{display:flex;flex-direction:column;align-items:center;gap:9px;width:116px;min-width:0}\n.connection-mark{height:62px;width:62px;display:grid;place-items:center;flex:none;border-radius:17px;overflow:hidden}\n.connection-mark svg{width:62px;height:62px}\n.connection-mark .client-icon{width:62px;height:62px;border-radius:17px;font-size:27px;font-weight:600}\n.connection-mark .client-icon img{width:100%;height:100%;object-fit:contain}\n.connection-label{color:#f4f1fa;font-size:14px;font-weight:600;line-height:1.4;max-width:116px;text-align:center;overflow-wrap:anywhere}\n.connection-link{display:flex;align-items:center;justify-content:center;gap:5px;padding-top:29px;color:#bdb6d4;min-width:42px}\n.connection-link::before,.connection-link::after{content:\"\";display:block;width:16px;border-top:2px dotted #55506b}\n.connection-link span{display:block;width:6px;height:6px;border-radius:50%;background:#a89be6}\n.consent-section:first-of-type{border-top:1px solid #38394d}\n@media(max-width:480px){.connection-header{gap:7px}.connection-party{width:104px}.connection-label{font-size:13px}.connection-link{min-width:34px;gap:3px}.connection-link::before,.connection-link::after{width:11px}}";
const oauthHead = (title: string, extraHead = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1e1e2e"><title>${title} | Pico</title><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(picoLogo)}">${extraHead}<style>${oauthStyles}</style></head>`;
const oauthBrand = `<div class="brand">${picoLogo}<span>Pico.</span></div>`;


// OAuth clients may advertise an optional logo_uri. Fetch on the Worker, never in the
// consent page, to avoid leaking the user's IP to untrusted client-controlled URLs.
// Only embed validated small raster files. Keep a neutral fallback otherwise.
function clientMonogram(name: string): string {
  const letter = Array.from(name.trim())[0] || '?';
  return letter.toLocaleUpperCase().replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[ch]);
}
function clientLogoUrl(candidate: string | undefined): URL | null {
  if (!candidate || candidate.length > 2048) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
        host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[') || !host.includes('.')) return null;
    return url;
  } catch { return null; }
}
async function loadClientLogo(candidate: string | undefined): Promise<string | null> {
  const url = clientLogoUrl(candidate);
  if (!url) return null;
  try {
    const response = await fetch(url.href, {
      redirect: 'manual', signal: AbortSignal.timeout(2200),
      headers: { Accept: 'image/png, image/jpeg, image/webp' },
    });
    if (!response.ok || !response.body) return null;
    const statedLength = Number(response.headers.get('content-length') || 0);
    if (statedLength > 96 * 1024) { await response.body.cancel(); return null; }
    const reader = response.body.getReader();
    const pieces: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 96 * 1024) { await reader.cancel(); return null; }
        pieces.push(value);
      }
    } finally { reader.releaseLock(); }
    if (!size) return null;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const piece of pieces) { bytes.set(piece, offset); offset += piece.byteLength; }
    // Verify binary signatures, not just the Content-Type claimed by the remote server.
    const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
    const jpeg = bytes.length >= 3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' &&
      String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
    return mime ? 'data:' + mime + ';base64,' + btoa(String.fromCharCode(...bytes)) : null;
  } catch { return null; }
}

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
  const clientName = client.clientName || parsed.clientId;
  const logo = await loadClientLogo(client.logoUri);
  const icon = logo ? `<img src="${logo}" alt="" width="38" height="38">` : clientMonogram(clientName);
  // Show the registered client name, but do not assert that its self-reported name or
  // optional logo proves the identity of the app.
  const clientIdentity = `<div class="connection-header"><div class="connection-party"><div class="connection-mark">${picoLogo}</div><div class="connection-label">Pico.</div></div><div class="connection-link" aria-hidden="true"><span></span></div><div class="connection-party"><div class="connection-mark"><div class="client-icon">${icon}</div></div><div class="connection-label">${display}</div></div></div>`;
  const page=`${oauthHead("Connect Pico")}<body>${oauthCurves}<main>${clientIdentity}<section class="consent-section" aria-label="Permissions"><h1>Continue with GitHub</h1><div class="permissions"><div><b>Allowed:</b><span>Run Pico programming tools.</span></div><div><b>Not allowed:</b><span>Access private Pico projects.</span></div></div></section><section class="consent-actions"><form method="post" action="/authorize"><input type="hidden" name="state" value="${state}"><button type="submit">Continue with GitHub</button></form><p class="cancel">Close this tab to cancel.</p></section></main></body></html>`;
  return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','Set-Cookie':secureCookie(state),'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self' https://pico-oauth.mztaq.workers.dev https://github.com; base-uri 'none'; frame-ancestors 'none'"}});
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
  const html = `${oauthHead("Continue to GitHub", '<meta http-equiv="refresh" content="0; url=' + githubUrl + '">')}<body>${oauthCurves}<main>${oauthBrand}<h1>Taking you to GitHub</h1><p>Sign in to connect Pico.</p><div class="spinner" aria-hidden="true"></div><a class="primary" href="${githubUrl}">Continue to GitHub</a></main></body></html>`;
  return new Response(html, { status: 200, headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'",
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
