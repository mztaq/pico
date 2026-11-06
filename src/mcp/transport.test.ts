import { onRequest as onMiddlewareRequest } from '../../functions/_middleware';
import routes from '../../public/_routes.json';
// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {onRequest} from '../../functions/app/mcp';
const token='t'.repeat(40);
const env={PICO_MCP_TOKEN:token,PICO_MCP_LEGACY_AUTH:'enabled',PICO_MCP_RATE_GATE:{fetch:async()=>new Response(null,{status:204})}};
const invoke=(payload:unknown,authorization='Bearer '+token,settings:typeof env=env)=>onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(payload)}),env:settings});
describe('OAuth-only production defaults',()=>{
  it('rejects legacy shared bearer tokens without explicit opt-in',async()=>{
    const configured={...env,PICO_MCP_LEGACY_AUTH:undefined,
      PICO_OAUTH_ISSUER:'https://pico-oauth.example',
      PICO_OAUTH:{validateToken:async()=>null}};
    const r=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'POST',headers:{Authorization:'Bearer '+token},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'}),
    }),env:configured});
    expect(r.status).toBe(401);
  });
  it('fails closed if neither OAuth nor an explicitly enabled legacy mode is present',async()=>{
    const configured={...env,PICO_MCP_LEGACY_AUTH:undefined};
    const r=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'POST',headers:{Authorization:'Bearer '+token},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'}),
    }),env:configured});
    expect(r.status).toBe(503);
  });
});

describe('Pico MCP HTTP security',()=>{
  it('fails closed when secret or rate limiter is absent',async()=>{
    const r=await invoke({jsonrpc:'2.0',id:1,method:'tools/list'},undefined,{...env,PICO_MCP_TOKEN:''});
    expect(r.status).toBe(503);
  });
  it('rejects invalid bearer credentials',async()=>{
    expect((await invoke({jsonrpc:'2.0',id:1,method:'tools/list'},'Bearer wrong')).status).toBe(401);
  });
  it('enforces edge limiter',async()=>{
    const r=await invoke({jsonrpc:'2.0',id:1,method:'tools/list'},'Bearer '+token,{...env,PICO_MCP_RATE_GATE:{fetch:async()=>new Response(null,{status:429})}});
    expect(r.status).toBe(429);
  });
  it('rejects bad JSON and invalid JSON-RPC shapes',async()=>{
    const malformed=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{authorization:'Bearer '+token},body:'{bad'}),env});
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe(-32700);
    const invalid=await invoke({jsonrpc:'1.0',id:1,method:'ping'});
    expect(invalid.status).toBe(400);
  });
  it('rejects oversized payloads even without Content-Length',async()=>{
    const big=await invoke({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'pico_run_pseudocode',arguments:{code:'X'.repeat(33000)}}});
    expect(big.status).toBe(413);
  });
  it('rejects cross-origin browser requests and unknown methods',async()=>{
    const cross=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{authorization:'Bearer '+token,origin:'https://untrusted.example'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'})}),env});
    expect(cross.status).toBe(403);
    expect((await invoke({jsonrpc:'2.0',id:3,method:'arbitrary/command'})).status).toBe(404);
  });
  it('fails closed if its private rate gate fails',async()=>{
    const r=await invoke({jsonrpc:'2.0',id:1,method:'ping'},'Bearer '+token,{...env,PICO_MCP_RATE_GATE:{fetch:async()=>new Response(null,{status:503})}});
    expect(r.status).toBe(503);
  });
  it('keeps cached digest validation correct after token rotation',async()=>{
    const first=await invoke({jsonrpc:'2.0',id:1,method:'ping'});
    expect(first.status).toBe(200);
    const rotated='r'.repeat(40);
    const nextEnv={...env,PICO_MCP_TOKEN:rotated};
    expect((await invoke({jsonrpc:'2.0',id:2,method:'ping'},'Bearer '+token,nextEnv)).status).toBe(401);
    expect((await invoke({jsonrpc:'2.0',id:3,method:'ping'},'Bearer '+rotated,nextEnv)).status).toBe(200);
  });
  it('rejects missing and incorrect authentication',async()=>{
    expect((await invoke({jsonrpc:'2.0',id:1,method:'tools/list'},'')).status).toBe(401);
    expect((await invoke({jsonrpc:'2.0',id:1,method:'tools/list'},'Bearer '+token+'x')).status).toBe(401);
  });
  it('handles initialization and lists Pico tools',async()=>{
    const init=await invoke({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}});
    expect((await init.json()).result.serverInfo.name).toBe('pico-mcp');
    const listed=await invoke({jsonrpc:'2.0',id:2,method:'tools/list'});
    expect((await listed.json()).result.tools).toHaveLength(9);
  });
  it('advertises protected resource discovery for OAuth clients on GET',async()=>{
    const settings={...env,PICO_OAUTH_ISSUER:'https://pico-oauth.example',PICO_OAUTH:{validateToken:async()=>null}};
    const response=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'GET'}),env:settings});
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('oauth-protected-resource/app/mcp');
  });
  it('shows the selected-theme Pico page only for human browser navigation',async()=>{
    const html='<!doctype html><html><head><title>404 | Pico</title></head><body>Pico joke page</body></html>';
    const assets={fetch:async()=>new Response(html,{status:200,headers:{'content-type':'text/html'}})};
    const settings={...env,PICO_OAUTH_ISSUER:'https://pico-oauth.example',PICO_OAUTH:{validateToken:async()=>null},ASSETS:assets};
    const browser=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'GET',headers:{accept:'text/html,application/xhtml+xml','sec-fetch-mode':'navigate'}
    }),env:settings});
    expect(browser.status).toBe(401);
    expect(browser.headers.get('content-type')).toContain('text/html');
    expect(browser.headers.get('WWW-Authenticate')).toContain('oauth-protected-resource/app/mcp');
    expect(await browser.text()).toContain('Pico joke page');
    const api=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'GET',headers:{accept:'application/json','sec-fetch-mode':'navigate'}
    }),env:settings});
    expect(api.status).toBe(401);
    expect(api.headers.get('content-type')).toContain('application/json');
    expect((await api.json()).error).toBe('Authorization required.');
    const withBearer=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'GET',headers:{accept:'text/html','sec-fetch-mode':'navigate',authorization:'Bearer token'}
    }),env:settings});
    expect(withBearer.headers.get('content-type')).toContain('application/json');
    const machine=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'GET',headers:{accept:'text/html'}
    }),env:settings});
    expect(machine.headers.get('content-type')).toContain('application/json');
  });
  it('preserves MCP POST errors as JSON even when HTML is accepted',async()=>{
    const settings={...env,PICO_OAUTH_ISSUER:'https://pico-oauth.example',PICO_OAUTH:{validateToken:async()=>null},
      ASSETS:{fetch:async()=>new Response('<html></html>')}};
    const post=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{
      method:'POST',headers:{accept:'text/html','sec-fetch-mode':'navigate'},body:'{}'
    }),env:settings});
    expect(post.status).toBe(401);
    expect(post.headers.get('content-type')).toContain('application/json');
  });
  it('accepts scoped, resource-bound OAuth tokens through the private binding',async()=>{
    const settings={...env,PICO_OAUTH_ISSUER:'https://pico-oauth.example',PICO_OAUTH:{validateToken:async(resource:string,token:string)=>
      resource==='https://picompiler.pages.dev/app/mcp' && token==='oauth-test-token' ? {audience:resource,scope:['mcp:run'],userId:'123'} : null}};
    const ok=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{Authorization:'Bearer oauth-test-token'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'})}),env:settings});
    expect(ok.status).toBe(200);
    const denied=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{Authorization:'Bearer other'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'ping'})}),env:settings});
    expect(denied.status).toBe(401);
    expect(denied.headers.get('www-authenticate')).toContain('resource_metadata=');
  });
  it('refuses an OAuth token with a missing required scope',async()=>{
    const settings={...env,PICO_OAUTH_ISSUER:'https://pico-oauth.example',PICO_OAUTH:{validateToken:async(resource:string,token:string)=>({audience:resource,scope:['offline_access'],userId:token})}};
    const denied=await onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{Authorization:'Bearer oauth-test-token'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'})}),env:settings});
    expect(denied.status).toBe(401);
  });
  it('calls Pico engine and returns tool content',async()=>{
    const r=await invoke({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'pico_run_pseudocode',arguments:{code:'OUTPUT "ok"'}}});
    expect((await r.json()).result.structuredContent.output).toContain('ok');
  });
});

