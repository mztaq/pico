import {picoNotFound} from '../_lib/pico-not-found';
interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }
export async function onRequestGet({ request, env }: Context): Promise<Response> {
  const url = new URL(request.url);
  const workspace = url.pathname.split('/')[2];
  if (!['pseudocode', 'python', 'flowchart', 'logic', 'cpu', 'binary', 'traffic', 'team', 'terms', 'privacy', 'cookies', 'report'].includes(workspace)) return picoNotFound({request,env});
  url.pathname = '/';
  url.search = '';
  return env.ASSETS.fetch(new Request(url, request));
}
