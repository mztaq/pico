/** Private Cloudflare Worker deployed without a public route.
 * Bound into Pico Pages as PICO_MCP_RATE_GATE service binding.
 * The Workers Rate Limiting binding is not directly available in Pages Functions.
 */
interface Env { RATE_LIMITER:{limit(input:{key:string}):Promise<{success:boolean}>} }
export default {
  async fetch(request:Request,env:Env):Promise<Response> {
    if(request.method!=='POST'||new URL(request.url).pathname!=='/rate')return new Response(null,{status:404});
    const key=request.headers.get('x-pico-rate-key');
    if(!key || !/^[a-f0-9]{32}$/.test(key))return new Response(null,{status:400});
    try {
      const allowed=await env.RATE_LIMITER.limit({key:'pico-mcp:'+key});
      return new Response(null,{status:allowed.success?204:429});
    } catch { return new Response(null,{status:503}); }
  }
};
