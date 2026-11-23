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
  it("applies one fixed incident-day deduction for a new incident",()=>{
    const value=incidentAdjustedAvailability({id:"website",uptime30d:100},[
      issue("website",now-DAY,null)
    ],now);
    expect(value).toBe(96.67);
  });
  it("counts distinct incidents, not the time they overlap",()=>{
    const value=incidentAdjustedAvailability({id:"website",uptime30d:100},[
      issue("website",now-2*DAY,now-DAY),
      issue("website",now-1.5*DAY,null),
      issue("mcp",now-5*DAY,null)
    ],now);
    expect(value).toBe(93.33);
  });
  it("does not count incidents that started before the 30-day window",()=>{
    expect(incidentAdjustedAvailability({id:"website",uptime30d:100},[
      issue("website",now-40*DAY,null)
    ],now)).toBe(100);
  });
  it("keeps availability fixed while the same incident stays open and changes stage",()=>{
    const opened=now-2*DAY;
    const original={...issue("website",opened,null),id:"incident-42",status:"investigating"};
    const identified={...original,status:"identified"};
    const reportedAgain={...original,status:"monitoring"};
    const first=incidentAdjustedAvailability({id:"website",uptime30d:100},[original],now);
    const later=incidentAdjustedAvailability({id:"website",uptime30d:100},[identified],now+DAY);
    const repeated=incidentAdjustedAvailability({id:"website",uptime30d:100},[original,reportedAgain],now+DAY);
    expect(first).toBe(96.67);
    expect(later).toBe(first);
    expect(repeated).toBe(first);
  });
  it("reduces availability only when a different incident starts",()=>{
    const original={...issue("website",now-2*DAY,null),id:"incident-42"};
    const another={...issue("website",now-DAY,null),id:"incident-43"};
    expect(incidentAdjustedAvailability({id:"website",uptime30d:100},[original,another],now)).toBe(93.33);
    expect(incidentAdjustedAvailability({id:"mcp",uptime30d:100},[original,another],now)).toBe(100);
  });
  it("preserves lower monitor uptime and does not make up metrics if unavailable",()=>{
    expect(incidentAdjustedAvailability({id:"website",uptime30d:95},[
      issue("website",now-DAY,null)
    ],now)).toBe(95);
    expect(incidentAdjustedAvailability({id:"website",uptime30d:null},[],now)).toBeNull();
  });
});