describe('OAuth Pages route configuration',()=>{
  it('includes OAuth protected-resource metadata in the Cloudflare Functions routes',()=>{
    expect(routes.include).toContain('/.well-known/oauth-protected-resource/*');
    expect(routes.include).toContain('/app/*');
  });
});

describe('OAuth discovery Pages middleware',()=>{
  it('serves metadata instead of the frontend fallback',async()=>{
    const r=await onMiddlewareRequest({
      request:new Request('https://feat-pico-mcp-github-oauth.picompiler.pages.dev/.well-known/oauth-protected-resource/app/mcp'),
      env:{PICO_OAUTH_ISSUER:'https://pico-oauth.mztaq.workers.dev',PICO_OAUTH:{}},
      next:async()=>new Response('SPA 404',{status:404}),
    });
    expect(r.status).toBe(200);
    expect((await r.json()).authorization_servers).toEqual(['https://pico-oauth.mztaq.workers.dev']);
  });
  it('passes unrelated routes through unchanged',async()=>{
    const r=await onMiddlewareRequest({
      request:new Request('https://picompiler.pages.dev/app/mcp'),
      env:{},
      next:async()=>new Response('existing MCP',{status:200}),
    });
    expect(await r.text()).toBe('existing MCP');
  });
});

describe('OAuth preview resource audience',()=>{
  it('challenges and validates against the same Preview resource URL',async()=>{
    const preview='https://feat-pico-mcp-github-oauth.picompiler.pages.dev/app/mcp';
    const seen:string[]=[];
    const settings={...env,PICO_OAUTH_ISSUER:'https://pico-oauth.mztaq.workers.dev',PICO_OAUTH:{
      validateToken:async(resource:string)=>{seen.push(resource);return {audience:resource,scope:['mcp:run'],userId:'123'};}
    }};
    const request=new Request(preview,{method:'POST',headers:{authorization:'Bearer oauth-preview-test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'})});
    const ok=await onRequest({request,env:settings});
    expect(ok.status).toBe(200);
    expect(seen).toEqual([preview]);
    const challenge=await onRequest({request:new Request(preview,{method:'GET'}),env:settings});
    expect(challenge.headers.get('WWW-Authenticate')).toContain('https://feat-pico-mcp-github-oauth.picompiler.pages.dev/.well-known/oauth-protected-resource/app/mcp');
  });
});
