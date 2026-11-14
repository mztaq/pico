import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
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
  it('uses Pico saved theme on both 404 and MCP browser error pages',()=>{
    const html=readFileSync(new URL('../public/404.html',import.meta.url),'utf8');
    expect(html).toContain("'pico.settings.v6'");
    expect(html).toContain("root.style.setProperty('--'+name,theme[name])");
    expect(html).toContain("location.pathname === '/app/mcp'");
    expect(html).toContain("const elements = [...document.querySelectorAll");
  });
  it('serves the existing joke page with HTTP 404 for a missing workspace',async()=>{
    const {ctx,fetch}=context('/app/la');
    const response=await workspaceRoute(ctx);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('404 | Pico');
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/404.html');
  });
  it('keeps valid deep links loading the app',async()=>{
    for(const route of ['/app/flowchart','/app/logic','/app/traffic','/app/traffic/','/app/games','/app/games/','/app/team']){
      const {ctx,fetch}=context(route);
      const response=await workspaceRoute(ctx);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>Pico</title>');
      expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/');
    }
  });
  it('keeps /app and /app/ working even when Pages selects the catch-all',async()=>{
    for(const route of ['/app','/app/']){
      const {ctx,fetch}=context(route);
      const response=await nestedRoute(ctx);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>Pico</title>');
      expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/');
    }
  });
  it('keeps direct workspaces and information pages working through the catch-all',async()=>{
    for(const route of ['/app/flowchart','/app/logic','/app/python','/app/traffic','/app/traffic/','/app/games','/app/games/','/app/team','/app/report']){
      const {ctx,fetch}=context(route);
      const response=await nestedRoute(ctx);
      expect(response.status).toBe(200);
      expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/');
    }
  });
  it('loads the standalone game at its canonical URL without requesting an index.html redirect',async()=>{
    const {ctx,fetch}=context('/app/game/blackout-protocol');
    const response=await nestedRoute(ctx);
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/app/game/blackout-protocol');
    // Cloudflare Pages redirects directory index.html files to their clean
    // paths, so fetching one from a clean-path Function causes a loop.
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).not.toContain('/index.html');
  });
  it('normalizes the trailing slash once without recursively requesting the asset',async()=>{
    const {ctx,fetch}=context('/app/game/blackout-protocol/');
    const response=await nestedRoute(ctx);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://picompiler.pages.dev/app/game/blackout-protocol');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('builds an independent flat HTML file that Pages serves at the extensionless game URL',()=>{
    const html=readFileSync(new URL('../app/game/blackout-protocol.html',import.meta.url),'utf8');
    const vite=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
    expect(html).toContain('src="/src/blackout/entry.ts"');
    expect(vite).toContain("'app/game/blackout-protocol.html'");
  });
  it('redirects the former shorter game slug to the canonical path',async()=>{
    for(const path of ['/app/game/blackout','/app/game/blackout/']){
      const {ctx,fetch}=context(path);
      const response=await nestedRoute(ctx);
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe('https://picompiler.pages.dev/app/game/blackout-protocol');
      expect(fetch).not.toHaveBeenCalled();
    }
  });
  it('redirects older Blackout links to the nested Games route',()=>{
    const redirects=readFileSync(new URL('../public/_redirects',import.meta.url),'utf8');
    const oldPage=readFileSync(new URL('../public/blackout-protocol.html',import.meta.url),'utf8');
    expect(redirects).toMatch(/^\/blackout-protocol\s+\/app\/game\/blackout-protocol\s+301$/m);
    expect(redirects).toMatch(/^\/blackout-protocol\/\s+\/app\/game\/blackout-protocol\s+301$/m);
    expect(oldPage).toContain("location.replace('/app/game/blackout-protocol')");
  });
  it('rejects unregistered game paths instead of rendering the React workspace app',async()=>{
    for(const path of ['/app/game','/app/game/unknown','/app/game/blackout-protocol/extra']){
      const {ctx,fetch}=context(path);
      const response=path==='/app/game'?await workspaceRoute(ctx):await nestedRoute(ctx);
      expect(response.status).toBe(404);
      expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/404.html');
    }
  });
  it('serves the same 404 page for unsupported nested paths',async()=>{
    const {ctx,fetch}=context('/app/not-a-workspace/other');
    const response=await nestedRoute(ctx);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('404 | Pico');
    expect(new URL(fetch.mock.calls[0]![0].url).pathname).toBe('/404.html');
  });
});
