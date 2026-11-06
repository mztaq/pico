import {picoNotFound} from '../_lib/pico-not-found';

interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }

/** Catch nested, unsupported /app/... paths. More-specific app routes take priority. */
export async function onRequestGet({request,env}:Context):Promise<Response>{
  // Preserve the trailing-slash app homepage if Pages routes it here.
  const url=new URL(request.url);
  if(url.pathname==='/app/'){
    url.pathname='/';
    url.search='';
    return env.ASSETS.fetch(new Request(url,request));
  }
  return picoNotFound({request,env});
}
