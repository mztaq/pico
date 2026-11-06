import {picoNotFound} from '../_lib/pico-not-found';

interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }
const appRoute=/^\/app(?:\/(?:pseudocode|python|flowchart|logic|cpu|binary|team|terms|privacy|cookies|report))?\/?$/;

/** Handle Pages catch-all precedence without treating valid Pico app paths as 404s. */
export async function onRequestGet({request,env}:Context):Promise<Response>{
  const url=new URL(request.url);
  if(appRoute.test(url.pathname)){
    url.pathname='/';
    url.search='';
    return env.ASSETS.fetch(new Request(url,request));
  }
  return picoNotFound({request,env});
}
