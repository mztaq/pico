import {callTool,listTools} from '../../src/mcp/tools';

type Env={PICO_MCP_TOKEN?:string;PICO_MCP_RATE_GATE?:{fetch(input:Request):Promise<Response>}};
type Context={request:Request;env:Env};
const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
const error=(id:unknown,code:number,message:string)=>({jsonrpc:'2.0',id,error:{code,message}});
const result=(id:unknown,value:unknown)=>({jsonrpc:'2.0',id,result:value});
async function authenticated(req:Request,env:Env) {
  if (!env.PICO_MCP_TOKEN || env.PICO_MCP_TOKEN.length<32 || !env.PICO_MCP_RATE_GATE) return {status:503,description:'MCP service is not configured.'};
  const auth=req.headers.get('authorization')??'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  const provided=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  const expected=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.PICO_MCP_TOKEN));
  let mismatch=token.length===env.PICO_MCP_TOKEN.length?0:1;
  const a=new Uint8Array(provided),b=new Uint8Array(expected);
  for(let i=0;i<a.length;i++)mismatch |= a[i]! ^ b[i]!;
  if(mismatch) return {status:401,description:'Unauthorized.'};
  const key=Array.from(a.slice(0,16)).map(x=>x.toString(16).padStart(2,'0')).join('');
  try {
    const checked=await env.PICO_MCP_RATE_GATE.fetch(new Request('https://internal/rate', {method:'POST',headers:{'x-pico-rate-key':key}}));
    if(checked.status===429)return {status:429,description:'Rate limit exceeded.'};
    if(checked.status!==204)return {status:503,description:'Rate limiter unavailable.'};
  } catch{return {status:503,description:'Rate limiter unavailable.'};}
  return null;
}
export async function onRequest({request,env}:Context):Promise<Response> {
  if(request.method==='OPTIONS')return new Response(null,{status:405,headers});
  if(request.method==='GET')return response({error:'Use authenticated MCP POST requests.'},405);
  if(request.method!=='POST')return response({error:'Method not allowed.'},405);
  const origin=request.headers.get('origin');
  if(origin && origin !== new URL(request.url).origin)return response({error:'Cross-origin browser access forbidden.'},403);
  const fail=await authenticated(request,env);
  if(fail)return response({error:fail.description},fail.status);
  if(Number(request.headers.get('content-length')??0)>32768)return response({error:'Request too large.'},413);
  let raw:string;
  try {
    const reader=request.body?.getReader();
    if(!reader)return response({error:'Empty request.'},400);
    const chunks:Uint8Array[]=[];
    let bytes=0;
    while(true) {
      const {value,done}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>32768){await reader.cancel();return response({error:'Request too large.'},413);}
      chunks.push(value);
    }
    const body=new Uint8Array(bytes);
    let position=0;
    for(const chunk of chunks){body.set(chunk,position);position+=chunk.byteLength;}
    raw=new TextDecoder('utf-8',{fatal:true}).decode(body);
  } catch{return response({error:'Unable to read request.'},400);}
  let message:Record<string,unknown>;
  try {const parsed=JSON.parse(raw);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')throw Error();message=parsed;}
  catch{return response(error(null,-32700,'Parse error.'),400);}
  const id=message.id??null;
  if(message.jsonrpc!=='2.0'||typeof message.method!=='string')return response(error(id,-32600,'Invalid JSON-RPC request.'),400);
  if(message.method==='notifications/initialized')return new Response(null,{status:202,headers});
  if(message.method==='initialize')return response(result(id,{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'pico-mcp',version:'0.1.0'},instructions:'Tools execute isolated Pico documents; they do not access user projects or accounts.'}));
  if(message.method==='ping')return response(result(id,{}));
  if(message.method==='tools/list')return response(result(id,{tools:listTools()}));
  if(message.method==='tools/call') {
    const params=message.params;
    if(!params||typeof params!=='object'||Array.isArray(params))return response(error(id,-32602,'Invalid parameters.'),400);
    const p=params as Record<string,unknown>;
    if(typeof p.name!=='string')return response(error(id,-32602,'Missing tool name.'),400);
    try {
      const value=callTool(p.name,p.arguments??{});
      return response(result(id,{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:false}));
    }catch(ex) {
      const message=ex instanceof Error?ex.message:'Tool failed.';
      return response(result(id,{content:[{type:'text',text:message.slice(0,500)}],isError:true}));
    }
  }
  return response(error(id,-32601,'Method not found.'),404);
}
