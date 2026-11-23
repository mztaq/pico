import { describe, expect, it } from "vitest";
import { applyIncidentImpact } from "../functions/api/status.js";

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
