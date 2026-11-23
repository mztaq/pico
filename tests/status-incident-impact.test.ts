import { describe, expect, it } from "vitest";
import { applyIncidentImpact, incidentAdjustedAvailability } from "../functions/api/status.js";

const services = () => [
  {id:"website",name:"Pico Website",status:"up",uptime30d:100,history:Array(30).fill("up")},
  {id:"mcp",name:"Pico MCP",status:"up",uptime30d:100,history:Array(30).fill("up")},
  {id:"oauth",name:"Pico OAuth",status:"down",uptime30d:97,history:Array(30).fill("down")},
];
const incident = (serviceId, status="investigating", resolvedAt=null) =>
  ({serviceId,status,resolvedAt,startedAt:"2026-11-21T17:16:40Z"});

describe("Pico status incident impact", () => {
  it("marks only the affected online service degraded without changing its uptime", () => {
    const result=applyIncidentImpact(services(),[incident("website")]);
    expect(result[0].status).toBe("degraded");
    expect(result[0].history.at(-1)).toBe("degraded");
    expect(result[0].uptime30d).toBe(100);
    expect(result[1].status).toBe("up");
    expect(result[1].history.at(-1)).toBe("up");
    expect(result[2].status).toBe("down");
  });
  it("handles multiple affected services and preserves confirmed outages", () => {
    const result=applyIncidentImpact(services(),[
      incident("website","identified"),incident("mcp","monitoring"),incident("oauth")
    ]);
    expect(result.map(s=>s.status)).toEqual(["degraded","degraded","down"]);
  });
  it("restores operational state when all incidents are resolved", () => {
    const result=applyIncidentImpact(services(),[
      incident("website","resolved","2026-11-22T00:00:00Z"),
      incident("website","resolved",null)
    ]);
    expect(result[0].status).toBe("up");
    expect(result[0].history.at(-1)).toBe("up");
  });
  it("keeps services degraded until every incident affecting them is resolved", () => {
    const result=applyIncidentImpact(services(),[
      incident("website","resolved","2026-11-22T00:00:00Z"),
      incident("website","monitoring")
    ]);
    expect(result[0].status).toBe("degraded");
  });
  it("does not mutate the monitoring service data", () => {
    const before=services();
    const result=applyIncidentImpact(before,[incident("website")]);
    expect(before[0].status).toBe("up");
    expect(before[0].history.at(-1)).toBe("up");
    expect(result[0].history).not.toBe(before[0].history);
  });
  it("does not invent incident states when the archive is unavailable", () => {
    expect(applyIncidentImpact(services(),null).map(s=>s.status)).toEqual(["up","up","down"]);
  });
});

describe("30-day incident-adjusted service availability",()=>{
  const DAY=86400000;
  const now=Date.parse("2026-11-23T12:00:00Z");
  const issue=(id:string,start:number,end:number|null)=>({
    serviceId:id,status:end===null?"identified":"resolved",
    startedAt:new Date(start).toISOString(),
    resolvedAt:end===null?null:new Date(end).toISOString(),
  });
  it("reduces healthy availability when HTTP uptime is 100% but a feature incident lasts 1 day",()=>{
    const value=incidentAdjustedAvailability({id:"website",uptime30d:100},[
      issue("website",now-DAY,null)
    ],now);
    expect(value).toBe(96.67);
  });
  it("counts overlapping incidents only once",()=>{
    const value=incidentAdjustedAvailability({id:"website",uptime30d:100},[
      issue("website",now-2*DAY,now-DAY),
      issue("website",now-1.5*DAY,null),
      issue("mcp",now-5*DAY,null)
    ],now);
    expect(value).toBe(93.33);
  });
  it("clips incident periods to the last 30 days",()=>{
    expect(incidentAdjustedAvailability({id:"website",uptime30d:100},[
      issue("website",now-40*DAY,null)
    ],now)).toBe(0);
  });
  it("preserves lower monitor uptime and does not make up metrics if unavailable",()=>{
    expect(incidentAdjustedAvailability({id:"website",uptime30d:95},[
      issue("website",now-DAY,null)
    ],now)).toBe(95);
    expect(incidentAdjustedAvailability({id:"website",uptime30d:null},[],now)).toBeNull();
  });
});
