interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface DownloadsContext {
  request: Request;
  env: { ASSETS: AssetFetcher };
}

/** Serve the React entry point while preserving /downloads in the browser URL. */
export async function onRequestGet({ request, env }: DownloadsContext): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = '/';
  url.search = '';
  return env.ASSETS.fetch(new Request(url, request));
}

export function onRequest(context: DownloadsContext): Promise<Response> | Response {
  return context.request.method === 'GET'
    ? onRequestGet(context)
    : new Response(null, { status: 405, headers: { Allow: 'GET' } });
}
