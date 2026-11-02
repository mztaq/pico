// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {onRequest} from '../../functions/app/mcp';
const token='t'.repeat(40);
const env={PICO_MCP_TOKEN:token,PICO_MCP_RATE_GATE:{fetch:async()=>new Response(null,{status:204})}};
const invoke=(payload:unknown,authorization='Bearer '+token,settings:typeof env=env)=>onRequest({request:new Request('https://picompiler.pages.dev/app/mcp',{method:'POST',headers:{authorization,'content-type':'application/json'},body:JSON.stringify(payload)}),env:settings});
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
