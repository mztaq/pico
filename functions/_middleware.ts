type Env = { PICO_OAUTH_ISSUER?: string; PICO_OAUTH?: unknown };
type Context = { request: Request; env: Env; next(): Promise<Response> };
const METADATA_PATH = '/.well-known/oauth-protected-resource/app/mcp';
export async function onRequest(context: Context): Promise<Response> {
  if (new URL(context.request.url).pathname !== METADATA_PATH)
    return context.next();
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD')
    return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
  const { env } = context;
  if (!env.PICO_OAUTH_ISSUER || !env.PICO_OAUTH)
    return new Response('OAuth not configured', { status: 503, headers: { 'cache-control': 'no-store' } });
  try {
    const issuer = new URL(env.PICO_OAUTH_ISSUER);
    if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash || issuer.pathname !== '/')
      throw Error('Invalid issuer');
    return new Response(context.request.method === 'HEAD' ? null : JSON.stringify({
      resource: new URL('/app/mcp', context.request.url).href,
      authorization_servers: [issuer.origin],
      scopes_supported: ['mcp:run'],
      bearer_methods_supported: ['header'],
    }), { headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    } });
  } catch {
    return new Response('OAuth issuer misconfigured', { status: 503 });
  }
}
