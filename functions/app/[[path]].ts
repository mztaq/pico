import {picoNotFound} from '../_lib/pico-not-found';

interface Context { request: Request; env: { ASSETS: { fetch: (request: Request) => Promise<Response> } } }
const appRoute=/^\/app(?:\/(?:pseudocode|python|flowchart|logic|cpu|binary|sql|traffic|games|learn|team|terms|privacy|cookies|report|ai-usage))?\/?$/;

/** Handle Pages catch-all precedence without treating valid Pico app paths as 404s. */
export async function onRequestGet({request,env}:Context):Promise<Response>{
  const url=new URL(request.url);
  // The built asset is app/game/blackout-protocol.html. Cloudflare Pages
  // serves that file at its extensionless URL. Never fetch /index.html here:
  // Pages redirects that back to the folder URL and would cause a loop.
  if(/^\/app\/game\/blackout-protocol\/?$/.test(url.pathname)){
    // Serve both variants directly. A browser might have cached the former
    // folder redirect from /blackout-protocol to /blackout-protocol/.
    // Never redirect them back and forth.
    url.pathname='/app/game/blackout-protocol';
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
