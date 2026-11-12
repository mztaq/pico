/** Deterministic, low-cost tactical positions for the incident game.
 * No external network calls. Evaluation uses a small set of rack-side spots.
 */
export interface GroundPoint {x:number; z:number}
export type RackPoint = readonly [number,number];
export type WalkableSpot = (x:number,z:number)=>boolean;
export type CoverCheck = (from:GroundPoint,to:GroundPoint,rack:{
  minX:number;maxX:number;minZ:number;maxZ:number;
})=>boolean;
export function rankedCoverSpots(
  origin:GroundPoint,
  pursuers:readonly GroundPoint[],
  racks:readonly RackPoint[],
  walkable:WalkableSpot,
  covered:CoverCheck,
  random:()=>number,
  previous?:GroundPoint|null,
):GroundPoint[]{
  const candidates:{point:GroundPoint; score:number}[]=[];
  for(const [rx,rz] of racks){
    for(const [dx,dz] of [[-1.9,0],[1.9,0],[0,-2.0],[0,2.0],[-1.9,-1.9],[1.9,1.9]]){
      const point={x:rx+dx,z:rz+dz};
      if(!walkable(point.x,point.z))continue;
      const distActor=Math.hypot(point.x-origin.x,point.z-origin.z);
      if(distActor<2)continue;
      let nearest=99,hidden=0;
      for(const pursuer of pursuers){
        const dist=Math.hypot(point.x-pursuer.x,point.z-pursuer.z);
        nearest=Math.min(nearest,dist);
        const behind=racks.some(([cx,cz])=>covered(pursuer,point,{
          minX:cx-1.0,maxX:cx+1.0,minZ:cz-1.16,maxZ:cz+1.16,
        }));
        if(behind)hidden++;
      }
      if(nearest<3.5)continue;
      const moved=previous?Math.hypot(point.x-previous.x,point.z-previous.z):999;
      const score=hidden*10+Math.min(nearest,19)*.95-distActor*.28+
        (moved<2.4?-5:0)+(random()-.5)*2.2;
      candidates.push({point,score});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  return candidates.map(c=>c.point);
}
export function formationPosition(
  target:GroundPoint,
  targetYaw:number,
  index:number,
  radius=2.35,
):GroundPoint{
  const offset=index%2===0?-1.15:1.15;
  const heading=targetYaw+offset;
  return {
    x:target.x+Math.sin(heading)*radius,
    z:target.z+Math.cos(heading)*radius,
  };
}
