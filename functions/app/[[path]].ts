interface AppContext { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }

/** Serve the SPA entry for a known workspace, keeping its path visible. */
export async function onRequestGet({ request, env }: AppContext): Promise<Response> {
  const url = new URL(request.url);
  if (!/^\/app\/(pseudocode|python|flowchart|logic|cpu|binary)\/?$/.test(url.pathname)) {
    return new Response('Not found', { status: 404 });
  }
  url.pathname = '/';
  url.search = '';
  const response = await env.ASSETS.fetch(new Request(url, request));
  return new Response(response.body, { status: response.status, headers: response.headers });
}
