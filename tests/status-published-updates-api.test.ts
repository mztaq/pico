import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from '../functions/api/status.js';

afterEach(()=>vi.unstubAllGlobals());

describe('public status API published incident updates',()=>{
  it('returns all admin updates, newest first, with their stage and publication time',async()=>{
    const now=new Date().toISOString();
    const started=new Date(Date.now()-3600000).toISOString();
    vi.stubGlobal('fetch',vi.fn(async (input: string | URL | Request)=>{
      const url=String(input);
      let data:unknown;
      if(url.includes('/monitors?')) data={data:[{
        id:1,url:'https://picompiler.pages.dev',status:'UP',createDateTime:started
      }]};
      else if(url.includes('/stats/uptime')) data={uptime:100};
      else if(url.includes('/incidents?')) data={data:[]};
      else throw Error('Unexpected API '+url);
      return new Response(JSON.stringify(data),{status:200});
    }));
    const db={
      prepare(sql:string) {
        if(sql.includes('FROM pico_status_incidents'))return {
          bind:()=>({all:async()=>({results:[{
            id:5,external_id:'manual-5',source:'manual',service_id:'website',
            title:'Flowchart zoom',reason:'Initial investigation.',
            started_at:started,resolved_at:null,status:'identified',
          }]})}),
        };
        if(sql.includes('FROM pico_status_updates'))return {
          bind:()=>({all:async()=>({results:[
            {incident_id:5,stage:'identified',message:'We isolated the zoom issue.',published_at:now},
            {incident_id:5,stage:'investigating',message:'Initial investigation.',published_at:started},
          ]})}),
        };
        throw Error('Unexpected SQL');
      },
    };
    const response=await onRequestGet({
      request:new Request('https://status.example.test/api/status'),
      env:{UPTIMEROBOT_API_KEY:'test-key',DB:db},
    } as never);
    expect(response.status).toBe(200);
    const payload=await response.json();
    expect(payload.incidents[0].reason).toBe('Initial investigation.');
    expect(payload.incidents[0].updates).toEqual([
      {stage:'identified',message:'We isolated the zoom issue.',publishedAt:now},
      {stage:'investigating',message:'Initial investigation.',publishedAt:started},
    ]);
    expect(payload.services[0].status).toBe('degraded');
    expect(response.headers.get('Cache-Control')).toContain('max-age=60');
  });
});

describe('status uptime API resilience',()=>{
  it('accepts string monitor IDs and retries transient stats failures without losing other services',async()=>{
    const seen:string[]=[];
    let websiteAttempts=0;
    vi.stubGlobal('fetch',vi.fn(async (input:string|URL|Request)=>{
      const url=String(input);
      seen.push(url);
      if(url.includes('/monitors?'))return new Response(JSON.stringify({data:[
        {id:'10',url:'https://picompiler.pages.dev',status:'UP'},
        {id:11,url:'https://picompiler.pages.dev/.well-known/oauth-protected-resource/app/mcp',status:'UP'},
        {id:'12',url:'https://pico-oauth.mztaq.workers.dev/.well-known/oauth-authorization-server',status:'UP'},
      ]}));
      if(url.includes('/monitors/10/stats/uptime')) {
        websiteAttempts++;
        if(websiteAttempts===1)return new Response('Rate limited',{status:429});
        return new Response(JSON.stringify({data:{uptime:99.8}}));
      }
      if(url.includes('/monitors/11/stats/uptime'))return new Response(JSON.stringify({uptime:100}));
      if(url.includes('/monitors/12/stats/uptime'))return new Response(JSON.stringify({uptime:'99.5'}));
      if(url.includes('/incidents?'))return new Response(JSON.stringify({data:[]}));
      throw Error('Unexpected request '+url);
    }));
    const response=await onRequestGet({
      request:new Request('https://status.example.test/api/status'),
      env:{UPTIMEROBOT_API_KEY:'test-key'},
    } as never);
    const payload=await response.json();
    expect(payload.services.map((s:{availability30d:number})=>s.availability30d)).toEqual([99.8,100,99.5]);
    expect(websiteAttempts).toBe(2);
    expect(seen.filter(url=>url.includes('/stats/uptime'))).toHaveLength(4);
    expect(seen.at(-1)).toContain('/incidents?');
  });
  it('does not invent availability when monitor statistics remain unavailable',async()=>{
    vi.stubGlobal('fetch',vi.fn(async (input:string|URL|Request)=>{
      const url=String(input);
      if(url.includes('/monitors?'))return new Response(JSON.stringify({data:[{
        id:10,url:'https://picompiler.pages.dev',status:'UP'
      }]}));
      if(url.includes('/stats/uptime'))return new Response('Forbidden',{status:403});
      if(url.includes('/incidents?'))return new Response(JSON.stringify({data:[]}));
      throw Error('Unexpected request '+url);
    }));
    const response=await onRequestGet({
      request:new Request('https://status.example.test/api/status'),
      env:{UPTIMEROBOT_API_KEY:'test-key'},
    } as never);
    const payload=await response.json();
    expect(payload.services[0].status).toBe('up');
    expect(payload.services[0].availability30d).toBeNull();
  });
});
