interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }
export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const url = new URL(request.url);
  const workspace = url.pathname.split('/')[2];
  if (!['pseudocode', 'python', 'flowchart', 'logic', 'cpu', 'binary'].includes(workspace)) return new Response('Not found', { status: 404 });
  url.pathname = '/';
  url.search = '';
  return env.ASSETS.fetch(new Request(url, request));
}
