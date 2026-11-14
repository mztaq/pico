import {picoNotFound} from '../_lib/pico-not-found';

interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }
const appRoute=/^\/app(?:\/(?:pseudocode|python|flowchart|logic|cpu|binary|traffic|games|team|terms|privacy|cookies|report))?\/?$/;

/** Handle Pages catch-all precedence without treating valid Pico app paths as 404s. */
export async function onRequestGet({request,env}:Context):Promise<Response>{
  const url=new URL(request.url);
  // Blackout is a separate Vite HTML entry, not the React workspace app.
  // Resolve both canonical and trailing-slash URLs to its built HTML asset.
  if(/^\/app\/game\/blackout-protocol\/?$/.test(url.pathname)){
    url.pathname='/app/game/blackout-protocol/index.html';
    url.search='';
    return env.ASSETS.fetch(new Request(url,request));
  }
  // Redirect preview links that used the earlier shorter game slug.
  if(/^\/app\/game\/blackout\/?$/.test(url.pathname)){
    return Response.redirect(new URL('/app/game/blackout-protocol',request.url),301);
  }
  if(appRoute.test(url.pathname)){
    url.pathname='/';
    url.search='';
    return env.ASSETS.fetch(new Request(url,request));
  }
  return picoNotFound({request,env});
}
