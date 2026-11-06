interface NotFoundContext {
  request: Request;
  env: { ASSETS: { fetch: (request: Request) => Promise<Response> } };
}

/** Return Pico's existing joke-based 404 page without changing the requested URL. */
export async function picoNotFound({request,env}:NotFoundContext,status=404):Promise<Response>{
  const url=new URL('/404.html',request.url);
  const page=await env.ASSETS.fetch(new Request(url,{method:'GET'}));
  const headers=new Headers(page.headers);
  headers.set('content-type','text/html; charset=utf-8');
  headers.set('cache-control','no-store');
  return new Response(request.method==='HEAD'?null:page.body,{status,headers});
}
