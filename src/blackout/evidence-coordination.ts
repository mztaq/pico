/** Autonomous evidence gathering for security NPCs. Evidence is collected
 * at reachable physical locations, once per source, and shared with player.
 */
export interface EvidenceStation { id:string; x:number; z:number; value:number; description:string }
export interface EvidenceCase {
 trace:number;
 collectedEvidence:Record<string,boolean>;
}
export const EVIDENCE_STATIONS: readonly EvidenceStation[]=[
 {id:'proxy-logs',x:10.2,z:-8.5,value:15,description:'edge appliance access logs'},
 {id:'rack-telemetry',x:9.3,z:4.65,value:14,description:'rack telemetry samples'},
 {id:'uplink',x:0,z:9.6,value:16,description:'uplink trace records'},
 {id:'server-auth',x:-24.7,z:5.8,value:14,description:'server authentication events'},
 {id:'camera',x:-40.2,z:-5,value:15,description:'aisle camera evidence'},
 {id:'switch-ports',x:9.6,z:-.7,value:14,description:'switch port history'},
 {id:'endpoint',x:-26.1,z:-8.4,value:16,description:'endpoint security image'},
 {id:'traffic-capture',x:0,z:-9.4,value:14,description:'traffic capture records'},
];
export function selectGuardEvidence(
 stations:readonly EvidenceStation[],
 collected:Readonly<Record<string,boolean>>,
 reserved:ReadonlySet<string>,
 from:{x:number;z:number},
 reachable:(x:number,z:number)=>boolean,
):EvidenceStation|null{
 let best:EvidenceStation|null=null,score=Infinity;
 for(const station of stations){
  if(collected[station.id]||reserved.has(station.id)||!reachable(station.x,station.z))continue;
  const cost=Math.hypot(station.x-from.x,station.z-from.z);
  if(cost<score){best=station;score=cost;}
 }
 return best;
}
export function collectGuardEvidence(g:EvidenceCase,station:EvidenceStation):boolean{
 if(g.collectedEvidence[station.id])return false;
 g.collectedEvidence[station.id]=true;
 g.trace=Math.min(100,g.trace+station.value);
 return true;
}
