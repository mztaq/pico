interface AppContext { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }
/** Serve the app's SPA entry HTML at /app, leaving the actual browser URL unchanged. */
export async function onRequestGet({ request, env }: AppContext): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = '/';
  url.search = '';
  const response = await env.ASSETS.fetch(new Request(url, request));
  return new Response(response.body, { status: response.status, headers: response.headers });
}
