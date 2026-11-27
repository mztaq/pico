// Public Pico status API. Only non-sensitive monitor data leaves this function.
// Add UPTIMEROBOT_API_KEY to Cloudflare Pages Preview secrets.
const SERVICES = [
  {id:"website", name:"Pico Website", target:"https://picompiler.pages.dev"},
  {id:"mcp", name:"Pico MCP", target:"https://picompiler.pages.dev/.well-known/oauth-protected-resource/app/mcp"},
  {id:"oauth", name:"Pico OAuth", target:"https://pico-oauth.mztaq.workers.dev/.well-known/oauth-authorization-server"},
];
const ROOT = "https://api.uptimerobot.com/v3";
const DAY = 86400000;

function response(payload, code=200) {
  return new Response(JSON.stringify(payload), {
    status:code,
    headers: {
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":code===200?"public, max-age=60, s-maxage=300":"no-store",
      "X-Content-Type-Options":"nosniff",
    }
  });
}
function normalise(input) {
  try { const url=new URL(input); return (url.origin+url.pathname).replace(/\/+$/,"").toLowerCase(); }
  catch { return ""; }
}
function getMonitor(monitors, service) {
  // Prefer the exact public endpoint, because UptimeRobot defaults friendly names to URLs.
  const target=normalise(service.target);
  const sameUrl=monitors.find(m=>normalise(m.url)===target);
  if(sameUrl)return sameUrl;
  // Support monitors previously created for the old root URL as well.
  const original={
    website:"https://picompiler.pages.dev",
    mcp:"https://picompiler.pages.dev/app/mcp",
    oauth:"https://pico-oauth.mztaq.workers.dev",
  };
  return monitors.find(m=>String(m.friendlyName||m.friendly_name||"").trim().toLowerCase()===service.name.toLowerCase())
    ?? monitors.find(m=>normalise(m.url)===normalise(original[service.id]))
    ?? null;
}
function state(monitor) {
  switch (String(monitor?.status||"").toUpperCase()) {
    case "UP": return "up";
    case "DOWN": return "down";
    case "LOOKS_DOWN": return "degraded";
    case "PAUSED": return "paused";
    default: return "unknown";
  }
}
function validPercent(value) {
  // Different API clients expose the stats object directly or inside data.
  const raw=value?.uptime ?? value?.data?.uptime;
  const p=typeof raw==="string" && raw.trim()!=="" ? Number(raw) : raw;
  return typeof p==="number" && Number.isFinite(p) && p>=0 && p<=100 ? Math.round(p*100)/100 : null;
}
function validMonitorId(value) {
  const id=typeof value==="string" && /^\d+$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(id)&&id>0?id:null;
}
async function uptimeStats(path,key) {
  // UptimeRobot sometimes throttles simultaneous per-monitor statistics calls.
  // Retry transient errors once and never misreport an unknown value as 100%.
  for(let attempt=0;attempt<2;attempt++) {
    try { return await api(path,key); }
    catch(error) {
      if(attempt===1 || !/Monitoring API: (429|5\d\d)/.test(String(error))) throw error;
      await new Promise(resolve=>setTimeout(resolve,750));
    }
  }
}
async function api(path,key) {
  const res=await fetch(ROOT+path,{
    headers:{Authorization:"Bearer "+key,Accept:"application/json"},
    signal:AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Monitoring API: "+res.status);
  return res.json();
}
function incidentTime(value) {
  if (typeof value==="number") return value>1e11?value:value*1000;
  const time=Date.parse(value);
  return Number.isFinite(time)?time:NaN;
}
function entry(incident,service,now) {
  const start=incidentTime(incident.startedAt);
  if (!Number.isFinite(start)) return null;
  const rawEnd=incident.resolvedAt?incidentTime(incident.resolvedAt):null;
  const end=Number.isFinite(rawEnd)?rawEnd:null;
  if (start>now) return null;
  return {
    id:String(incident.id??""),
    serviceId:service.id,
    service:service.name,
    reason:String(incident.reason||"Service interruption").slice(0,150),
    startedAt:new Date(start).toISOString(),
    resolvedAt:end==null?null:new Date(end).toISOString(),
    startedMs:start,
    endedMs:end??now,
    isDowntime:!incident.type || String(incident.type).toLowerCase()==="downtime",
  };
}
function history(incidentList,service,monitor,now) {
  if (!monitor || !Array.isArray(incidentList)) return Array(30).fill(null);
  const created=incidentTime(monitor.createDateTime||monitor.createdAt||monitor.created||monitor.created_at);
  if (!Number.isFinite(created)) return Array(30).fill(null);
  const entries=incidentList.filter(i=>i.serviceId===service.id&&i.isDowntime);
  const days=[];
  for (let i=29;i>=0;i--) {
    const start=now-(i+1)*DAY;
    const end=Math.min(now, start+DAY);
    if (Number.isFinite(created)&&created>end) {days.push(null);continue;}
    let downtime=0;
    for (const incident of entries) {
      const overlap=Math.max(0,Math.min(end,incident.endedMs)-Math.max(start,incident.startedMs));
      if (overlap>0)downtime+=overlap;
    }
    days.push(downtime>=.9*(end-start)?"down":downtime>0?"degraded":"up");
  }
  return days;
}
// An HTTP 200 response does not mean every feature is healthy.
// Incident severity is separate from uptime statistics supplied by UptimeRobot.
// Count each distinct incident once in the 30-day availability estimate.
// A continuing incident, new timeline update, or repeated provider record
// must not reduce this figure again on each refresh. Each incident contributes
// one incident-day, rather than treating its ongoing duration as fresh downtime.
// This is an incident-based estimate, separate from HTTP uptime statistics.
export function incidentAdjustedAvailability(service, incidents, now=Date.now()) {
  const uptime=service.uptime30d;
  if(typeof uptime!=="number"||!Number.isFinite(uptime)) return null;
  if(!Array.isArray(incidents)) return uptime;
  const since=now-30*DAY;
  const unique=new Set();
  for(const incident of incidents) {
    if(!incident || incident.serviceId!==service.id)continue;
    const started=incidentTime(incident.startedAt);
    if(!Number.isFinite(started) || started>now || started<since)continue;
    const id=incident.id==null || String(incident.id).trim()===""
      ? "started:"+started
      : "id:"+String(incident.id);
    unique.add(id);
  }
  const incidentAvailability=Math.max(0,100-unique.size*100/30);
  // Keep actual HTTP downtime reflected without counting it twice as a
  // separate incident-based deduction.
  return Math.round(Math.min(uptime,incidentAvailability)*100)/100;
}

export function applyIncidentImpact(services, incidents) {
  if (!Array.isArray(incidents)) return services;
  const affected = new Set(incidents.filter(incident =>
    incident && !incident.resolvedAt &&
    String(incident.status || "").toLowerCase() !== "resolved" &&
    typeof incident.serviceId === "string"
  ).map(incident => incident.serviceId));
  return services.map(service => {
    if (!affected.has(service.id) || service.status !== "up") return service;
    const history = Array.isArray(service.history) ? [...service.history] : service.history;
    if (Array.isArray(history) && history.length && history[history.length - 1] === "up") {
      history[history.length - 1] = "degraded";
    }
    return {...service, status:"degraded", history};
  });
}

export async function onRequestGet(context) {
  const unknown=SERVICES.map(s=>({...s,status:"unknown",uptime24h:null,uptime30d:null,history:Array(30).fill(null)}));
  const key=context.env.UPTIMEROBOT_API_KEY;
  if (!key) return response({state:"unconfigured",updatedAt:null,services:unknown,incidents:null});
  const cache=typeof caches!=="undefined"?caches.default:null;
  const cacheKey=new Request(new URL("/api/status",context.request.url).toString());
  if (cache) {
    const cached=await cache.match(cacheKey);
    if (cached) return cached;
  }
  try {
    const result=await api("/monitors?limit=200",key);
    if (!Array.isArray(result.data)) throw new Error("Unexpected monitor format");
    const monitors=result.data;
    const now=Date.now();
    const since30=new Date(now-30*DAY).toISOString();
    const services=SERVICES.map(service=>{
      const monitor=getMonitor(monitors,service);
      return {...service,monitor,monitorId:validMonitorId(monitor?.id),status:monitor?state(monitor):"not_monitored",uptime24h:null,uptime30d:null};
    });
    const matched=services.filter(s=>Number.isSafeInteger(s.monitorId)&&s.monitorId>0);
    // One uptime-stat request per monitor. The UI only displays 30-day uptime.
    const queries=matched.map(s=>(
      {id:s.id,key:"uptime30d",path:"/monitors/"+s.monitorId+"/stats/uptime?from="+encodeURIComponent(since30)}
    ));
    // Query each monitor sequentially to avoid short bursts of API rate limits.
    for(const query of queries) {
      try {
        const stats=await uptimeStats(query.path,key);
        const service=services.find(s=>s.id===query.id);
        if(service)service[query.key]=validPercent(stats);
      } catch(error) {
        console.error("Monitor uptime statistics unavailable",query.id,String(error));
      }
    }
    let incidentsAnswer;
    try {
      incidentsAnswer={status:"fulfilled",value:await api("/incidents?limit=100&started_after="+encodeURIComponent(since30),key)};
    } catch(error) {
      console.error("Monitoring incident list unavailable",String(error));
      incidentsAnswer={status:"rejected"};
    }
    const rawIncidents=incidentsAnswer.status==="fulfilled"&&Array.isArray(incidentsAnswer.value?.data)&&!incidentsAnswer.value?.nextLink?incidentsAnswer.value.data:null;
    const byMonitor=new Map(matched.map(s=>[s.monitorId,s]));
    const allEntries=rawIncidents===null?null:rawIncidents.map(i=>{
      const matchedService=byMonitor.get(Number(i?.monitor?.id));
      return matchedService?entry(i,matchedService,now):null;
    }).filter(Boolean).sort((a,b)=>b.startedMs-a.startedMs);
    const publicServices=services.map(s=>({
      id:s.id,name:s.name,status:s.status,uptime24h:s.uptime24h,uptime30d:s.uptime30d,
      monitoredSince:s.monitor&&Number.isFinite(incidentTime(s.monitor.createDateTime||s.monitor.createdAt||s.monitor.created||s.monitor.created_at))?new Date(incidentTime(s.monitor.createDateTime||s.monitor.createdAt||s.monitor.created||s.monitor.created_at)).toISOString():null,
      history:s.uptime30d===null?Array(30).fill(null):history(allEntries,s,s.monitor,now),
    }));
    let incidents=allEntries?.filter(i=>i.endedMs>=now-30*DAY).slice(0,12).map(({startedMs,endedMs,isDowntime,...i})=>i)??null;
    // Include D1-archived incidents if the Pages Preview has an existing DB binding.
    // Never let a missing migration or D1 outage disable live status results.
    if(context.env.DB) {
      try {
        const stored=await context.env.DB.prepare(
          "SELECT id, source, external_id, service_id, title, reason, started_at, resolved_at, status " +
          "FROM pico_status_incidents WHERE started_at >= ? OR resolved_at >= ? OR resolved_at IS NULL " +
          "ORDER BY started_at DESC LIMIT 100"
        ).bind(since30,since30).all();
        const rows=stored.results??[];
        const ids=rows.map(row=>row.id);
        const updatesByIncident=new Map();
        if(ids.length) {
          const history=await context.env.DB.prepare(
            "SELECT incident_id,stage,message,published_at FROM pico_status_updates WHERE incident_id IN (" +
            ids.map(()=>'?').join(',') + ") ORDER BY published_at DESC, id DESC"
          ).bind(...ids).all();
          for(const event of history.results??[]) {
            if(!updatesByIncident.has(event.incident_id))updatesByIncident.set(event.incident_id,[]);
            updatesByIncident.get(event.incident_id).push({
              stage:event.stage,
              message:event.message,
              publishedAt:event.published_at
            });
          }
        }
        const known=new Map((incidents??[]).map(i=>[String(i.id),i]));
        for(const row of rows) {
          const id=String(row.external_id);
          const name=SERVICES.find(s=>s.id===row.service_id)?.name??'Pico';
          known.set(id,{
            id,serviceId:row.service_id,service:name,title:row.title,
            reason:row.reason,
            updates:updatesByIncident.get(row.id)||[],
            startedAt:row.started_at,resolvedAt:row.resolved_at,status:row.status
          });
        }
        if((stored.results??[]).length)incidents=[...known.values()]
          .sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt)).slice(0,12);
      } catch(error) {
        console.error('Incident archive lookup unavailable',String(error));
      }
    }
    const visibleServices=applyIncidentImpact(publicServices,incidents).map(service=>{
      // Keep historical incident impact in the earlier bars; the final bar
      // represents the service's current health rather than past downtime.
      const timeline=Array.isArray(service.history)?[...service.history]:null;
      if(timeline?.length===30 && Array.isArray(incidents)){
        for(const incident of incidents){
          if(incident?.serviceId!==service.id)continue;
          const start=incidentTime(incident.startedAt);
          const end=incident.resolvedAt?incidentTime(incident.resolvedAt):now;
          if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
          for(let day=0;day<30;day++){
            const from=now-(30-day)*DAY, to=from+DAY;
            if(start<to && end>from && timeline[day]==="up")timeline[day]="degraded";
          }
        }
      }
      // A resolved incident must not keep the latest box degraded. Use the
      // effective live status (including unresolved incidents and monitor outages).
      if(timeline?.length===30){
        timeline[29]=["up","degraded","down"].includes(service.status)?service.status:null;
      }
      return {
        ...service,
        history:timeline??service.history,
        availability30d:incidentAdjustedAvailability(service,incidents,now)
      };
    });
    const payload={state:matched.length?"connected":"no-monitors",updatedAt:new Date(now).toISOString(),services:visibleServices,incidents};
    const output=response(payload);
    if(cache&&context.waitUntil)context.waitUntil(cache.put(cacheKey,output.clone()));
    return output;
  } catch {
    return response({state:"unavailable",updatedAt:null,services:unknown,incidents:null},503);
  }
}
