import {describe,expect,it,vi} from 'vitest';
import {onRequestGet as workspaceRoute} from '../functions/app/[workspace]';
import {onRequestGet as nestedRoute} from '../functions/app/[[path]]';

function context(path:string){
  const fetch=vi.fn(async (request:Request)=>{
    const pathname=new URL(request.url).pathname;
    return new Response(pathname==='/404.html'?'<!doctype html><title>404 | Pico</title><h1>Pico checked this address.</h1>':'<!doctype html><title>Pico</title>',{
      status:200,headers:{'content-type':'text/html'}
    });
  });
  return {ctx:{request:new Request('https://picompiler.pages.dev'+path),env:{ASSETS:{fetch}}},fetch};
}

describe('Custom 404 for invalid app routes',()=>{
  it('serves the existing joke page with HTTP 404 for a missing workspace',async()=>{
    const {ctx,fetch}=context('/app/la');
    const response=await workspaceRoute(ctx);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('404 | Pico');
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/404.html');
  });
  it('keeps valid deep links loading the app',async()=>{
    for(const route of ['/app/flowchart','/app/logic','/app/team']){
      const {ctx,fetch}=context(route);
      const response=await workspaceRoute(ctx);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>Pico</title>');
      expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/');
    }
  });
  it('preserves the app homepage when a trailing slash reaches the fallback',async()=>{
    const {ctx,fetch}=context('/app/');
    const response=await nestedRoute(ctx);
    expect(response.status).toBe(200);
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/');
  });
  it('serves the same 404 page for unsupported nested paths',async()=>{
    const {ctx,fetch}=context('/app/not-a-workspace/other');
    const response=await nestedRoute(ctx);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('404 | Pico');
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/404.html');
  });
});
